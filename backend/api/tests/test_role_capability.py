"""Capability comes from the ``UserAccess`` grant (§6.3), not the legacy profile.

``UserProfile.role`` used to be the only input to ``RoleBasedPermission``, so a
user whose grant said BUSINESS_MANAGER while their old profile said STAFF could
not do their job — and, in reverse, a stale profile kept privileges alive after
every grant was revoked.  These tests pin the new precedence, the wildcard
denials for each business role, and the fail-closed behaviour of revoked grants.
"""

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient

from ..access.models import UserAccess
from ..business.models import Business, BusinessType
from ..models import Branch, UserProfile


class GrantCapabilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        spa_type, _ = BusinessType.objects.get_or_create(code='cap-spa', defaults={'name': 'Cap Spa'})
        retail_type, _ = BusinessType.objects.get_or_create(code='cap-retail', defaults={'name': 'Cap Retail'})
        self.spa = Business.objects.create(name='Cap Spa', slug='cap-spa-co', business_type=spa_type)
        self.retail = Business.objects.create(name='Cap Retail', slug='cap-retail-co', business_type=retail_type)
        self.spa_branch = Branch.objects.create(name='Cap Spa Branch', business=self.spa)
        self.retail_branch = Branch.objects.create(name='Cap Retail Branch', business=self.retail)
        self.btype = retail_type

    def _user(self, username, profile_role, grants, primary_business=None):
        """``grants`` is a list of ``(role, business|None)`` tuples.

        §4.4 moved role/branch off UserProfile: the *group* carries the legacy
        capability fallback, and each ``(role, business)`` tuple is a UserAccess
        grant — the real source of scope and capability.
        """
        user = User.objects.create_user(username=username, password='pw')
        user.groups.add(Group.objects.get_or_create(name=profile_role)[0])
        UserProfile.objects.create(user=user)
        for role, business in grants:
            UserAccess.objects.create(
                user=user, role=role, business=business, is_primary=(business is primary_business),
            )
        return user

    def _expense(self, branch=None):
        return self.client.post('/api/expenses/', {
            'branch': (branch or self.spa_branch).id, 'category': 'SUPPLIES',
            'description': 'Oil', 'amount': '50.00', 'expense_date': '2026-09-08',
        }, format='json')

    # ---------- precedence ----------

    def test_legacy_profile_still_decides_when_there_is_no_grant(self):
        user = self._user('cap-legacy', 'STAFF', [])
        self.client.force_authenticate(user=user)
        self.assertEqual(self._expense().status_code, 403)  # STAFF may not post expenses

    def test_grant_role_overrides_a_stale_profile(self):
        user = self._user('cap-manager', 'STAFF', [('BUSINESS_MANAGER', self.spa)])
        self.client.force_authenticate(user=user)
        self.assertEqual(
            self._expense().status_code, 201,
            'the grant says Business Manager, so the stale STAFF profile must not block it')

    def test_the_active_business_picks_which_grant_applies(self):
        user = self._user(
            'cap-two', 'CASHIER',
            [('CASHIER', self.spa), ('BUSINESS_MANAGER', self.retail)],
            primary_business=self.spa,
        )
        self.client.force_authenticate(user=user)
        self.assertEqual(self._expense(self.spa_branch).status_code, 403,
                         'the primary grant is Cashier')

        self.client.credentials(HTTP_X_BUSINESS=self.retail.slug)
        self.assertEqual(self._expense(self.retail_branch).status_code, 201,
                         'switched to the business where the same user is Business Manager')

    def test_revoked_grants_lock_the_account_even_with_a_legacy_profile(self):
        user = self._user('cap-revoked', 'CASHIER', [('CASHIER', self.spa)])
        UserAccess.objects.filter(user=user).update(is_active=False)
        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.get('/api/transactions/').status_code, 403,
                         'a revoked grant must not fall back to the legacy profile')

    # ---------- wildcard denials per business role ----------

    def test_business_manager_cannot_reach_company_level_actions(self):
        user = self._user('cap-bm', 'STAFF', [('BUSINESS_MANAGER', self.spa)])
        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.post('/api/branches/', {'name': 'Nope'}).status_code, 403)
        self.assertEqual(
            self.client.post('/api/businesses/', {'name': 'Nope', 'slug': 'nope',
                                                  'business_type': self.btype.id}).status_code, 403)
        self.assertEqual(
            self.client.post('/api/user-access/', {'user': user.id, 'role': 'STAFF'}).status_code, 403)

    def test_supervisor_keeps_operations_but_not_catalog_writes(self):
        user = self._user('cap-sup', 'STAFF', [('SUPERVISOR', self.spa)])
        self.client.force_authenticate(user=user)
        self.assertEqual(self._expense().status_code, 201)
        self.assertEqual(
            self.client.post('/api/catalog/items/',
                             {'name': 'Nope', 'item_type': 'PRODUCT'}).status_code,
            403, 'a supervisor may adjust cost and stock, not add catalog items')

    def test_company_admin_spans_businesses_but_not_user_management(self):
        user = self._user('cap-ca', 'STAFF', [('COMPANY_ADMIN', None)])
        self.client.force_authenticate(user=user)
        created = self.client.post('/api/businesses/', {
            'name': 'Cap Admin Biz', 'slug': 'cap-admin-biz', 'business_type': self.btype.id,
        }, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(
            self.client.post('/api/user-access/', {'user': user.id, 'role': 'STAFF'}).status_code, 403)

    def test_accountant_reads_money_and_writes_expenses_but_never_sells(self):
        # ACCOUNTANT is a company-wide grant role, so it carries no business.
        user = self._user('cap-acct', 'STAFF', [('ACCOUNTANT', None)])
        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.get('/api/expenses/').status_code, 200)
        self.assertEqual(self._expense().status_code, 201)
        self.assertEqual(
            self.client.post('/api/transactions/checkout/', {
                'branch': self.spa_branch.id, 'amount_paid': '100.00',
                'items': [{'item_type': 'PRODUCT', 'product': 1, 'quantity': 1}],
            }, format='json').status_code, 403)

    def test_owner_grant_reaches_every_business(self):
        user = self._user('cap-owner', 'STAFF', [('OWNER', None)])
        self.client.force_authenticate(user=user)
        self.assertEqual(self.client.get('/api/branches/').status_code, 200)
        self.assertEqual(self.client.get(f'/api/expenses/?business={self.retail.id}').status_code, 200)
