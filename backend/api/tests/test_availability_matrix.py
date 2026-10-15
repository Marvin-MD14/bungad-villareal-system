"""Tests for the availability matrix endpoint."""

from decimal import Decimal
from django.contrib.auth.models import User
from rest_framework.test import APIClient, APITestCase
from api.access.models import UserAccess
from api.business.models import Business, BusinessType
from api.catalog.models import Category, Item, BusinessItem
from api.models import Branch


class AvailabilityMatrixTests(APITestCase):
    """Test the GET /catalog/availability-matrix/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        # Create business type
        self.business_type, _ = BusinessType.objects.get_or_create(
            code='mat-spa', defaults={'name': 'Matrix Spa', 'default_unit': 'session'}
        )
        # Create businesses
        self.business1 = Business.objects.create(
            name='Matrix Spa Biz', slug='matrix-spa-biz', business_type=self.business_type,
        )
        self.business2 = Business.objects.create(
            name='Matrix Retail Biz', slug='matrix-retail-biz', business_type=self.business_type,
        )
        # Create category
        self.category = Category.objects.create(name='Matrix Services', kind='SERVICE')
        # Create items
        self.item1 = Item.objects.create(
            name='Matrix Massage', item_type='SERVICE', category=self.category,
            selling_price=Decimal('500.00'),
        )
        self.item2 = Item.objects.create(
            name='Matrix Facial', item_type='SERVICE', category=self.category,
            selling_price=Decimal('400.00'),
        )
        self.item3 = Item.objects.create(
            name='Matrix Manicure', item_type='SERVICE', category=self.category,
            selling_price=Decimal('300.00'),
        )
        # Create BusinessItems (item availability)
        self.bi1 = BusinessItem.objects.create(
            business=self.business1, item=self.item1, is_available=True,
        )
        self.bi2 = BusinessItem.objects.create(
            business=self.business1, item=self.item2, is_available=False,
            price_override=Decimal('450.00'),
        )
        self.bi3 = BusinessItem.objects.create(
            business=self.business2, item=self.item1, is_available=True,
            price_override=Decimal('550.00'),
        )
        # item3 is NOT available in any business
        # Create company-wide user (OWNER)
        self.owner = User.objects.create_user(username='mat_owner', password='pass')
        UserAccess.objects.create(user=self.owner, role='OWNER', business=None)
        # Create business-scoped user
        self.manager = User.objects.create_user(username='mat_manager', password='pass')
        UserAccess.objects.create(user=self.manager, role='BUSINESS_MANAGER', business=self.business1)

    def test_company_wide_user_sees_all_businesses(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get('/api/catalog/availability-matrix/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        business_ids = {b['id'] for b in data['businesses']}
        self.assertIn(self.business1.pk, business_ids)
        self.assertIn(self.business2.pk, business_ids)

    def test_business_scoped_user_sees_only_their_business(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.get('/api/catalog/availability-matrix/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        business_ids = {b['id'] for b in data['businesses']}
        self.assertEqual(business_ids, {self.business1.pk})

    def test_matrix_shows_availability_per_business(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get('/api/catalog/availability-matrix/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item1_data = next((i for i in data['items'] if i['id'] == self.item1.pk), None)
        self.assertIsNotNone(item1_data)
        availability = {a['business_id']: a for a in item1_data['business_availability']}
        self.assertTrue(availability[self.business1.pk]['is_available'])
        self.assertEqual(Decimal(str(availability[self.business1.pk]['effective_price'])), Decimal('500.00'))
        self.assertTrue(availability[self.business2.pk]['is_available'])
        self.assertEqual(Decimal(str(availability[self.business2.pk]['effective_price'])), Decimal('550.00'))

    def test_matrix_shows_unavailable_items(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get('/api/catalog/availability-matrix/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item3_data = next((i for i in data['items'] if i['id'] == self.item3.pk), None)
        self.assertIsNotNone(item3_data)
        for avail in item3_data['business_availability']:
            self.assertFalse(avail['is_available'])
            self.assertIsNone(avail['business_item_id'])

    def test_search_filter(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get('/api/catalog/availability-matrix/?search=Matrix+Massage')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data['items']), 1)
        self.assertEqual(data['items'][0]['name'], 'Matrix Massage')

    def test_business_filter(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f'/api/catalog/availability-matrix/?business={self.business1.pk}')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data['businesses']), 1)
        self.assertEqual(data['businesses'][0]['id'], self.business1.pk)

    def test_effective_price_shows_override_or_default(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get('/api/catalog/availability-matrix/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        item2_data = next((i for i in data['items'] if i['id'] == self.item2.pk), None)
        self.assertIsNotNone(item2_data)
        availability = {a['business_id']: a for a in item2_data['business_availability']}
        self.assertEqual(
            Decimal(str(availability[self.business1.pk]['price_override'])), Decimal('450.00')
        )
        self.assertEqual(
            Decimal(str(availability[self.business1.pk]['effective_price'])), Decimal('450.00')
        )
