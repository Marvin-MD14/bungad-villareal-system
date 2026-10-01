"""
Role guide: what each role can see, can do, and where it lands.

The guide drives the login-screen preview and the in-app "My access" panel.
Its page and action lists are derived from ``ui_capabilities_for`` — the same
live matrix every request is judged against — so these tests pin the parts
that are promises to a human: the landing tab, the scope wording, and the
fact that the endpoint is reachable without a token (the login screen has
none yet).
"""
from django.test import TestCase

from api.access.models import UserAccess
from api.permissions import role_guide_for, ui_capabilities_for


class RoleGuideTests(TestCase):

    def test_endpoint_is_reachable_without_a_token(self):
        response = self.client.get('/api/auth/role-guide/')
        self.assertEqual(response.status_code, 200)

    def test_every_assignable_role_gets_a_guide(self):
        response = self.client.get('/api/auth/role-guide/')
        guides = response.data['guides']
        # Keyed by role code — the shape the SPA looks up and the OpenAPI
        # schema declares (an object, not an array).  Order still follows
        # ROLE_CHOICES.
        self.assertEqual(list(guides), [code for code, _label in UserAccess.ROLE_CHOICES])
        for entry in guides.values():
            for key in ('sees', 'does', 'lands_on', 'scope'):
                self.assertIn(key, entry)

    def test_pages_and_actions_follow_the_live_matrix(self):
        response = self.client.get('/api/auth/role-guide/')
        guides = response.data['guides']
        for code, _label in UserAccess.ROLE_CHOICES:
            self.assertEqual(guides[code]['capabilities'], ui_capabilities_for(code))

    def test_cashier_guide_points_at_the_register(self):
        guide = role_guide_for('CASHIER')
        self.assertIn('Sales & POS', guide['sees'])
        self.assertIn('Room Status', guide['sees'])
        self.assertNotIn('Administration', guide['sees'])
        self.assertNotIn('Audit Logs', guide['sees'])
        self.assertEqual(guide['lands_on'], 'sales')
        self.assertTrue(any('checkout' in verb for verb in guide['does']))
        self.assertTrue(any('shift' in verb for verb in guide['does']))

    def test_staff_guide_keeps_money_out_of_view(self):
        guide = role_guide_for('STAFF')
        self.assertNotIn('Sales & POS', guide['sees'])
        self.assertNotIn('Inventory', guide['sees'])
        self.assertNotIn('Administration', guide['sees'])
        self.assertIn('Room Status', guide['sees'])
        self.assertEqual(guide['lands_on'], 'rooms')

    def test_superadmin_guide_covers_the_whole_nav(self):
        guide = role_guide_for('SUPERADMIN')
        for label in ('Dashboard', 'Sales & POS', 'Administration', 'Audit Logs',
                      'User Profiling', 'Inventory'):
            self.assertIn(label, guide['sees'])
        self.assertEqual(guide['lands_on'], 'dashboard')

    def test_legacy_role_names_resolve_to_their_guide(self):
        self.assertEqual(role_guide_for('Branch Admin')['role'], 'BUSINESS_MANAGER')
        self.assertEqual(role_guide_for('Cashier')['role'], 'CASHIER')
