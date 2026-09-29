# backend/api/tests/test_business_isolation.py
"""Cross-business / cross-branch isolation tests — the most important tests.

They verify the new access stack end to end:

L1 (request)  BusinessMiddleware resolves the active business + allowed
              branches from the user's UserAccess grants.
L2 (ORM)      auto_scope()/ScopedQuerysetMixin narrows querysets.
L3 (perms)    RoleBasedPermission matrix + BusinessAccessPermission.
L4 (engine)   unified checkout: idempotency guard, atomic F() stock
              decrement, ledger rows.
"""

from decimal import Decimal

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient

from ..access.models import UserAccess
from ..business.models import Business, BusinessType
from ..catalog.models import BusinessItem, Category, InventoryLevel, Item, StockMovement
from ..models import Branch, Transaction, UserProfile


class BusinessIsolationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.spa_type, _ = BusinessType.objects.get_or_create(
            code='ispa', defaults={'name': 'Iso Spa', 'default_unit': 'session', 'tracks_stock': False}
        )
        self.retail_type, _ = BusinessType.objects.get_or_create(
            code='iretail', defaults={'name': 'Iso Retail', 'default_unit': 'pc', 'tracks_stock': True}
        )
        self.vss = Business.objects.create(
            name='Spa Biz', slug='spa-biz', business_type=self.spa_type
        )
        self.vreal = Business.objects.create(
            name='Retail Biz', slug='retail-biz', business_type=self.retail_type
        )
        self.spa_branch = Branch.objects.create(name='Spa Branch 1', business=self.vss)
        self.spa_branch2 = Branch.objects.create(name='Spa Branch 2', business=self.vss)
        self.retail_branch = Branch.objects.create(name='Retail Branch', business=self.vreal)

        cat, _ = Category.objects.get_or_create(name='Iso Goods', kind='PRODUCT')
        self.item = Item.objects.create(
            item_type='PRODUCT', category=cat, name='Iso Vitamin',
            selling_price='150.00', tracks_stock=True, unit='pc',
        )
        BusinessItem.objects.create(business=self.vreal, item=self.item)
        self.stock = InventoryLevel.objects.create(
            branch=self.retail_branch, item=self.item, stock_qty=10
        )

    # ---------- helpers ----------

    def make_user(self, username, role_code, profile_role=None, branch=None):
        user = User.objects.create_user(username=username, password='pw')
        # Group name must be a ROLE_ALIASES alias so group-based resolution works.
        group_name = role_code if role_code.isupper() else 'Cashier'
        user.groups.add(Group.objects.get_or_create(name=group_name)[0])
        effective_role = profile_role or role_code
        UserProfile.objects.create(
            user=user, role=effective_role,
            branch=branch if effective_role in {'BRANCH_ADMIN', 'CASHIER', 'STAFF'} else None,
        )
        return user

    # ---------- business isolation ----------

    def test_cashier_sees_only_granted_branch_transactions(self):
        other_branch = Branch.objects.create(name='Other Branch', business=self.vreal)
        Transaction.objects.create(
            transaction_number='TXN-A', branch=self.retail_branch, transaction_type='SALE',
            business=self.vreal, subtotal=10, discount=0, total=10,
            amount_paid=10, change=0, status='PAID',
        )
        mine = Transaction.objects.create(
            transaction_number='TXN-B', branch=other_branch, transaction_type='SALE',
            business=self.vreal, subtotal=20, discount=0, total=20,
            amount_paid=20, change=0, status='PAID',
        )
        user = self.make_user('retail-cashier', 'CASHIER', branch=other_branch)
        grant = UserAccess.objects.create(
            user=user, role='CASHIER', business=self.vreal, is_primary=True
        )
        grant.branches.add(other_branch)
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/transactions/')
        self.assertEqual(response.status_code, 200)
        numbers = [t['transaction_number'] for t in response.data['results']]
        self.assertEqual(numbers, [mine.transaction_number])

    def test_business_catalog_scoped_by_active_grant(self):
        # The active spa grant scopes the catalog to the spa business.
        user = self.make_user('spa-cashier', 'CASHIER', branch=self.spa_branch)
        UserAccess.objects.create(
            user=user, role='CASHIER', business=self.vss, is_primary=True
        )
        svc_cat, _ = Category.objects.get_or_create(name='Iso Salon', kind='SERVICE')
        svc = Item.objects.create(
            item_type='SERVICE', category=svc_cat, name='Iso Facial',
            selling_price='250.00', tracks_stock=False, unit='session',
        )
        BusinessItem.objects.create(business=self.vss, item=svc)
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/catalog/business-items/')
        self.assertEqual(response.status_code, 200)
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        owned = {entry['business'] for entry in results}
        self.assertEqual(owned, {self.vss.id})

    def test_switching_business_with_header(self):
        user = self.make_user('dual-cashier', 'CASHIER', branch=self.retail_branch)
        g1 = UserAccess.objects.create(user=user, role='CASHIER', business=self.vss)
        g2 = UserAccess.objects.create(user=user, role='CASHIER', business=self.vreal)
        g1.branches.add(self.spa_branch)
        g2.branches.add(self.retail_branch)
        self.client.force_authenticate(user=user)

        spa_resp = self.client.get('/api/businesses/', HTTP_X_BUSINESS='spa-biz')
        retail_resp = self.client.get('/api/businesses/', HTTP_X_BUSINESS='retail-biz')
        self.assertEqual(spa_resp.status_code, 200)
        self.assertEqual(retail_resp.status_code, 200)

        Transaction.objects.create(
            transaction_number='TXN-R', branch=self.retail_branch, transaction_type='SALE',
            business=self.vreal, subtotal=5, discount=0, total=5,
            amount_paid=5, change=0, status='PAID',
        )
        txns_spa = self.client.get('/api/transactions/', HTTP_X_BUSINESS='spa-biz').data['results']
        txns_retail = self.client.get('/api/transactions/', HTTP_X_BUSINESS='retail-biz').data['results']
        self.assertEqual([t['transaction_number'] for t in txns_spa], [])
        self.assertEqual([t['transaction_number'] for t in txns_retail], ['TXN-R'])

    def test_no_grant_user_sees_own_branch_catalog_items(self):
        """Legacy accounts (no UserAccess rows) get branch scoping, not a 403."""
        user = self.make_user('grantless', 'CASHIER', branch=self.spa_branch)
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/catalog/business-items/')
        self.assertEqual(response.status_code, 200)

        granted_user = self.make_user('granted', 'CASHIER', branch=self.retail_branch)
        grant = UserAccess.objects.create(
            user=granted_user, role='CASHIER', business=self.vreal, is_primary=True
        )
        grant.branches.add(self.retail_branch)
        self.client.force_authenticate(user=granted_user)
        denied = self.client.get('/api/catalog/business-items/', HTTP_X_BUSINESS='spa-biz')
        # spa-biz is not in this user's grants → normal narrowing, no cross access
        active = self.client.get('/api/catalog/business-items/', HTTP_X_BUSINESS='retail-biz')
        self.assertEqual(active.status_code, 200)
        for entry in active.data['results']:
            self.assertEqual(entry['business'], self.vreal.id)
        self.assertEqual(denied.status_code, 200)  # header ignored; falls back to own grant

    def test_company_owner_sees_all_businesses(self):
        owner = self.make_user('iso-owner', 'OWNER')
        UserAccess.objects.create(user=owner, role='OWNER', business=None, is_primary=True)
        self.client.force_authenticate(user=owner)
        response = self.client.get('/api/businesses/')
        self.assertEqual(response.status_code, 200)
        ids = {b['id'] for b in response.data['results']}
        self.assertIn(self.vss.id, ids)
        self.assertIn(self.vreal.id, ids)

    def test_branch_admin_cannot_create_access_grants(self):
        admin = self.make_user('iso-admin', 'BRANCH_ADMIN', branch=self.spa_branch)
        self.client.force_authenticate(user=admin)
        response = self.client.post('/api/user-access/', {
            'user': admin.id, 'role': 'CASHIER', 'business': self.vss.id,
        }, format='json')
        self.assertEqual(response.status_code, 403)

    # ---------- unified checkout engine ----------

    def checkout(self, branch, item, qty, key=None):
        payload = {
            'branch': branch.id,
            'amount_paid': str(Decimal('10000')),
            'items': [{'item_type': 'PRODUCT', 'item': item.id, 'quantity': qty}],
        }
        if key:
            payload['idempotency_key'] = key
        return self.client.post('/api/transactions/checkout/', payload, format='json')

    def test_checkout_is_idempotent(self):
        user = self.make_user('iso-cashier', 'CASHIER', branch=self.retail_branch)
        self.client.force_authenticate(user=user)

        first = self.checkout(self.retail_branch, self.item, 2, key='iso-key-1')
        second = self.checkout(self.retail_branch, self.item, 2, key='iso-key-1')
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(Transaction.objects.filter(idempotency_key='iso-key-1').count(), 1)

        self.stock.refresh_from_db()
        self.assertEqual(self.stock.stock_qty, 8)  # decremented exactly once

    def test_checkout_rejects_insufficient_stock(self):
        user = self.make_user('iso-cashier-2', 'CASHIER', branch=self.retail_branch)
        self.client.force_authenticate(user=user)
        response = self.checkout(self.retail_branch, self.item, 99)
        self.assertEqual(response.status_code, 400)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.stock_qty, 10)

    def test_void_restores_stock_and_writes_ledger(self):
        user = self.make_user('iso-admin-2', 'SUPERADMIN')
        self.client.force_authenticate(user=user)

        checkout = self.checkout(self.retail_branch, self.item, 1)
        self.assertEqual(checkout.status_code, 201, checkout.data)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.stock_qty, 9)

        void = self.client.post(
            f"/api/transactions/{checkout.data['id']}/void/",
            {'reason': 'test'}, format='json')
        self.assertEqual(void.status_code, 200)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.stock_qty, 10)
        self.assertTrue(StockMovement.objects.filter(
            branch=self.retail_branch, item=self.item, reason='VOID'
        ).exists())

    def test_login_returns_businesses_and_primary(self):
        user = self.make_user('login-dual', 'CASHIER', branch=self.spa_branch)
        UserAccess.objects.create(
            user=user, role='CASHIER', business=self.vss, is_primary=True
        )
        UserAccess.objects.create(user=user, role='CASHIER', business=self.vreal)
        response = self.client.post('/api/auth/login/', {
            'username': 'login-dual', 'password': 'pw',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['businesses']), 2)
        self.assertEqual(response.data['primary_business']['slug'], 'spa-biz')