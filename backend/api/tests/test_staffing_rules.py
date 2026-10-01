# backend/api/tests/test_staffing_rules.py
"""Staffing-rule enforcement: every unit keeps >=1 manager, exactly 1 cashier, >=2 staff.

The rules live in :mod:`api.access.staffing`; these tests drive the real API
paths that can change an outlet's cover — ``/api/user-access/`` (create,
patch, delete) and ``/api/user-profiles/`` (assign role, deactivate user) —
and the ``/api/branches/conformance/`` report.
"""

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient

from ..access.models import UserAccess
from ..business.models import Business, BusinessType
from ..models import Branch, UserProfile
from .test_api import grant


def make_enforcer(username):
    """A superuser SUPERADMIN account — the role allowed to mutate grants."""
    user = User.objects.create_user(
        username=username, password='pw', is_superuser=True,
    )
    user.groups.add(Group.objects.get_or_create(name='SUPERADMIN')[0])
    UserProfile.objects.create(user=user)
    return user


class StaffingFixtureMixin:
    """Shared fixture: one conforming outlet (1 manager, 1 cashier, 2 staff)."""

    def setUp(self):
        self.client = APIClient()
        self.owner = make_enforcer('staffing-enforcer')
        self.client.force_authenticate(user=self.owner)
        self.bt, _ = BusinessType.objects.get_or_create(
            code='staffing', defaults={'name': 'Staffing'})
        self.business = Business.objects.create(
            name='Staffing Co', slug='staffing-co', business_type=self.bt)
        self.outlet = Branch.objects.create(name='Main Outlet', business=self.business)
        # A conforming outlet: 1 manager, 1 cashier, 2 staff.
        self.manager = self.person('rule-mgr', 'BUSINESS_MANAGER', self.outlet)
        self.cashier = self.person('rule-cash', 'CASHIER', self.outlet)
        self.staff_a = self.person('rule-staffa', 'STAFF', self.outlet)
        self.staff_b = self.person('rule-staffb', 'STAFF', self.outlet)

    def person(self, username, role, branch):
        user = self.fresh_user(username)
        grant(user, role, branch=branch)
        return user

    def fresh_user(self, username):
        user = User.objects.create_user(username=username, password='pw')
        UserProfile.objects.create(user=user)
        return user

    def add_grant(self, user, role, branch_ids):
        return self.client.post('/api/user-access/', {
            'user': user.id, 'role': role, 'business': self.business.id,
            'branches': branch_ids,
        }, format='json')


class StaffingRulesTests(StaffingFixtureMixin, TestCase):
    # ---------------- create ----------------

    def test_second_cashier_rejected(self):
        extra = self.fresh_user('rule-extra-cashier')
        response = self.add_grant(extra, 'CASHIER', [self.outlet.id])
        self.assertEqual(response.status_code, 400)
        self.assertIn('Cashier', str(response.data))
        self.assertFalse(extra.access_grants.exists())

    def test_business_wide_cashier_rejected_when_any_outlet_has_one(self):
        extra = self.fresh_user('rule-wide-cashier')
        response = self.add_grant(extra, 'CASHIER', [])
        self.assertEqual(response.status_code, 400)
        self.assertIn('Main Outlet', str(response.data))

    def test_empty_outlet_can_be_staffed_step_by_step(self):
        """The ratchet lets a fresh outlet be staffed one grant at a time."""
        annex = Branch.objects.create(name='Annex', business=self.business)
        for role_tag, role in (
            ('cash', 'CASHIER'), ('s1', 'STAFF'), ('s2', 'STAFF'), ('mgr', 'BUSINESS_MANAGER'),
        ):
            user = self.fresh_user(f'rule-annex-{role_tag}')
            response = self.add_grant(user, role, [annex.id])
            self.assertEqual(response.status_code, 201, response.data)

    def test_manager_for_empty_outlet_allowed(self):
        annex = Branch.objects.create(name='Quiet Annex', business=self.business)
        user = self.fresh_user('rule-annex-mgr')
        response = self.add_grant(user, 'BUSINESS_MANAGER', [annex.id])
        self.assertEqual(response.status_code, 201, response.data)

    # ---------------- patch / deactivate ----------------

    def test_deactivate_last_cashier_rejected(self):
        access = self.cashier.access_grants.get()
        response = self.client.patch(f'/api/user-access/{access.id}/',
                                     {'is_active': False}, format='json')
        self.assertEqual(response.status_code, 400)
        access.refresh_from_db()
        self.assertTrue(access.is_active)

    def test_move_last_cashier_to_another_outlet_rejected(self):
        annex = Branch.objects.create(name='Moved-to Annex', business=self.business)
        access = self.cashier.access_grants.get()
        response = self.client.patch(f'/api/user-access/{access.id}/',
                                     {'branches': [annex.id]}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('Main Outlet', str(response.data))
        access.refresh_from_db()
        self.assertEqual(access.branch_ids(), [self.outlet.id])

    def test_staff_floor_blocks_reducing_to_one(self):
        third = self.fresh_user('rule-staffc')
        self.assertEqual(self.add_grant(third, 'STAFF', [self.outlet.id]).status_code, 201)
        # 3 -> 2 is fine…
        response = self.client.patch(
            f"/api/user-access/{self.staff_a.access_grants.get().id}/",
            {'is_active': False}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        # …but 2 -> 1 is not.
        response = self.client.patch(
            f"/api/user-access/{self.staff_b.access_grants.get().id}/",
            {'is_active': False}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('Staff', str(response.data))

    # ---------------- destroy ----------------

    def test_delete_last_cashier_rejected(self):
        access = self.cashier.access_grants.get()
        response = self.client.delete(f'/api/user-access/{access.id}/')
        self.assertEqual(response.status_code, 400)
        self.assertIn('Cashier', str(response.data))
        self.assertTrue(UserAccess.objects.filter(pk=access.pk).exists())

    def test_delete_last_manager_rejected(self):
        access = self.manager.access_grants.get()
        response = self.client.delete(f'/api/user-access/{access.id}/')
        self.assertEqual(response.status_code, 400)
        access.refresh_from_db()
        self.assertTrue(access.is_active)

    # ---------------- the /user-profiles/ flows ----------------

    def test_assigning_cashier_role_to_a_full_outlet_rejected(self):
        profile = UserProfile.objects.get(user=self.staff_a)
        response = self.client.patch(f'/api/user-profiles/{profile.id}/', {
            'role': 'CASHIER', 'branch': self.outlet.id,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('Cashier', str(response.data))
        self.assertFalse(self.staff_a.access_grants.filter(role='CASHIER').exists())

    def test_deactivating_last_cashier_account_rejected(self):
        profile = UserProfile.objects.get(user=self.cashier)
        response = self.client.patch(f'/api/user-profiles/{profile.id}/',
                                     {'is_active': False}, format='json')
        self.assertEqual(response.status_code, 400)
        self.cashier.refresh_from_db()
        self.assertTrue(self.cashier.is_active)


class ConformanceReportTests(StaffingFixtureMixin, TestCase):
    """GET /api/branches/conformance/ — the violations report."""

    def test_report_flags_understaffed_and_branchless_units(self):
        annex = Branch.objects.create(name='Bare Annex', business=self.business)
        # A business is created with a default 'Main' outlet; removing it turns
        # the business into a branch-less unit (the KB Items shape).
        kb = Business.objects.create(name='KB Pseudo', slug='kb-pseudo',
                                     business_type=self.bt)
        Branch.all_objects.filter(business=kb).delete()
        response = self.client.get('/api/branches/conformance/')
        self.assertEqual(response.status_code, 200)
        rows = {(row['business'], row['branch']): row for row in response.data['results']}
        main = rows[(self.business.name, 'Main Outlet')]
        self.assertTrue(main['conformed'])
        self.assertEqual(main['counts'],
                         {'BUSINESS_MANAGER': 1, 'CASHIER': 1, 'STAFF': 2})
        bare = rows[(self.business.name, annex.name)]
        self.assertFalse(bare['conformed'])
        self.assertEqual(len(bare['violations']), 3)
        branchless = rows[(kb.name, '(branch-less)')]
        self.assertFalse(branchless['conformed'])
        # Violations are per-unit, and the platform may carry other businesses —
        # assert membership, not absolute totals.
        violating = {(r['business'], r['branch']) for r in response.data['results']
                     if not r['conformed']}
        self.assertIn((self.business.name, annex.name), violating)
        self.assertNotIn((self.business.name, 'Main Outlet'), violating)
        self.assertEqual(response.data['summary']['units_total'],
                         len(response.data['results']))

    def test_report_denied_to_cashier(self):
        cashie = User.objects.create_user(username='peek-cashier', password='pw')
        cashie.groups.add(Group.objects.get_or_create(name='Cashier')[0])
        self.client.force_authenticate(user=cashie)
        self.assertEqual(self.client.get('/api/branches/conformance/').status_code, 403)

