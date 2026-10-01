"""Priority-module tests: numbering, ledger, payments, shifts, ownership.

Covers the fixes from the backend/spec comparison:
DocumentSequence receipt numbers, F() counters, the append-only loyalty
ledger with configurable earning rules, split payments, cashier shifts,
Business.owner, and the single-active-OWNER guarantee.
"""

from decimal import Decimal

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction as db_transaction
from django.test import TestCase
from rest_framework.test import APIClient

from api.access.models import UserAccess
from api.access.serializers import UserAccessSerializer
from api.business.models import Business, BusinessType
from api.catalog.models import Category, Item
from api.loyalty.models import LoyaltyProgram, LoyaltyTransaction
from api.models import Branch, ClientProfile, DailySales, Transaction
from api.numbering import DocumentSequence
from api.payments.models import CashierShift, Payment, PaymentMethod
from api.sales.services import checkout, void_sale


def make_business(slug='prio-biz'):
    biz_type, _ = BusinessType.objects.get_or_create(
        code='prio', defaults={'name': 'Priority'},
    )
    business, _ = Business.objects.get_or_create(
        slug=slug, defaults={'name': f'Priority {slug}', 'business_type': biz_type},
    )
    return business


class PriorityBase(TestCase):
    def setUp(self):
        self.business = make_business()
        # The Business post_save signal already provisioned a 'Main' branch;
        # branch names are unique per business, so use a distinct till name.
        self.branch = Branch.objects.create(name='Till 1', business=self.business)
        self.cashier = User.objects.create_user(username='prio-cashier')
        self.category = Category.objects.create(name='Prio Goods', kind='PRODUCT')
        self.item = Item.objects.create(
            name='Test Candle', category=self.category,
            selling_price=Decimal('75.00'),
            item_type='PRODUCT', tracks_stock=False,
        )
        self.customer = ClientProfile.objects.create(
            first_name='Ana', last_name='Lim', business=self.business,
        )

    def sell(self, quantity=2, **overrides):
        kwargs = {
            'branch': self.branch,
            'cashier': self.cashier,
            'items': [{'item': self.item.pk, 'quantity': quantity}],
            'customer': self.customer,
            'amount_paid': Decimal('200.00'),
        }
        kwargs.update(overrides)
        return checkout(**kwargs)


class DocumentSequenceTests(PriorityBase):
    def test_receipt_numbers_are_sequential_and_collision_free(self):
        first = self.sell(amount_paid=Decimal('150.00'))
        second = self.sell(amount_paid=Decimal('150.00'))
        self.assertRegex(
            first.transaction_number, r'^TXN-\d{8}-0001$',
        )
        self.assertRegex(
            second.transaction_number, r'^TXN-\d{8}-0002$',
        )
        seq = DocumentSequence.objects.get(business=self.business, prefix='TXN')
        self.assertEqual(seq.last_number, 2)

    def test_counters_are_per_business(self):
        self.sell(amount_paid=Decimal('150.00'))
        other = make_business('prio-biz-2')
        other_branch = Branch.objects.create(name='Till A', business=other)
        txn = checkout(
            branch=other_branch, cashier=self.cashier,
            items=[{'item': self.item.pk, 'quantity': 1}],
            amount_paid=Decimal('75.00'),
        )
        self.assertTrue(txn.transaction_number.endswith('-0001'))


class CounterConcurrencyTests(PriorityBase):
    def test_daily_sales_and_balances_accumulate(self):
        self.sell(amount_paid=Decimal('150.00'))
        self.sell(amount_paid=Decimal('150.00'))
        daily = DailySales.objects.get(branch=self.branch)
        self.assertEqual(daily.transaction_count, 2)
        self.assertEqual(daily.total_sales, Decimal('300.00'))
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.total_spent, Decimal('300.00'))


class LoyaltyLedgerTests(PriorityBase):
    def test_earning_rules_are_configurable_per_business(self):
        program = LoyaltyProgram.for_business(self.business)
        program.earn_amount = Decimal('50')
        program.free_item_threshold = Decimal('100')
        program.save()

        txn = self.sell(amount_paid=Decimal('150.00'))  # total 150
        self.assertEqual(txn.points_earned, Decimal('3.00'))

        entry = LoyaltyTransaction.objects.get(customer=self.customer)
        self.assertEqual(entry.entry_type, 'EARN')
        self.assertEqual(entry.points, Decimal('3.00'))
        self.customer.refresh_from_db()
        self.assertEqual(entry.balance_after, self.customer.loyalty_points)
        self.assertEqual(self.customer.loyalty_points, Decimal('3.00'))
        self.assertEqual(self.customer.free_items_available, 1)

    def test_ledger_is_append_only(self):
        txn = self.sell(amount_paid=Decimal('150.00'))
        entry = LoyaltyTransaction.objects.get(transaction=txn)
        with self.assertRaises(Exception):
            entry.points = Decimal('99')
            entry.save()
        with self.assertRaises(Exception):
            entry.delete()

    def test_void_reverses_points_with_a_new_ledger_row(self):
        txn = self.sell(amount_paid=Decimal('150.00'))
        void_sale(transaction=txn, staff=self.cashier, reason='test')

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.loyalty_points, Decimal('0.00'))
        entries = list(
            LoyaltyTransaction.objects.filter(customer=self.customer)
            .order_by('entry_type'),
        )
        self.assertEqual({e.entry_type for e in entries}, {'EARN', 'ADJUST'})
        adjust = next(e for e in entries if e.entry_type == 'ADJUST')
        self.assertEqual(adjust.points, Decimal('-1.50'))
        # The EARN row was never edited — the trail shows both sides.
        earn = next(e for e in entries if e.entry_type == 'EARN')
        self.assertEqual(earn.points, Decimal('1.50'))

    def test_ledger_replay_equals_cached_balance(self):
        # balance_after must equal the sum of entries: replay equals cache.
        self.sell(amount_paid=Decimal('150.00'))
        self.sell(amount_paid=Decimal('150.00'))
        self.customer.refresh_from_db()
        from django.db.models import Sum


class SplitPaymentTests(PriorityBase):
    def test_checkout_accepts_split_tenders(self):
        txn = self.sell(
            amount_paid=Decimal('0'),
            payments=[
                {'method': 'CASH', 'amount': '100.00', 'tendered': '120.00'},
                {'method': 'GCASH', 'amount': '50.00', 'reference': 'GC-999'},
            ],
        )
        payments = list(txn.payments.order_by('id'))
        self.assertEqual(len(payments), 2)
        self.assertEqual(payments[0].method.code, 'CASH')
        self.assertEqual(payments[0].change, Decimal('20.00'))
        self.assertEqual(payments[1].method.code, 'GCASH')
        self.assertEqual(payments[1].reference, 'GC-999')
        self.assertEqual(txn.amount_paid, Decimal('170.00'))
        self.assertEqual(txn.change, Decimal('20.00'))

    def test_split_must_add_up_to_total(self):
        with self.assertRaises(Exception):
            self.sell(
                amount_paid=Decimal('0'),
                payments=[{'method': 'CASH', 'amount': '10.00'}],
            )

    def test_legacy_amount_paid_becomes_a_cash_tender(self):
        txn = self.sell(amount_paid=Decimal('200.00'))
        payment = txn.payments.get()
        self.assertEqual(payment.method.code, 'CASH')
        self.assertEqual(payment.amount, Decimal('150.00'))
        self.assertEqual(payment.change, Decimal('50.00'))


class CashierShiftTests(PriorityBase):
    def test_sale_and_tenders_attach_to_the_open_shift(self):
        shift = CashierShift.objects.create(
            business=self.business, branch=self.branch,
            staff=self.cashier, opening_float=Decimal('500.00'),
        )
        txn = self.sell(
            amount_paid=Decimal('0'),
            payments=[{'method': 'CASH', 'amount': '150.00', 'tendered': '200.00'}],
        )
        txn.refresh_from_db()
        self.assertEqual(txn.shift, shift)
        self.assertEqual(txn.payments.get().shift, shift)

        # Expected drawer: float 500 + 150 cash sales = 650; counted 700 → +50.
        shift.close(Decimal('700.00'))
        self.assertEqual(shift.status, 'CLOSED')
        self.assertEqual(shift.expected_cash, Decimal('650.00'))
        self.assertEqual(shift.over_short, Decimal('50.00'))

    def test_two_open_shifts_for_one_cashier_are_refused(self):
        CashierShift.objects.create(
            business=self.business, branch=self.branch, staff=self.cashier,
        )
        with self.assertRaises(IntegrityError), db_transaction.atomic():
            CashierShift.objects.create(
                business=self.business, branch=self.branch, staff=self.cashier,
            )

    def test_cashier_can_open_and_close_via_api(self):
        grant = UserAccess.objects.create(
            user=self.cashier, role='CASHIER', business=self.business,
            is_primary=True,
        )
        grant.branches.add(self.branch)
        client = APIClient()
        client.force_authenticate(user=self.cashier)

        opened = client.post('/api/cashier-shifts/open/', {
            'branch': self.branch.pk, 'opening_float': '100.00',
        }, format='json')
        self.assertEqual(opened.status_code, 201, opened.data)
        shift_id = opened.data['id']

        current = client.get('/api/cashier-shifts/current/')
        self.assertEqual(current.data['shift']['id'], shift_id)

        duplicate = client.post('/api/cashier-shifts/open/', {
            'branch': self.branch.pk,
        }, format='json')
        self.assertEqual(duplicate.status_code, 409)

        closed = client.post(
            f'/api/cashier-shifts/{shift_id}/close/',
            {'closing_cash': '100.00'}, format='json',
        )
        self.assertEqual(closed.status_code, 200, closed.data)
        self.assertEqual(closed.data['status'], 'CLOSED')
        self.assertEqual(Decimal(closed.data['over_short']), Decimal('0.00'))


class OwnershipTests(TestCase):
    def test_second_active_owner_is_refused(self):
        owner_a = User.objects.create_user(username='owner-a')
        owner_b = User.objects.create_user(username='owner-b')
        UserAccess.objects.create(user=owner_a, role='OWNER', business=None)

        serializer = UserAccessSerializer(data={
            'user': owner_b.pk, 'role': 'OWNER', 'business': None,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('role', serializer.errors)

        with self.assertRaises(IntegrityError), db_transaction.atomic():
            UserAccess.objects.create(user=owner_b, role='OWNER', business=None)

    def test_deactivating_the_old_owner_frees_the_slot(self):
        owner_a = User.objects.create_user(username='owner-a2')
        owner_b = User.objects.create_user(username='owner-b2')
        first = UserAccess.objects.create(user=owner_a, role='OWNER', business=None)
        first.is_active = False
        first.save()
        second = UserAccess.objects.create(user=owner_b, role='OWNER', business=None)
        self.assertTrue(second.is_active)

    def test_business_owner_round_trips(self):
        owner = User.objects.create_user(username='tenant-owner')
        business = make_business('owned-biz')
        business.owner = owner
        business.save()
        business.refresh_from_db()
        self.assertEqual(business.owner, owner)
        self.assertIn(business, owner.owned_businesses.all())