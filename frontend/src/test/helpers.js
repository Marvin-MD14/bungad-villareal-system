/**
 * Canned API responses for the endpoints App.jsx loads on sign-in.
 *
 * These deliberately mirror the *real* serializer shapes, including the fields
 * that are null/empty in production. Every bug the frontend has had this
 * session was a null reaching code that assumed a value — so the fixtures keep
 * those nulls rather than papering over them.
 */
export const FIXTURES = {
  '/dashboard/summary/': {
    month_sales: '12500.00',
    revenue_trend: [
      { label: 'Mon', sales: '100.00', expenses: '10.00' },
      { label: 'Tue', sales: '200.00', expenses: '20.00' },
    ],
    top_services: [
      { name: 'Pedicure', quantity: 5 },
      { name: 'Foot Spa', quantity: 3 },
    ],
  },
  '/user-profiles/': [
    {
      id: 1, user: 11, user_id: 11, username: 'jane',
      first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com',
      phone_number: '0917', is_active: true, role: 'CASHIER', role_display: 'Cashier',
      branch: 1, branch_name: 'Main', created_at: '2026-01-01T00:00:00Z',
      access: [],
    },
    {
      // A deactivated account, and a profile with no branch/grant: the rows
      // that used to produce `NaN%` and an always-empty crew panel.
      id: 2, user: 12, user_id: 12, username: 'sam',
      first_name: 'Sam', last_name: 'Roe', email: null,
      phone_number: null, is_active: false, role: 'STAFF', role_display: 'Staff',
      branch: null, branch_name: 'Organization-wide', created_at: null,
      access: [],
    },
  ],
  '/catalog/items/?item_type=PRODUCT': [
    { id: 5, name: 'Shampoo', sku: 'SH-1', category_name: 'Cosmetics', selling_price: '250.00' },
  ],
  '/catalog/inventory/': [
    { id: 1, branch: 1, item: 5, stock_qty: 12 },
  ],
  // NOTE: no `value` key — AuditLog has no money field, and rendering one is
  // exactly the crash that reached the user.
  '/audit-logs/': [
    {
      id: 9, action: 'CREATE', model_name: 'Transaction', description: 'Sale recorded',
      request_id: 'abc123', ip_address: '127.0.0.1', created_at: '2026-01-02T03:04:05Z',
      user_name: 'jane', branch_name: 'Main',
    },
    {
      id: 8, action: 'LOGIN', model_name: 'User', description: null,
      request_id: null, ip_address: '10.0.0.1', created_at: '2026-01-01T00:00:00Z',
      user_name: null, branch_name: null,
    },
  ],
  '/rooms/': [
    {
      id: 1, branch: 1, branch_name: 'Main', name: 'Room 1', room_type: 'PEDICURE',
      is_occupied: true, customer_name: 'Ana', service_type: 'Pedicure & Manicure',
      start_time: '2026-01-01T00:00:00Z', duration_minutes: 30, time_remaining: 12,
      assigned_staff: 11, assigned_staff_name: 'jane', item: null, item_name: null,
    },
  ],
  '/branches/': [
    { id: 1, name: 'Main', code: 'MAIN', business_name: 'Spa Biz' },
    { id: 2, name: 'Second Outlet', code: 'SEC', business_name: 'Spa Biz' },
  ],
  '/auth/capabilities/': {
    role: 'SUPERADMIN',
    capabilities: [
      'dashboard', 'sales', 'clients', 'client_manage', 'customer_rewards',
      'administration', 'users', 'user_manage', 'rooms', 'room_manage',
      'inventory', 'inventory_manage', 'catalog', 'catalog_manage', 'audit',
      'documentation',
    ],
    roles: [
      { value: 'SUPERADMIN', label: 'Superadmin' },
      { value: 'OWNER', label: 'Owner' },
      { value: 'CASHIER', label: 'Cashier' },
      { value: 'STAFF', label: 'Staff' },
    ],
  },
}

/** Signs in by seeding what handleLogin writes to localStorage. */
export function seedSignedInUser(overrides = {}) {
  const user = {
    username: 'demo_superadmin', role: 'Superadmin', is_superuser: true, ...overrides,
  };
  localStorage.setItem('authToken', 'test-token');
  localStorage.setItem('authUser', JSON.stringify(user));
  localStorage.setItem('authBusinesses', JSON.stringify([{ slug: 'spa-biz', name: 'Spa Biz' }]));
  localStorage.setItem('activeBusiness', 'spa-biz');
  return user;
}

