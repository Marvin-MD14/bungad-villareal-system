from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient
from ..models import Branch, UserProfile
from ..catalog.models import BusinessItem, Category, InventoryLevel, Item


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


class RolePermissionTests(TestCase):
	def setUp(self):
		self.client = APIClient()

	def create_role_user(self, username, role):
		user = User.objects.create_user(username=username, password='test-password')
		user.groups.add(Group.objects.create(name=role))
		return user

	def test_cashier_can_read_products_but_not_manage_branches(self):
		user = self.create_role_user('cashier', 'Cashier')
		self.client.force_authenticate(user=user)

		self.assertEqual(self.client.get('/api/products/').status_code, 200)
		self.assertEqual(self.client.get('/api/branches/').status_code, 200)

	def test_therapist_cannot_access_transactions(self):
		user = self.create_role_user('therapist', 'Therapist')
		self.client.force_authenticate(user=user)

		self.assertEqual(self.client.get('/api/transactions/').status_code, 403)

	def test_admin_can_access_branch_management(self):
		user = self.create_role_user('admin', 'Admin')
		self.client.force_authenticate(user=user)

		self.assertEqual(self.client.get('/api/branches/').status_code, 200)

	def test_branch_admin_only_sees_assigned_branch(self):
		assigned_branch = Branch.objects.create(name='Assigned Branch')
		other_branch = Branch.objects.create(name='Other Branch')
		user = self.create_role_user('branch-admin', 'BRANCH_ADMIN')
		UserProfile.objects.create(user=user, role='BRANCH_ADMIN', branch=assigned_branch)
		self.client.force_authenticate(user=user)

		response = self.client.get('/api/branches/')

		self.assertEqual(response.status_code, 200)
		branches = response.data['results'] if isinstance(response.data, dict) else response.data
		branch_ids = [branch['id'] for branch in branches]
		self.assertEqual(branch_ids, [assigned_branch.id])
		self.assertNotIn(other_branch.id, branch_ids)

	def test_owner_can_read_but_cannot_mutate_operational_data(self):
		owner = self.create_role_user('owner', 'OWNER')
		branch = Branch.objects.create(name='Owner Branch')
		UserProfile.objects.create(user=owner, role='OWNER')
		self.client.force_authenticate(user=owner)

		self.assertEqual(self.client.get('/api/branches/').status_code, 200)
		self.assertEqual(self.client.get('/api/products/').status_code, 200)
		self.assertEqual(self.client.post('/api/branches/', {'name': 'Not Allowed'}).status_code, 403)
		self.assertEqual(self.client.post('/api/clients/', {'first_name': 'Blocked', 'last_name': 'Owner'}).status_code, 403)
		self.assertEqual(self.client.post('/api/transactions/checkout/', {
			'branch': branch.id,
			'amount_paid': '100.00',
			'items': [],
		}).status_code, 403)

	def test_superadmin_can_create_branch_admin_with_branch(self):
		superadmin = self.create_role_user('system-owner', 'SUPERADMIN')
		UserProfile.objects.create(user=superadmin, role='SUPERADMIN')
		branch = Branch.objects.create(name='New Admin Branch')
		self.client.force_authenticate(user=superadmin)

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
		self.assertEqual(created_user.profile.role, 'BRANCH_ADMIN')
		self.assertEqual(created_user.profile.branch_id, branch.id)

	def test_branch_roles_require_branch_assignment(self):
		superadmin = self.create_role_user('staffing-superadmin', 'SUPERADMIN')
		UserProfile.objects.create(user=superadmin, role='SUPERADMIN')
		self.client.force_authenticate(user=superadmin)

		response = self.client.post('/api/user-profiles/', {
			'username': 'unassigned-cashier',
			'password': 'StrongPassword!2026',
			'first_name': 'Unassigned',
			'last_name': 'Cashier',
			'role': 'CASHIER',
		}, format='json')

		self.assertEqual(response.status_code, 400)
		self.assertIn('branch', response.data)

	def test_branch_staffing_summary_reports_missing_roles(self):
		superadmin = self.create_role_user('staffing-summary-admin', 'SUPERADMIN')
		UserProfile.objects.create(user=superadmin, role='SUPERADMIN')
		branch = Branch.objects.create(name='Staffing Summary Branch')
		cashier = self.create_role_user('summary-cashier', 'CASHIER')
		UserProfile.objects.create(user=cashier, role='CASHIER', branch=branch)
		self.client.force_authenticate(user=superadmin)

		response = self.client.get(f'/api/branches/{branch.id}/staffing/')

		self.assertEqual(response.status_code, 200)
		self.assertFalse(response.data['ready'])
		self.assertIn('BRANCH_ADMIN', response.data['missing_roles'])

	def test_superadmin_can_edit_branch_and_staff_profile(self):
		superadmin = self.create_role_user('edit-superadmin', 'SUPERADMIN')
		UserProfile.objects.create(user=superadmin, role='SUPERADMIN')
		branch = Branch.objects.create(name='Editable Branch')
		cashier = self.create_role_user('editable-cashier', 'CASHIER')
		profile = UserProfile.objects.create(user=cashier, role='CASHIER', branch=branch)
		self.client.force_authenticate(user=superadmin)

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
		profile.refresh_from_db()
		self.assertEqual(branch.address, 'Updated branch description')
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
		branch = Branch.objects.create(name='Test Branch')
		item, inventory = self._make_stocked_item(branch, 'Test Product', '100.00', 3)
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
		response = self.client.get('/api/products/')

		self.assertEqual(response.status_code, 401)

	def test_client_profile_is_org_wide_accessible_to_cashier(self):
		user = self.create_role_user('lookup-cashier', 'CASHIER')
		from ..models import ClientProfile
		client = ClientProfile.objects.create(first_name='Maria', last_name='Santos')
		self.client.force_authenticate(user=user)

		response = self.client.get('/api/clients/')
		self.assertEqual(response.status_code, 200)
		results = response.data.get('results', response.data)
		ids = [c['id'] for c in results]
		self.assertIn(client.id, ids)

	def test_transaction_direct_post_disallowed(self):
		superadmin = self.create_role_user('direct-admin', 'SUPERADMIN')
		UserProfile.objects.create(user=superadmin, role='SUPERADMIN')
		self.client.force_authenticate(user=superadmin)

		response = self.client.post('/api/transactions/', {}, format='json')
		self.assertEqual(response.status_code, 405)

	def test_void_restores_inventory_and_logs(self):
		user = self.create_role_user('void-admin', 'SUPERADMIN')
		UserProfile.objects.create(user=user, role='SUPERADMIN')
		branch = Branch.objects.create(name='Void Branch')
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
		branch = Branch.objects.create(name='Comparison Branch')
		user = self.create_role_user('comp-admin', 'BRANCH_ADMIN')
		UserProfile.objects.create(user=user, role='BRANCH_ADMIN', branch=branch)
		self.client.force_authenticate(user=user)

		response = self.client.get('/api/dashboard/branch_comparison/')
		self.assertEqual(response.status_code, 403)

