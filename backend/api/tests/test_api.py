from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import Group, User
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from ..access.models import DeviceToken, UserAccess
from ..views import LoginThrottle
from ..models import Branch, UserProfile
from ..business.models import Business, BusinessType
from ..catalog.models import Category, InventoryLevel, Item


def make_branch(name):
    """Branches live inside a Business; the legacy tests need one quickly."""
    business, _ = Business.objects.get_or_create(
        slug='legacy-tests',
        defaults={
            'name': 'Legacy Test Business',
            'business_type': BusinessType.objects.get_or_create(
                code='legacy', defaults={'name': 'Legacy'}
            )[0],
        },
    )
    return Branch.objects.create(name=name, business=business)


def grant(user, role, branch=None, business=None, primary=True):
    """Give ``user`` the UserAccess grant that decides scope *and* capability.

    §4.4 removed role/branch from UserProfile, so every test that needs a
    capability or a visible branch creates a grant instead of a profile row.
    """
    target = business or (branch.business if branch is not None else None)
    if role in UserAccess.COMPANY_ROLES:
        target = None
    access, _ = UserAccess.objects.get_or_create(
        user=user, role=role, business=target,
        defaults={'is_primary': primary, 'is_active': True},
    )
    if branch is not None:
        access.branches.add(branch)
    return access


class AuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test-admin',
            password='correct-password',
            is_staff=True,
        )

    def test_login_returns_token_for_valid_credentials(self):
        response = self.client.post(
            '/api/auth/login/',
            {'username': 'test-admin', 'password': 'correct-password'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['token'])
        self.assertEqual(response.data['user']['username'], 'test-admin')

    def test_login_rejects_invalid_credentials(self):
        response = self.client.post(
            '/api/auth/login/',
            {'username': 'test-admin', 'password': 'wrong-password'},
            format='json',
        )

        self.assertEqual(response.status_code, 401)


class DeviceTokenTests(TestCase):
    """§7.9 — expiring, rotating, per-device credentials that die with the password."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='till-user', password='correct-password', is_staff=True,
        )
        # These tests log in on nearly every assertion; the real 10/minute
        # LoginThrottle is IP-keyed and shared by the whole suite, so it would
        # measure the test run rather than the code under test.
        patcher = patch.object(LoginThrottle, 'rate', '1000/minute', create=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        cache.clear()

    def _login(self, **extra):
        payload = {'username': 'till-user', 'password': 'correct-password'}
        payload.update(extra)
        response = self.client.post('/api/auth/login/', payload, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data['token']

    def _auth(self, key):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Token {key}')
        return client

    def test_login_issues_an_expiring_device_token(self):
        response = self.client.post(
            '/api/auth/login/',
            {'username': 'till-user', 'password': 'correct-password',
             'device_name': 'Front Desk iPad'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['expires_at'])
        token = DeviceToken.objects.get(user=self.user)
        self.assertEqual(token.device_name, 'Front Desk iPad')
        self.assertTrue(token.is_valid)

    def test_each_device_gets_its_own_independent_credential(self):
        first = self._login(device_name='Till A')
        second = self._login(device_name='Till B')

        self.assertNotEqual(first, second, 'two devices must not share one credential')
        self.assertEqual(DeviceToken.objects.filter(user=self.user).count(), 2)
        # Revoking one leaves the other working — the point of per-device tokens.
        DeviceToken.objects.get(key=first).revoke()
        self.assertEqual(self._auth(second).get('/api/branches/').status_code, 200)

    def test_expired_token_is_rejected(self):
        key = self._login()
        stale = DeviceToken.objects.get(key=key)
        stale.expires_at = timezone.now() - timedelta(seconds=1)
        stale.save(update_fields=['expires_at'])

        response = self._auth(key).get('/api/branches/')
        self.assertEqual(response.status_code, 401)
        self.assertIn('expired', response.data['detail'].lower())

    def test_rotated_token_stops_working_and_the_new_one_works(self):
        key = self._login()
        old = DeviceToken.objects.get(key=key)

        rotated = self._auth(key).post('/api/auth/rotate-token/', format='json')
        self.assertEqual(rotated.status_code, 200, rotated.data)
        self.assertNotEqual(rotated.data['token'], key, 'a rotation must mint a new key')

        old.refresh_from_db()
        self.assertTrue(old.is_revoked, 'the presented credential must be revoked on rotation')
        self.assertEqual(DeviceToken.objects.get(key=rotated.data['token']).rotated_from_id, old.pk)

        # New key works, old key does not.
        self.assertEqual(self._auth(rotated.data['token']).get('/api/branches/').status_code, 200)
        self.assertEqual(self._auth(key).get('/api/branches/').status_code, 401)

    def test_changing_the_password_kills_every_outstanding_token(self):
        first = self._login(device_name='Till A')
        second = self._login(device_name='Till B')

        self.user.set_password('a-brand-new-password')
        self.user.save(update_fields=['password'])

        for key in (first, second):
            self.assertEqual(self._auth(key).get('/api/branches/').status_code, 401)
        # The stale rows are burned, not merely ignored.
        for token in DeviceToken.objects.filter(user=self.user):
            self.assertTrue(token.is_revoked)

    def test_password_change_caught_without_a_signal(self):
        key = self._login()
        # An admin rotating a password in the admin site (or a management
        # command) must still invalidate the credential: the fingerprint check
        # is what guarantees it, not a post_save hook.
        User.objects.filter(pk=self.user.pk).update(password='pbkdf2_sha256$x$changed$hash')
        self.assertEqual(self._auth(key).get('/api/branches/').status_code, 401)

    def test_logout_revokes_only_the_calling_device(self):
        first = self._login(device_name='Till A')
        second = self._login(device_name='Till B')

        self.assertEqual(self._auth(first).post('/api/auth/logout/', format='json').status_code, 200)

        self.assertEqual(self._auth(first).get('/api/branches/').status_code, 401)
        self.assertEqual(
            self._auth(second).get('/api/branches/').status_code, 200,
            'logging out one till must not sign the user out of the others',
        )

    def test_unknown_and_malformed_keys_are_rejected(self):
        self.assertEqual(self._auth('deadbeef').get('/api/branches/').status_code, 401)
        bad = APIClient()
        bad.credentials(HTTP_AUTHORIZATION='Token')
        self.assertEqual(bad.get('/api/branches/').status_code, 401)

    def test_deactivated_user_cannot_use_an_issued_token(self):
        key = self._login()
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        self.assertEqual(self._auth(key).get('/api/branches/').status_code, 401)


class RoleCapabilityEndpointTests(TestCase):
    """§6.3 — the SPA reads its nav/role pickers from the live matrix, not a copy."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='cap-owner', password='pw', is_staff=True)
        self.user.groups.add(Group.objects.create(name='OWNER'))
        UserAccess.objects.create(
            user=self.user, role='OWNER', business=None, is_primary=True, is_active=True,
        )
        self.client.force_authenticate(user=self.user)

    def test_capabilities_are_derived_from_the_permission_matrix(self):
        response = self.client.get('/api/auth/capabilities/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['role'], 'OWNER')
        # The Owner is a full-control role, so it must be offered the whole nav.
        for capability in ('dashboard', 'sales', 'administration', 'users', 'audit', 'catalog'):
            self.assertIn(capability, response.data['capabilities'])

    def test_role_list_comes_from_the_model_choices(self):
        response = self.client.get('/api/auth/capabilities/')
        values = [row['value'] for row in response.data['roles']]
        self.assertEqual(values, [value for value, _ in UserAccess.ROLE_CHOICES])

    def test_a_narrower_role_gets_a_narrower_nav(self):
        from ..permissions import ui_capabilities_for

        # The point of deriving it: a front-of-house role is not offered
        # administration, matching what the matrix actually allows.
        self.assertNotIn('administration', ui_capabilities_for('CASHIER'))
        self.assertIn('documentation', ui_capabilities_for('CASHIER'))


class RolePermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def create_role_user(self, username, role):
        """Group-only account: the legacy capability fallback for grant-less users."""
        user = User.objects.create_user(username=username, password='test-password')
        user.groups.add(Group.objects.create(name=role))
        UserProfile.objects.create(user=user)
        return user

    def test_cashier_can_read_catalog_but_not_manage_branches(self):
        user = self.create_role_user('cashier', 'Cashier')
        self.client.force_authenticate(user=user)

        # /products/ was retired with the shims (Phase 5); the catalog lives here.
        self.assertEqual(self.client.get('/api/catalog/items/').status_code, 200)
        self.assertEqual(self.client.get('/api/branches/').status_code, 200)
        self.assertEqual(self.client.post('/api/branches/', {'name': 'Nope'}).status_code, 403)

    def test_therapist_cannot_access_transactions(self):
        user = self.create_role_user('therapist', 'Therapist')
        self.client.force_authenticate(user=user)

        self.assertEqual(self.client.get('/api/transactions/').status_code, 403)

    def test_admin_can_access_branch_management(self):
        user = self.create_role_user('admin', 'Admin')
        self.client.force_authenticate(user=user)

        self.assertEqual(self.client.get('/api/branches/').status_code, 200)

    def test_business_manager_only_sees_branches_of_their_grant(self):
        assigned_branch = make_branch('Assigned Branch')
        other_branch = make_branch('Other Branch')
        user = self.create_role_user('branch-admin', 'BRANCH_ADMIN')
        grant(user, 'BUSINESS_MANAGER', branch=assigned_branch)
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/branches/')

        self.assertEqual(response.status_code, 200)
        branches = response.data['results'] if isinstance(response.data, dict) else response.data
        branch_ids = [branch['id'] for branch in branches]
        self.assertEqual(branch_ids, [assigned_branch.id])
        self.assertNotIn(other_branch.id, branch_ids)
    def test_owner_can_read_and_mutate_operational_data(self):
        """§6.3 renamed SUPERADMIN -> OWNER, so the owner is a full-control role."""
        owner = self.create_role_user('owner', 'OWNER')
        # §4.4: the OWNER's authority is the company-wide grant, not the group name.
        grant(owner, 'OWNER')
        branch = make_branch('Owner Branch')
        self.client.force_authenticate(user=owner)

        self.assertEqual(self.client.get('/api/branches/').status_code, 200)
        self.assertEqual(self.client.get('/api/catalog/items/').status_code, 200)
        _r = self.client.post('/api/branches/', {'name': 'Owner New Branch'}, format='json')
        self.assertEqual(_r.status_code, 201, getattr(_r, 'data', None))
        self.assertEqual(
            self.client.post('/api/clients/', {
                'first_name': 'Owned', 'last_name': 'Client',
                # A company-wide owner has no active business, so it names one.
                'business': branch.business_id,
            }, format='json').status_code,
            201,
        )

        # The read-only money role is the Accountant, not the Owner.
        accountant = self.create_role_user('accountant-user', 'Accountant')
        grant(accountant, 'ACCOUNTANT')
        self.client.force_authenticate(user=accountant)
        self.assertEqual(self.client.get('/api/transactions/').status_code, 200)
        self.assertEqual(self.client.post('/api/branches/', {'name': 'Nope'}).status_code, 403)
        self.assertEqual(
            self.client.post('/api/transactions/checkout/', {
                'branch': branch.id,
                'amount_paid': '100.00',
                'items': [],
            }).status_code, 403
        )

    def test_owner_grant_creates_branch_admin_with_branch(self):
        owner = self.create_role_user('system-owner', 'SUPERADMIN')
        grant(owner, 'OWNER')
        branch = make_branch('New Admin Branch')
        self.client.force_authenticate(user=owner)

        response = self.client.post('/api/user-profiles/', {
            'username': 'new-branch-admin',
            'password': 'StrongPassword!2026',
            'first_name': 'Branch',
            'last_name': 'Admin',
            'role': 'BRANCH_ADMIN',
            'branch': branch.id,
            'services': [],
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        created_user = User.objects.get(username='new-branch-admin')
        self.assertTrue(created_user.check_password('StrongPassword!2026'))
        # The legacy role/branch pair is stored as a grant (§4.4).
        access = created_user.access_grants.get()
        self.assertEqual(access.role, 'BUSINESS_MANAGER')
        self.assertEqual(access.branch_ids(), [branch.id])
        self.assertEqual(access.business_id, branch.business_id)

    def test_branch_roles_require_branch_assignment(self):
        owner = self.create_role_user('staffing-superadmin', 'SUPERADMIN')
        grant(owner, 'OWNER')
        self.client.force_authenticate(owner)

        response = self.client.post('/api/user-profiles/', {
            'username': 'unassigned-cashier',
            'password': 'StrongPassword!2026',
            'first_name': 'Unassigned',
            'last_name': 'Cashier',
            'role': 'CASHIER',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('branch', response.data)
        self.assertFalse(User.objects.filter(username='unassigned-cashier').exists())

    def test_branch_staffing_summary_reports_missing_roles(self):
        owner = self.create_role_user('staffing-summary-admin', 'SUPERADMIN')
        grant(owner, 'OWNER')
        branch = make_branch('Staffing Summary Branch')
        cashier = self.create_role_user('summary-cashier', 'CASHIER')
        grant(cashier, 'CASHIER', branch=branch)
        self.client.force_authenticate(user=owner)

        response = self.client.get(f'/api/branches/{branch.id}/staffing/')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['ready'])
        self.assertIn('BUSINESS_MANAGER', response.data['missing_roles'])
        self.assertEqual(response.data['roles']['CASHIER'], 1)
    def test_superadmin_can_edit_branch_and_staff_profile(self):
        owner = self.create_role_user('edit-superadmin', 'SUPERADMIN')
        grant(owner, 'OWNER')
        branch = make_branch('Editable Branch')
        cashier = self.create_role_user('editable-cashier', 'CASHIER')
        profile, _ = UserProfile.objects.get_or_create(user=cashier)
        self.client.force_authenticate(user=owner)

        branch_response = self.client.patch(f'/api/branches/{branch.id}/', {
            'name': 'Updated Branch',
            'address': 'Updated branch description',
        }, format='json')
        profile_response = self.client.patch(f'/api/user-profiles/{profile.id}/', {
            'first_name': 'Updated',
            'last_name': 'Cashier',
            'role': 'STAFF',
            'branch': branch.id,
            'services': [],
        }, format='json')

        self.assertEqual(branch_response.status_code, 200, branch_response.data)
        self.assertEqual(profile_response.status_code, 200, profile_response.data)
        branch.refresh_from_db()
        self.assertEqual(branch.address, 'Updated branch description')
        # The posted role/branch pair landed as a grant (§4.4), and the derived
        # `role` on the profile reflects it.
        access = cashier.access_grants.get()
        self.assertEqual(access.role, 'STAFF')
        self.assertEqual(access.branch_ids(), [branch.id])
        self.assertEqual(profile.role, 'STAFF')

    def _make_stocked_item(self, branch, name, price, stock):
        """Create a unified-catalog item stocked at ``branch``."""
        category, _ = Category.objects.get_or_create(name='Test Goods', kind='PRODUCT')
        item = Item.objects.create(
            item_type='PRODUCT',
            category=category,
            name=name,
            cost_price='50.00',
            selling_price=price,
            tracks_stock=True,
            unit='pc',
            is_active=True,
        )
        inventory = InventoryLevel.objects.create(branch=branch, item=item, stock_qty=stock)
        return item, inventory

    def test_cashier_checkout_deducts_stock_and_records_sale(self):
        user = self.create_role_user('checkout-cashier', 'Cashier')
        branch = make_branch('Test Branch')
        item, inventory = self._make_stocked_item(branch, 'Test Product', '100.00', 3)
        grant(user, 'CASHIER', branch=branch)
        self.client.force_authenticate(user=user)
        response = self.client.post('/api/transactions/checkout/', {
            'branch': branch.id,
            'amount_paid': '250.00',
            'items': [{'item_type': 'PRODUCT', 'product': item.id, 'quantity': 2}],
        }, format='json')

        inventory.refresh_from_db()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['total'], '200.00')
        self.assertEqual(response.data['change'], '50.00')
        self.assertEqual(inventory.stock_qty, 1)

    def test_business_api_requires_authentication(self):
        response = self.client.get('/api/catalog/items/')

        self.assertEqual(response.status_code, 401)

    def test_a_customer_belongs_to_one_business_and_is_hidden_from_others(self):
        """Customers are tenant data, not a shared platform-wide list.

        ``ClientProfile`` had no ``business`` column, so every cashier saw every
        customer of every business. A client now belongs to exactly one business
        and must be invisible outside it.
        """
        from ..models import ClientProfile

        # Two genuinely different tenants: make_branch() reuses one business.
        other_business, _ = Business.objects.get_or_create(
            slug='other-tenant',
            defaults={
                'name': 'Other Tenant',
                'business_type': BusinessType.objects.get_or_create(
                    code='legacy', defaults={'name': 'Legacy'}
                )[0],
            },
        )
        mine = make_branch('Clients Mine')
        my_client = ClientProfile.objects.create(
            first_name='Maria', last_name='Santos', business=mine.business,
        )
        their_client = ClientProfile.objects.create(
            first_name='Juan', last_name='Dela Cruz', business=other_business,
        )

        user = self.create_role_user('lookup-cashier', 'CASHIER')
        grant(user, 'CASHIER', branch=mine)
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/clients/')
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data)
        ids = [c['id'] for c in results]
        self.assertIn(my_client.id, ids)
        self.assertNotIn(their_client.id, ids)

        # And the foreign customer is not directly retrievable either.
        self.assertEqual(self.client.get(f'/api/clients/{their_client.id}/').status_code, 404)

    def test_a_cashier_cannot_file_a_customer_into_another_business(self):
        """`business` is stamped from the request, never taken from the payload."""
        mine = make_branch('Stamp Mine')
        other_business = Business.objects.get_or_create(
            slug='stamp-other-tenant',
            defaults={
                'name': 'Stamp Other Tenant',
                'business_type': BusinessType.objects.get_or_create(
                    code='legacy', defaults={'name': 'Legacy'}
                )[0],
            },
        )[0]

        user = self.create_role_user('stamp-cashier', 'CASHIER')
        grant(user, 'CASHIER', branch=mine)
        self.client.force_authenticate(user=user)

        response = self.client.post('/api/clients/', {
            'first_name': 'Spy', 'last_name': 'Attempt',
            'business': other_business.id,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        from ..models import ClientProfile
        self.assertEqual(
            ClientProfile.objects.get(first_name='Spy').business_id, mine.business.id,
            'the payload must not be able to place a customer in another tenant',
        )

    def test_transaction_direct_post_disallowed(self):
        owner = self.create_role_user('direct-admin', 'SUPERADMIN')
        grant(owner, 'OWNER')
        self.client.force_authenticate(user=owner)

        response = self.client.post('/api/transactions/', {}, format='json')
        self.assertEqual(response.status_code, 405)

    def test_void_restores_inventory_and_logs(self):
        user = self.create_role_user('void-admin', 'SUPERADMIN')
        grant(user, 'OWNER')
        branch = make_branch('Void Branch')
        item, inv = self._make_stocked_item(branch, 'Void Product', '100.00', 5)
        self.client.force_authenticate(user=user)

        checkout_res = self.client.post('/api/transactions/checkout/', {
            'branch': branch.id,
            'amount_paid': '100.00',
            'items': [{'item_type': 'PRODUCT', 'product': item.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(checkout_res.status_code, 201)
        inv.refresh_from_db()
        self.assertEqual(inv.stock_qty, 4)

        tx_id = checkout_res.data['id']
        void_res = self.client.post(
            f'/api/transactions/{tx_id}/void/',
            {'reason': 'Customer returned item'},
            format='json',
        )
        self.assertEqual(void_res.status_code, 200)
        self.assertEqual(void_res.data['status'], 'VOIDED')
        inv.refresh_from_db()
        self.assertEqual(inv.stock_qty, 5)

    def test_branch_admin_cannot_access_branch_comparison(self):
        branch = make_branch('Comparison Branch')
        user = self.create_role_user('comp-admin', 'BRANCH_ADMIN')
        grant(user, 'BUSINESS_MANAGER', branch=branch)
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/dashboard/branch_comparison/')
        self.assertEqual(response.status_code, 403)
