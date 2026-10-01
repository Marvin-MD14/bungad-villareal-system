"""Checkout rate limiting (§7.3) and outlet-to-outlet stock transfers (§7.8 gap #8)."""

from unittest.mock import patch

from django.contrib.auth.models import Group, User
from django.conf import settings
from django.core.cache import cache
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from ..access.models import UserAccess
from ..business.models import Business, BusinessType
from ..catalog.models import Category, InventoryLevel, Item, StockMovement
from ..models import Branch, UserProfile
from ..sales.services import transfer_stock
from ..views import CheckoutThrottle


class AccessTestCase(TestCase):
    """Shared two-business fixture used by the throttle and transfer tests."""

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        spa_type, _ = BusinessType.objects.get_or_create(code='th-spa', defaults={'name': 'Th Spa'})
        self.spa = Business.objects.create(name='Th Spa', slug='th-spa-co', business_type=spa_type)
        self.branch_a = Branch.objects.create(name='Th Branch A', business=self.spa)
        self.branch_b = Branch.objects.create(name='Th Branch B', business=self.spa)
        self.other = Business.objects.create(name='Th Other', slug='th-other-co', business_type=spa_type)
        self.other_branch = Branch.objects.create(name='Th Other Branch', business=self.other)

        category, _ = Category.objects.get_or_create(name='Th Goods', kind='PRODUCT')
        self.item = Item.objects.create(
            item_type='PRODUCT', category=category, name='Th Towel',
            cost_price='20.00', selling_price='100.00', tracks_stock=True, unit='pc',
        )
        self.level_a = InventoryLevel.objects.create(branch=self.branch_a, item=self.item, stock_qty=10)
        self.level_b = InventoryLevel.objects.create(branch=self.branch_b, item=self.item, stock_qty=2)

        # Sales in these tests are about access and rate limits, not stock, so
        # they ring up a service line that needs no inventory at the outlet.
        services, _ = Category.objects.get_or_create(name='Th Services', kind='SERVICE')
        self.service = Item.objects.create(
            item_type='SERVICE', category=services, name='Th Massage',
            selling_price='100.00', tracks_stock=False, unit='session',
            duration=60, duration_unit='MIN',
        )

    def _user(self, username, role, business, grant_role=None):
        # §4.4: group is the legacy capability fallback; the grant carries scope.
        user = User.objects.create_user(username=username, password='pw')
        user.groups.add(Group.objects.get_or_create(name=role)[0])
        UserProfile.objects.create(user=user)
        UserAccess.objects.create(
            user=user, role=grant_role or role, business=business, is_primary=True
        )
        return user

    def _sale(self, branch, business=None):
        extra = {'HTTP_X_BUSINESS': business.slug} if business else {}
        return self.client.post('/api/transactions/checkout/', {
            'branch': branch.id, 'amount_paid': '100.00',
            'items': [{'item_type': 'SERVICE', 'service': self.service.id, 'quantity': 1}],
        }, format='json', **extra)


class CheckoutThrottleTests(AccessTestCase):
    """Sales submissions are capped at ``checkout`` per user *per business*."""

    def setUp(self):
        super().setUp()
        # DRF snapshots THROTTLE_RATES when it imports the throttle classes, so
        # override_settings cannot change the cap — patch the class attribute.
        patcher = patch.object(CheckoutThrottle, 'rate', '2/minute', create=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.cashier = self._user('th-cashier', 'CASHIER', self.spa)
        self.client.force_authenticate(user=self.cashier)

    def test_shipped_checkout_rate_is_configured(self):
        self.assertEqual(
            settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].get('checkout'), '60/minute')
        self.assertEqual(CheckoutThrottle.scope, 'checkout')

    def test_checkout_is_rate_limited(self):
        self.assertEqual(self._sale(self.branch_a).status_code, 201)
        self.assertEqual(self._sale(self.branch_a).status_code, 201)
        throttled = self._sale(self.branch_a)
        self.assertEqual(throttled.status_code, 429)
        self.assertTrue(throttled.headers.get('Retry-After'), '429 must tell the till when to retry')

    def test_rate_limit_is_keyed_per_business(self):
        """A runaway till in one business must not lock the operator out of another."""
        self.assertEqual(self._sale(self.branch_a).status_code, 201)
        self.assertEqual(self._sale(self.branch_a).status_code, 201)
        self.assertEqual(self._sale(self.branch_a).status_code, 429)

        second = Business.objects.create(name='Th Spa Two', slug='th-spa-two',
                                         business_type=self.spa.business_type)
        second_branch = Branch.objects.create(name='Th Branch C', business=second)
        UserAccess.objects.create(user=self.cashier, role='CASHIER', business=second)
        self.assertEqual(self._sale(second_branch, business=second).status_code, 201,
                         'switching business grants a fresh allowance')

    def test_reads_are_not_throttled(self):
        for _ in range(4):
            self.assertEqual(self.client.get('/api/transactions/').status_code, 200)


class StockTransferTests(AccessTestCase):
    def setUp(self):
        super().setUp()
        self.manager = self._user('th-mgr', 'STAFF', self.spa, grant_role='BUSINESS_MANAGER')
        self.client.force_authenticate(user=self.manager)

    def _transfer(self, level, to_branch, quantity, reference='TR-1'):
        return self.client.post(f'/api/catalog/inventory/{level.id}/transfer/', {
            'to_branch': to_branch.id, 'quantity': quantity, 'reference': reference,
        }, format='json')

    def test_transfer_moves_stock_and_writes_balancing_movements(self):
        response = self._transfer(self.level_a, self.branch_b, 4, 'TR-42')
        self.assertEqual(response.status_code, 200)
        self.level_a.refresh_from_db()
        self.level_b.refresh_from_db()
        self.assertEqual(self.level_a.stock_qty, 6)
        self.assertEqual(self.level_b.stock_qty, 6)

        out = StockMovement.objects.get(branch=self.branch_a, reason='TRANSFER_OUT')
        move_in = StockMovement.objects.get(branch=self.branch_b, reason='TRANSFER_IN')
        self.assertEqual((out.quantity_delta, out.balance_after), (-4, 6))
        self.assertEqual((move_in.quantity_delta, move_in.balance_after), (4, 6))
        self.assertEqual(out.reference, move_in.reference, 'the pair must share a reference')

    def test_transfer_to_a_branch_with_no_row_creates_it(self):
        new_branch = Branch.objects.create(name='Th Branch D', business=self.spa)
        self.assertEqual(self._transfer(self.level_a, new_branch, 3).status_code, 200)
        self.assertEqual(InventoryLevel.objects.get(branch=new_branch, item=self.item).stock_qty, 3)

    def test_transfer_beyond_available_stock_is_rejected_without_side_effects(self):
        self.assertEqual(self._transfer(self.level_a, self.branch_b, 500).status_code, 400)
        self.assertEqual(InventoryLevel.objects.get(pk=self.level_a.pk).stock_qty, 10)
        self.assertFalse(StockMovement.objects.filter(reason__startswith='TRANSFER').exists())

    def test_transfer_between_businesses_is_rejected(self):
        self.assertEqual(self._transfer(self.level_a, self.other_branch, 1).status_code, 400)
        self.assertEqual(InventoryLevel.objects.get(pk=self.level_a.pk).stock_qty, 10)

    def test_cashier_cannot_transfer_stock(self):
        cashier = self._user('th-thief', 'CASHIER', self.spa)
        client = APIClient()
        client.force_authenticate(user=cashier)
        response = client.post(
            f'/api/catalog/inventory/{self.level_a.id}/transfer/',
            {'to_branch': self.branch_b.id, 'quantity': 1}, format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_service_refuses_a_self_transfer(self):
        with self.assertRaises(ValidationError):
            transfer_stock(from_branch=self.branch_a, to_branch=self.branch_a,
                           item=self.item, quantity=1)


class CheckoutBranchAuthorityTests(AccessTestCase):
    """Till authority comes from the access grant, not the legacy profile row."""

    def test_business_grant_covers_every_branch_of_that_business(self):
        cashier = self._user('auth-cashier', 'CASHIER', self.spa)
        self.client.force_authenticate(user=cashier)
        self.assertEqual(self._sale(self.branch_b).status_code, 201,
                         'the legacy profile branch must not pin a granted cashier')

    def test_narrowed_grant_pins_the_till_to_the_ticked_branch(self):
        cashier = self._user('auth-pin', 'CASHIER', self.spa)
        UserAccess.objects.get(user=cashier, business=self.spa).branches.add(self.branch_a)
        self.client.force_authenticate(user=cashier)
        self.assertEqual(self._sale(self.branch_b).status_code, 403)
        self.assertEqual(self._sale(self.branch_a).status_code, 201)

    def test_selling_for_a_business_without_a_grant_is_forbidden(self):
        cashier = self._user('auth-steal', 'CASHIER', self.spa)
        self.client.force_authenticate(user=cashier)
        self.assertEqual(self._sale(self.other_branch, business=self.other).status_code, 403)

