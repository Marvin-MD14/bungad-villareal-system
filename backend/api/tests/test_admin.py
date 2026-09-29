"""Admin guards for the SaaS models.

The stock ledger is documented as append-only (SYSTEM_DOCUMENTATION.md section 6.2), so the admin
must not be a way around that rule - not even for a superuser.
"""

from django.contrib.auth.models import User
from django.test import TestCase

from ..business.models import Business, BusinessType
from ..catalog.models import Category, InventoryLevel, Item, StockMovement
from ..models import Branch


class StockMovementAdminTests(TestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser('admin-root', password='pw')
        self.client.force_login(self.superuser)

        business_type = BusinessType.objects.create(code='adm', name='Admin Type')
        business = Business.objects.create(name='Admin Biz', slug='admin-biz',
                                          business_type=business_type)
        branch = Branch.objects.create(name='Admin Branch', business=business)
        category = Category.objects.create(name='Admin Goods', kind='PRODUCT')
        item = Item.objects.create(item_type='PRODUCT', category=category, name='Ledger Widget',
                                   selling_price='10.00', tracks_stock=True, unit='pc')
        InventoryLevel.objects.create(branch=branch, item=item, stock_qty=5)
        self.movement = StockMovement.objects.create(
            branch=branch, item=item, quantity_delta=5, reason='RECEIVE',
            balance_after=5, created_by=self.superuser,
        )

    def test_ledger_is_visible_in_admin(self):
        response = self.client.get('/admin/api/stockmovement/')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Ledger Widget')

    def test_ledger_rows_cannot_be_created(self):
        response = self.client.post('/admin/api/stockmovement/add/', {})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(StockMovement.objects.count(), 1)

    def test_ledger_rows_are_view_only_in_admin(self):
        url = f'/admin/api/stockmovement/{self.movement.pk}/change/'
        response = self.client.get(url)
        # A superuser may read the row (Django grants every view_* permission), but the form is
        # rendered without any save control.
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="_save"')

    def test_ledger_rows_cannot_be_edited(self):
        url = f'/admin/api/stockmovement/{self.movement.pk}/change/'
        response = self.client.post(url, {'quantity_delta': 999, 'reason': 'WASTE'})
        self.assertEqual(response.status_code, 403)
        self.movement.refresh_from_db()
        self.assertEqual(self.movement.quantity_delta, 5)
        self.assertEqual(self.movement.reason, 'RECEIVE')

    def test_ledger_rows_cannot_be_deleted(self):
        response = self.client.post(f'/admin/api/stockmovement/{self.movement.pk}/delete/')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(StockMovement.objects.filter(pk=self.movement.pk).exists())

    def test_bulk_delete_action_keeps_the_rows(self):
        self.client.post('/admin/api/stockmovement/', {
            'action': 'delete_selected',
            '_selected_action': [self.movement.pk],
        })
        self.assertTrue(StockMovement.objects.filter(pk=self.movement.pk).exists())
