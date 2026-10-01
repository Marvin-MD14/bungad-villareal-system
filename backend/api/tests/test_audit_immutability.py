"""Audit-trail completeness (§7.7) and money-row immutability (§7.5)."""

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient

from ..access.models import UserAccess
from ..business.models import Business, BusinessType
from ..models import AuditLog, Branch, Transaction, UserProfile


class AuditTrailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        btype, _ = BusinessType.objects.get_or_create(code='audit-bt', defaults={'name': 'Audit BT'})
        self.business = Business.objects.create(name='Audit Biz', slug='audit-biz', business_type=btype)
        self.branch = Branch.objects.create(name='Audit Branch', business=self.business)
        self.user = User.objects.create_user(username='audit-admin', password='pw')
        self.user.groups.add(Group.objects.get_or_create(name='BRANCH_ADMIN')[0])
        UserProfile.objects.create(user=self.user)
        UserAccess.objects.create(
            user=self.user, role='BUSINESS_MANAGER', business=self.business, is_primary=True
        )
        self.client.force_authenticate(user=self.user)

    def _post_expense(self):
        return self.client.post(
            '/api/expenses/',
            {'branch': self.branch.id, 'category': 'SUPPLIES', 'description': 'Towels',
             'amount': '250.00', 'expense_date': '2026-09-05'},
            format='json',
            HTTP_USER_AGENT='BungadPOS/1.4 (Windows)',
        )

    def test_write_is_correlated_by_request_id(self):
        response = self._post_expense()
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response['X-Request-ID'], 'response must echo the request id')

        log = AuditLog.objects.get(action='CREATE', model_name='Expense')
        self.assertEqual(log.request_id, response['X-Request-ID'])
        self.assertEqual(log.user_agent, 'BungadPOS/1.4 (Windows)')
        self.assertEqual(log.business_id, self.business.id, 'audit row carries the business')

    def test_provided_request_id_is_reused(self):
        response = self.client.post(
            '/api/expenses/',
            {'branch': self.branch.id, 'category': 'RENT', 'description': 'Correlated',
             'amount': '10.00', 'expense_date': '2026-09-05'},
            format='json', HTTP_X_REQUEST_ID='proxy-given-id-123',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response['X-Request-ID'], 'proxy-given-id-123')
        self.assertEqual(AuditLog.objects.get(description__contains='Expense').request_id,
                         'proxy-given-id-123')

    def test_transaction_cannot_be_hard_deleted(self):
        txn = Transaction.objects.create(
            transaction_number='TXN-AUDIT-1', branch=self.branch, business=self.business,
            transaction_type='SALE', subtotal=100, discount=0, total=100,
            amount_paid=100, change=0, status='PAID',
        )
        # A scoped manager is denied by the role matrix …
        scoped = self.client.delete(f'/api/transactions/{txn.id}/')
        self.assertEqual(scoped.status_code, 403)
        # … and even an unrestricted superuser is stopped by the view itself.
        root = User.objects.create_superuser(username='audit-root', password='pw')
        root_client = APIClient()
        root_client.force_authenticate(user=root)
        response = root_client.delete(f'/api/transactions/{txn.id}/')
        self.assertEqual(response.status_code, 405)
        self.assertTrue(Transaction.objects.filter(pk=txn.id).exists())
