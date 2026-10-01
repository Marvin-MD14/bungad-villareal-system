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
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import Group, User
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from ..access.models import UserAccess
from ..business.models import Business, BusinessType
from ..catalog.models import BusinessItem, Category, InventoryLevel, Item, StockMovement
from ..checks import check_viewsets_are_business_scoped
from ..models import Branch, Transaction, UserProfile
from ..views import LoginThrottle


class BusinessIsolationTests(TestCase):
    def setUp(self):
        # LoginThrottle is keyed by IP, so every test in the suite shares one
        # bucket and the 10/minute cap measures the run, not this test.  Give
        # the login assertions a per-test budget.
        patcher = patch.object(LoginThrottle, 'rate', '1000/minute', create=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        cache.clear()

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
        """Create a user with a legacy *group* (capability fallback) only.

        §4.4 moved role/branch off UserProfile: scope and capability now come
        from ``UserAccess`` rows, which the individual tests create so each one
        states the exact grant it exercises. The group keeps grant-less legacy
        accounts readable (not 403) without implying any branch scope.
        """
        user = User.objects.create_user(username=username, password='pw')
        # Group name must be a ROLE_ALIASES alias so group-based resolution works.
        group_name = role_code if role_code.isupper() else 'Cashier'
        user.groups.add(Group.objects.get_or_create(name=group_name)[0])
        UserProfile.objects.create(user=user)
        return user

    def grant(self, user, role, business=None, branches=(), primary=False):
        """Attach a UserAccess grant (§4.4 is the only source of scope)."""
        access = UserAccess.objects.create(
            user=user, role=role, business=business, is_primary=primary,
        )
        if branches:
            access.branches.set(list(branches))
        return access

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
        user = self.make_user('iso-cashier', 'CASHIER')
        self.grant(user, 'CASHIER', business=self.vreal, branches=[self.retail_branch])
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
        user = self.make_user('iso-cashier-2', 'CASHIER')
        self.grant(user, 'CASHIER', business=self.vreal, branches=[self.retail_branch])
        self.client.force_authenticate(user=user)
        response = self.checkout(self.retail_branch, self.item, 99)
        self.assertEqual(response.status_code, 400)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.stock_qty, 10)

    def test_void_restores_stock_and_writes_ledger(self):
        user = self.make_user('iso-admin-2', 'SUPERADMIN')
        self.grant(user, 'OWNER')
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


class BusinessGetsDefaultBranchTests(TestCase):
    """A new business must arrive with a usable outlet, not empty (§3.1 naming).

    Business management is a *platform* action, so these run as SUPERADMIN.
    """

    def setUp(self):
        patcher = patch.object(LoginThrottle, 'rate', '1000/minute', create=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        cache.clear()
        self.client = APIClient()
        self.owner = User.objects.create_user(username='newbiz-owner', password='pw')
        self.owner.groups.add(Group.objects.get_or_create(name='SUPERADMIN')[0])
        UserAccess.objects.create(
            user=self.owner, role='SUPERADMIN', business=None, is_primary=True, is_active=True,
        )
        self.btype, _ = BusinessType.objects.get_or_create(
            code='nb-spa', defaults={'name': 'NB Spa'},
        )
        self.client.force_authenticate(user=self.owner)

    def test_creating_a_business_also_creates_its_main_branch(self):
        response = self.client.post('/api/businesses/', {
            'name': 'Fresh Spa', 'slug': 'fresh-spa', 'business_type': self.btype.id,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        business = Business.objects.get(slug='fresh-spa')
        # Every operational row hangs off a branch, so a business with no
        # outlet would be inert; the default "Main" branch makes it usable.
        self.assertEqual(list(business.branches.values_list('name', flat=True)), ['Main'])
        self.assertEqual(response.data['branch_count'], 1)

    def test_default_branch_is_not_duplicated_on_later_saves(self):
        business = Business.objects.create(
            name='Resave Spa', slug='resave-spa', business_type=self.btype,
        )
        business.name = 'Resave Spa Renamed'
        business.save()  # a plain update must not add a second "Main"
        self.assertEqual(business.branches.count(), 1)

    def test_owner_can_edit_a_business(self):
        created = self.client.post('/api/businesses/', {
            'name': 'Editable Co', 'slug': 'editable-co', 'business_type': self.btype.id,
        }, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        bid = created.data['id']

        response = self.client.patch(
            f'/api/businesses/{bid}/',
            {'name': 'Renamed Co', 'description': 'now with a description'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        business = Business.objects.get(pk=bid)
        self.assertEqual(business.name, 'Renamed Co')
        self.assertEqual(business.description, 'now with a description')
        # Editing must not disturb the outlets it already owns.
        self.assertEqual(business.branches.count(), 1)

    def test_business_can_be_deactivated_and_reactivated(self):
        created = self.client.post('/api/businesses/', {
            'name': 'Retiring Co', 'slug': 'retiring-co', 'business_type': self.btype.id,
        }, format='json')
        bid = created.data['id']

        off = self.client.patch(f'/api/businesses/{bid}/', {'is_active': False}, format='json')
        self.assertEqual(off.status_code, 200, off.data)
        self.assertFalse(Business.objects.get(pk=bid).is_active)

        on = self.client.patch(f'/api/businesses/{bid}/', {'is_active': True}, format='json')
        self.assertEqual(on.status_code, 200, on.data)
        self.assertTrue(Business.objects.get(pk=bid).is_active)

    def test_deleting_a_business_that_traded_is_refused_with_guidance(self):
        """§7.10 — a business with history is deactivated, never hard-deleted."""
        business = Business.objects.create(
            name='Trading Co', slug='trading-co', business_type=self.btype,
        )
        branch = business.branches.first()
        Transaction.objects.create(
            transaction_number='DEL-1', branch=branch, business=business,
            transaction_type='SALE', subtotal=10, total=10, amount_paid=10,
            change=0, status='PAID',
        )

        response = self.client.delete(f'/api/businesses/{business.id}/')
        self.assertEqual(response.status_code, 409, response.data)
        self.assertIn('Deactivate', response.data['detail'])
        self.assertEqual(response.data['remedy'], 'deactivate')
        # Nothing was destroyed: a 500 here would have taken the outlets with it.
        self.assertTrue(Business.objects.filter(pk=business.id).exists())
        self.assertTrue(branch.pk and Branch.objects.filter(pk=branch.pk).exists())

    def test_a_legacy_superadmin_role_keeps_platform_power(self):
        """LEGACY_ROLES must not downgrade SUPERADMIN into OWNER.

        The profile columns predate grants and were rewritten when SUPERADMIN was
        folded into OWNER. Now that the two are distinct again, mapping that
        legacy value to OWNER would strip the account of the very actions it
        exists to perform.
        """
        from ..serializers import UserProfileSerializer

        self.assertEqual(UserProfileSerializer.LEGACY_ROLES['SUPERADMIN'], 'SUPERADMIN')
        self.assertEqual(UserProfileSerializer.LEGACY_ROLES['Superadmin'], 'SUPERADMIN')
        self.assertEqual(UserProfileSerializer.LEGACY_ROLES['OWNER'], 'OWNER')
        self.assertEqual(UserProfileSerializer.LEGACY_ROLES['BRANCH_ADMIN'], 'BUSINESS_MANAGER')

        # And the live consequence: a platform operator keeps 201 on a business.
        self.assertIn('SUPERADMIN', UserAccess.COMPANY_ROLES)
        self.assertTrue(UserAccess.objects.filter(
            user=self.owner, role='SUPERADMIN', business__isnull=True,
        ).exists())

    def test_an_empty_business_can_be_deleted(self):
        business = Business.objects.create(
            name='Throwaway Co', slug='throwaway-co', business_type=self.btype,
        )
        # Remove the auto-created outlet so nothing is left holding it.
        business.branches.all().delete()
        response = self.client.delete(f'/api/businesses/{business.id}/')
        self.assertEqual(response.status_code, 204, response.data)
        self.assertFalse(Business.objects.filter(pk=business.id).exists())

    def test_a_business_manager_cannot_restructure_the_company(self):
        """Business:* is a platform action, denied below SUPERADMIN."""
        manager = User.objects.create_user(username='biz-mgr', password='pw')
        business = Business.objects.create(
            name='Mgr Co', slug='mgr-co', business_type=self.btype,
        )
        UserAccess.objects.create(
            user=manager, role='BUSINESS_MANAGER', business=business, is_primary=True, is_active=True,
        )
        client = APIClient()
        client.force_authenticate(user=manager)
        self.assertEqual(
            client.post('/api/businesses/', {
                'name': 'Sneaky Co', 'slug': 'sneaky-co', 'business_type': self.btype.id,
            }, format='json').status_code,
            403,
        )
        self.assertEqual(
            client.delete(f'/api/businesses/{business.id}/').status_code,
            403,
        )

    def test_the_owner_runs_the_company_but_cannot_restructure_it(self):
        """SUPERADMIN and OWNER are different jobs, enforced here.

        The Owner has the same wildcard as the Superadmin and sees every
        business, but may not create/retire businesses, edit business types,
        mint access grants or change company settings — that is the platform
        operator's job.
        """
        owner = User.objects.create_user(username='plain-owner', password='pw')
        owner.groups.add(Group.objects.get_or_create(name='OWNER')[0])
        UserAccess.objects.create(
            user=owner, role='OWNER', business=None, is_primary=True, is_active=True,
        )
        business = Business.objects.create(
            name='Owner Co', slug='owner-co', business_type=self.btype,
        )
        client = APIClient()
        client.force_authenticate(user=owner)

        # Running the company is allowed.
        self.assertEqual(client.get('/api/businesses/').status_code, 200)
        self.assertEqual(
            client.get('/api/dashboard/summary/').status_code, 200,
            'the Owner still sees every business',
        )
        # Restructuring the platform is not.
        self.assertEqual(
            client.post('/api/businesses/', {
                'name': 'Not Mine', 'slug': 'not-mine', 'business_type': self.btype.id,
            }, format='json').status_code,
            403,
        )
        self.assertEqual(client.delete(f'/api/businesses/{business.id}/').status_code, 403)
        self.assertEqual(
            client.patch(f'/api/businesses/{business.id}/', {'name': 'Renamed'}, format='json').status_code,
            403,
        )


class BusinessScopingGuardTests(SimpleTestCase):
    """The structural guard (api.E001) must actually fire.

    A guard nobody has seen fail is not a guard. These build a deliberately
    unscoped viewset and assert the check reports it, then assert the real URL
    conf is currently clean.
    """

    def _errors_for_probe(self):
        """Run the guard against a deliberately unscoped viewset."""
        from rest_framework.viewsets import ModelViewSet

        from api import checks
        from api.urls import router as real_router

        class UnscopedProbe(ModelViewSet):
            # Branch carries a `business` FK, so the guard should reject it.
            queryset = Branch.objects.all()

        original = real_router.registry
        real_router.registry = [('probe', UnscopedProbe, 'probe')]
        try:
            return [e for e in checks.check_viewsets_are_business_scoped() if e.id == 'api.E001']
        finally:
            real_router.registry = original

    def test_an_unscoped_business_viewset_is_reported(self):
        errors = self._errors_for_probe()
        self.assertEqual(len(errors), 1)
        self.assertIn('ScopedQuerysetMixin', errors[0].hint)

    def test_the_real_urlconf_has_no_unscoped_business_endpoint(self):
        errors = check_viewsets_are_business_scoped()
        self.assertEqual(
            errors, [],
            'An endpoint serves a business-scoped model without ScopedQuerysetMixin: '
            + '; '.join(e.msg for e in errors),
        )


class CatalogSourceMatchesBranchTypeTests(TestCase):
    """A receipt's ``catalog_source`` must agree with its outlet's ``branch_type``.

    The two were derived independently: ``Branch.branch_type`` substring-matches the
    business slug *and* business-type code, while the receipt label used an
    exact-match dict on the slug alone.  Any business not slugged exactly ``vss`` /
    ``vreal`` / ``bb`` was therefore labelled VSS/VREAL on the branch but stamped
    GENERIC on every line of every sale.
    """

    def _branch(self, slug, type_code):
        from api.business.models import BusinessType
        from api.models import Branch, Business

        btype, _ = BusinessType.objects.get_or_create(
            code=type_code, defaults={'name': type_code.title()},
        )
        business, _ = Business.objects.get_or_create(
            slug=slug, defaults={'name': slug.title(), 'business_type': btype},
        )
        branch, _ = Branch.objects.get_or_create(business=business, name='Main')
        return branch

    def test_a_non_standard_slug_still_stamps_the_right_catalog(self):
        from api.sales.services import catalog_source_for_branch

        for slug, type_code, expected in [
            ('vss', 'SPA', 'VSS'),          # exact slug, as before
            ('vss-spa', 'SPA', 'VSS'),      # slug *contains* vss
            ('villareal', 'VREAL', 'VREAL'),  # matched only via business type
            ('bb-store', 'BB', 'BB'),
        ]:
            with self.subTest(slug=slug):
                branch = self._branch(slug, type_code)
                self.assertEqual(branch.branch_type, expected)
                self.assertEqual(catalog_source_for_branch(branch), expected)

    def test_a_business_matching_no_legacy_catalog_is_generic(self):
        from api.sales.services import catalog_source_for_branch

        branch = self._branch('acme', 'SPA')
        self.assertEqual(branch.branch_type, 'MIXED')
        # MIXED is not a valid catalog_source, so it must degrade to GENERIC.
        self.assertEqual(catalog_source_for_branch(branch), 'GENERIC')