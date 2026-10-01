"""Write-side scoping tests: rows must stay visible to the user who created them.

``auto_scope`` filters business-scoped reads on the ``business`` column, so any
write that leaves ``business_id`` NULL becomes an invisible row — the API answers
201 and the list endpoint then hides it.  These are the tests that would have
caught that, plus the matching write-side cross-business guard.
"""

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient

from ..access.models import UserAccess
from ..business.models import Business, BusinessType
from ..models import Attendance, AuditLog, Branch, CustomerFeedback, Expense, RoomTable, UserProfile


class BusinessStampingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.spa_type, _ = BusinessType.objects.get_or_create(
            code='stamp-spa', defaults={'name': 'Stamp Spa', 'tracks_stock': False}
        )
        self.retail_type, _ = BusinessType.objects.get_or_create(
            code='stamp-retail', defaults={'name': 'Stamp Retail', 'tracks_stock': True}
        )
        self.spa = Business.objects.create(name='Stamp Spa Co', slug='stamp-spa-co', business_type=self.spa_type)
        self.retail = Business.objects.create(name='Stamp Retail Co', slug='stamp-retail-co', business_type=self.retail_type)
        self.spa_branch = Branch.objects.create(name='Stamp Spa Branch', business=self.spa)
        self.retail_branch = Branch.objects.create(name='Stamp Retail Branch', business=self.retail)

        self.manager = self._user('stamp-manager', 'BRANCH_ADMIN', self.spa_branch)
        UserAccess.objects.create(
            user=self.manager, role='BUSINESS_MANAGER', business=self.spa, is_primary=True
        )
        self.client.force_authenticate(user=self.manager)

    def _user(self, username, profile_role, branch=None):
        # §4.4: the group is the legacy capability fallback; scope/capability
        # come from the UserAccess grants each test attaches.
        user = User.objects.create_user(username=username, password='pw')
        user.groups.add(Group.objects.get_or_create(name=profile_role)[0])
        UserProfile.objects.create(user=user)
        return user

    # ---------- auto-stamping ----------

    def test_expense_created_by_business_user_is_stamped_and_visible(self):
        created = self.client.post('/api/expenses/', {
            'branch': self.spa_branch.id, 'category': 'RENT', 'description': 'Studio rent',
            'amount': '1200.00', 'expense_date': '2026-09-01',
        }, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        expense = Expense.objects.get()
        self.assertEqual(expense.business_id, self.spa.id, 'business must be stamped on write')

        listed = self.client.get('/api/expenses/')
        results = listed.data['results'] if isinstance(listed.data, dict) else listed.data
        self.assertEqual([e['id'] for e in results], [expense.id],
                         'creator must still see the row it just created')

    def test_room_created_by_business_user_is_stamped(self):
        created = self.client.post('/api/rooms/', {
            'branch': self.spa_branch.id, 'name': 'Stamp Room 1', 'room_type': 'MASSAGE',
        }, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(RoomTable.objects.get().business_id, self.spa.id)

    def test_feedback_created_by_business_user_is_stamped(self):
        created = self.client.post('/api/feedback/', {
            'branch': self.spa_branch.id, 'rating': 5, 'comment': 'Great',
        }, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(CustomerFeedback.objects.get().business_id, self.spa.id)

    def test_company_wide_writer_is_stamped_from_the_branch(self):
        owner = self._user('stamp-owner', 'SUPERADMIN')
        UserAccess.objects.create(user=owner, role='OWNER', business=None, is_primary=True)
        owner_client = APIClient()
        owner_client.force_authenticate(user=owner)

        created = owner_client.post('/api/expenses/', {
            'branch': self.retail_branch.id, 'category': 'UTILITIES', 'description': 'Power',
            'amount': '300.00', 'expense_date': '2026-09-02',
        }, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        # Company-wide grants carry no active business, so the branch decides.
        self.assertEqual(Expense.objects.get().business_id, self.retail.id)

    # ---------- write-side cross-business guard ----------

    def test_saving_to_another_business_branch_is_rejected(self):
        response = self.client.post('/api/expenses/', {
            'branch': self.retail_branch.id, 'category': 'RENT', 'description': 'Wrong outlet',
            'amount': '100.00', 'expense_date': '2026-09-01',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('branch', response.data)
        self.assertFalse(Expense.objects.exists())

    def test_saving_room_to_another_business_branch_is_rejected(self):
        response = self.client.post('/api/rooms/', {
            'branch': self.retail_branch.id, 'name': 'Wrong Room', 'room_type': 'VIP',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(RoomTable.objects.exists())
