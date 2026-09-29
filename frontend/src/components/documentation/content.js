// Structured content for the in-app Documentation page (Sidebar -> Documentation).
// Plain data so the renderer in ../DocumentationPage.jsx stays small and every section
// looks identical. Keep in sync with SYSTEM_DOCUMENTATION.md at the repository root:
// that file is the engineer-facing spec, this one is the handbook used inside the app.
//
// Block shapes: p (paragraph) | ul (bullets) | steps | t (table: head + rows) |
// code (monospace) | note (callout: info | warn | ok | danger). Text supports **bold**.

export const DOC_META = {
  product: 'Bungad & Villareal Management System',
  version: '2.0 - multi-business SaaS core',
  updated: 'September 2026',
  source: 'SYSTEM_DOCUMENTATION.md',
};

const FOUNDATION = [
  {
    id: 'overview',
    title: 'What this system is',
    group: 'Foundations',
    summary: 'One installation, many businesses, isolated data, shared staff.',
    blocks: [
      {
        t: 'p',
        v: 'Bungad & Villareal (B&V) is a multi-business management system. One Django installation and one database serve every business the company owns, and each business behaves like its own private app: its own catalog, prices, clients, staff, rooms, daily sales and stock. No business can read another business data through the API.',
      },
      {
        t: 'p',
        v: 'The SaaS word for that is **tenancy**. Here the tenant is the **Business** row - not the branch, and not the whole company. Permissions, catalog, inventory and sales all hang off that single decision.',
      },
      { t: 't', head: ['Layer', 'Model', 'Meaning', 'Examples'], rows: [
        ['Top', '**Company**', 'Owns the whole installation. Kept to exactly one row.', 'Bungad & Villareal Group'],
        ['Tenant', '**Business** + **BusinessType**', 'An operating unit with its own catalog, clients and staff.', 'VSS (Spa), VREAL (Store), BB (Food & Beverage)'],
        ['Location', '**Branch**', 'A physical site. Belongs to exactly one business.', 'Main Branch, Mall Branch'],
        ['Person', '**UserAccess**', 'One user grant inside one business: role + branch scope.', 'Ana = Cashier at Mall Branch'],
      ] },
      {
        t: 'note',
        kind: 'info',
        v: 'A new kind of business needs no new code: add a **BusinessType** row (say code **garage**, unit **session**, tracks stock) and point a new **Business** at it.',
      },
      { t: 't', head: ['BusinessType field', 'Meaning', 'Examples'], rows: [
        ['**code**', 'Unique slug used by imports and screens', '**spa**, **restaurant**, **auto-shop**'],
        ['**name**', 'Label shown to staff', 'Spa & Wellness'],
        ['**icon**', 'A lucide icon name the menu can render', '**Sparkles**'],
        ['**default_unit**', 'Unit pre-filled on new items', '**pc**, **session**, **hour**'],
        ['**tracks_stock**', 'Whether this kind of business counts stock by default', 'true for a store, false for pure services'],
        ['**is_active**', 'Retire a kind without deleting history', 'false on a closed concept'],
      ] },
      {
        t: 'p',
        v: 'Catalog definitions are shared, prices are not. One **Item** row per real product or service exists for the whole company, while every price is a **BusinessItem** row and every stock number is an **InventoryLevel** row. That is how the same shampoo can cost 499 at VREAL and be bundled free at VSS without duplicating the product.',
      },
      { t: 'ul', v: [
        'Backend: **Django 5.2** with Django REST Framework, SQLite in development, PostgreSQL in production.',
        'Frontend: **React 19** + Vite single page app, Tailwind CSS, axios, recharts, lucide icons.',
        'Auth: DRF **Token** authentication plus a request **BusinessMiddleware** that decides which business a call belongs to.',
        'Two documents: this page for daily use, and **SYSTEM_DOCUMENTATION.md** in the repository for architecture, migrations and deployment.',
      ] },
    ],
  },
  {
    id: 'hierarchy',
    title: 'Organizing businesses and branches',
    group: 'Foundations',
    summary: 'Create a business, add branches, decide what it tracks.',
    blocks: [
      { t: 'steps', v: [
        'Sign in as **Superadmin** and open **Administration**.',
        'Create or confirm the **BusinessType** you need (Spa, Store, Restaurant) and tick the flags that match how that kind of business runs.',
        'Create the **Business**: a name plus a short unique **slug**. The slug identifies the business in the API and in the switcher, so keep it short and permanent (vss, vreal, bb).',
        'Add **Branches** under that business. A branch can never be shared between businesses.',
        'Grant staff through **User Access** (next section), then load the catalog and the opening stock.',
      ] },
      {
        t: 'p',
        v: 'The **slug** matters more than it looks. The seed importers write their rows against a fixed slug (**vss**, **vreal**), the API reads it from the **X-Business** header, and the legacy catalog routes use it to decide which items to list. Renaming a slug silently moves data into a different tenant.',
      },
      {
        t: 'note',
        kind: 'warn',
        v: 'Branches are not tenants. Do not model a second business as extra branches of one business: they would share the catalog and the reports, and staff could not be scoped properly.',
      },
      {
        t: 'p',
        v: 'Anything written through the API is stamped with the active business automatically. You set the business indirectly, by switching the active one; you almost never fill a business field by hand.',
      },
    ],
  },
];

const PEOPLE = [
  {
    id: 'roles',
    title: 'Roles and what each one can do',
    group: 'People',
    summary: 'Five roles, enforced server-side, mirrored in the menu.',
    blocks: [
      {
        t: 'p',
        v: 'Five roles exist: **Superadmin**, **Owner**, **Branch Admin**, **Cashier**, **Staff**. Older names are normalised on the way in (**ADMIN** becomes Branch Admin, **MANAGER** becomes Owner, **STAFF** becomes Cashier) so existing rows keep working.',
      },
      {
        t: 'p',
        v: 'Every request answers two independent questions. **May this role perform this action at all** is answered by the role matrix, shared by the API and the Django admin. **Which rows may they see** is answered by the branch grants on their access row in the active business. A Cashier therefore has rights on sales, but only for the branches of the business they are acting on right now.',
      },
      { t: 't', head: ['Capability', 'Superadmin', 'Owner', 'Branch Admin', 'Cashier', 'Staff'], rows: [
        ['Read own-business dashboard, sales, clients', 'yes', 'yes', 'yes', 'yes', 'read only'],
        ['POS checkout, take payment', 'yes', 'no', 'no', 'yes', 'no'],
        ['Void or refund a sale', 'yes', 'no', 'yes', 'no', 'no'],
        ['Receive or adjust stock', 'yes', 'no', 'yes', 'no', 'no'],
        ['Write the own-business catalog', 'yes', 'no', 'yes', 'no', 'no'],
        ['Users, branches, business settings', 'yes', 'no', 'no', 'no', 'no'],
        ['Cross-business reporting', 'yes', 'no', 'no', 'no', 'no'],
      ] },
      {
        t: 'note',
        kind: 'danger',
        v: 'The menu is a convenience, not a security control. The sidebar hides links with a client-side capability map in **App.jsx**, while the server re-checks every call. Hiding a button never grants or removes a right.',
      },
      {
        t: 'p',
        v: 'Owner is intentionally read-only on writes. If an owner must edit something today, use a Branch Admin account for that branch, or grant Superadmin temporarily.',
      },
    ],
  },
  {
    id: 'access',
    title: 'Users, access grants and switching business',
    group: 'People',
    summary: 'One account, many businesses, branch-scoped rights.',
    blocks: [
      {
        t: 'p',
        v: 'A login account (**User**) and a profile (**UserProfile**) describe the person. What they may do inside a business lives in a separate **UserAccess** row: the role there, the branches they may touch, whether it is their primary business, and whether the assignment is active. The same person can be a Cashier at VSS and a Branch Admin at VREAL.',
      },
      { t: 'steps', v: [
        'As Superadmin, open **Administration** and create the user and profile.',
        'Create one **UserAccess** row per business the person works in.',
        'Set the role for that business, then tick only the branches they actually work at. Leaving branches empty means every branch of that business.',
        'Tick **is_primary** on exactly one row: that business opens after login.',
        'Use **is_active** to pause an assignment without deleting history.',
      ] },
      {
        t: 'p',
        v: 'Login returns your profile plus a **businesses** list, marked with the primary one. From then on the backend picks the active business for each call in this order:',
      },
      { t: 'steps', v: [
        'An explicit **X-Business: <slug>** header, used only when you hold an active grant for that slug.',
        'Otherwise your **primary** access row.',
        'Failing that, your first active grant, so a session is never left without a business at all.',
      ] },
      {
        t: 'code',
        lang: 'bash',
        v: '# act on another business you belong to\ncurl -H "Authorization: Token <token>" -H "X-Business: vreal" \\\n     http://localhost:8000/api/transactions/',
      },
      {
        t: 'note',
        kind: 'warn',
        v: 'A header naming a business you do not belong to is ignored rather than rejected: the server logs Ignored X-Business header and continues on your primary business. If switching appears to do nothing, check your **UserAccess** rows first.',
      },
      {
        t: 'p',
        v: 'The middleware also builds a request scope: active business, allowed branch ids, whether the caller is cross-business, acting role and branch ids. Permissions and querysets read that scope instead of re-deriving it.',
      },
      {
        t: 'note',
        kind: 'info',
        v: 'Token requests resolve the user after middleware runs, so the scope is recomputed on first use. That is why token and session calls behave identically without duplicating the logic.',
      },
    ],
  },
];

const OPERATIONS = [
  {
    id: 'catalog',
    title: 'Catalog, items and prices',
    group: 'Operations',
    summary: 'One item definition per product, one price per business.',
    blocks: [
      {
        t: 'p',
        v: 'The catalog is three tables. **Item** is the company-wide definition (name, sku, barcode, unit, type). **Category** is a shared hierarchy with an optional parent and a business-kind hint used for grouping in reports. **BusinessItem** is the only price tag: one row per business and item, holding the selling price, an optional category override, and whether this business actually sells it.',
      },
      { t: 't', head: ['item_type', 'Typical use', 'Notes'], rows: [
        ['**PRODUCT**', 'Bottles, retail goods, consumables', 'Counted at checkout only when the item has **tracks_stock**'],
        ['**SERVICE**', 'Massage, facial, haircut', 'Often flagged **requires_room** and **requires_staff**, and carries a duration'],
      ] },
      {
        t: 'p',
        v: 'Those are the only two kinds today, and the checkout endpoint rejects anything else. Bundles and memberships are modelled as ordinary items for now; a real package model is still open work.',
      },
      {
        t: 'p',
        v: 'A branch catalog is derived, never stored: it is the **BusinessItem** rows of that branch business where the item is active. That is what the POS loads, so the moment a business item is created or repriced the POS list changes - no per-branch editing step in between.',
      },
      {
        t: 'code',
        lang: 'http',
        v: 'GET /api/catalog/branch-catalog/by-branch/3/\n-> { branch: 3, branch_name: "...", branch_type: "vss",\n     branch_type_display: "VSS", items: [ { id, name, price, item_type, ... } ] }',
      },
      {
        t: 'note',
        kind: 'warn',
        v: 'The old screens (VSS Services, VREAL Products, BB Products, Auto Spa, Yum) are read-only shims over the same data. Their URLs, payload field names and permissions did not change, so they still work, but new work should use **/api/catalog/**.',
      },
      {
        t: 'p',
        v: 'To sell an existing item in a new business, create a **BusinessItem** for it with the price for that business. Do not create a second **Item**: that would split reporting, and the item would stop matching on sku or barcode.',
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory: balances and the ledger',
    group: 'Operations',
    summary: 'Stock levels are a balance; every change is a ledger row.',
    blocks: [
      {
        t: 'p',
        v: 'Two tables carry stock, and reading them together is the whole point. **InventoryLevel** is the current balance for one item in one branch (unique per branch and item). **StockMovement** is the ledger: one row per change, recording **quantity_delta** (signed), **balance_after**, a **reason** and free-text **reference**, plus who and when.',
      },
      { t: 't', head: ['reason', 'Written when', 'Direction'], rows: [
        ['**SALE**', 'A POS or sales checkout decrements stock', 'negative'],
        ['**RECEIVE**', 'Stock received against a delivery or invoice', 'positive'],
        ['**ADJUST**', 'A count correction, breakage or loss', 'either'],
        ['**VOID**', 'A voided sale puts the units back', 'positive'],
        ['**TRANSFER_IN / TRANSFER_OUT**', 'Branch-to-branch moves (endpoint not built yet)', 'positive / negative'],
      ] },
      { t: 'steps', v: [
        '**Receive stock**: post the quantity and a reference (delivery or invoice number) to the branch level. The balance goes up and a **RECEIVE** row is appended. A quantity of zero or less is rejected.',
        '**Sell**: stock goes down inside the same database transaction as the sale, so a failed sale never leaves stock missing. Each line appends a **SALE** row.',
        '**Void**: the units go back with a **VOID** row, and the money moves from total sales into total void for that day.',
        '**Correct a count**: the **adjust_stock()** service takes the counted quantity, works out the signed delta, refuses a negative balance and appends an **ADJUST** row. It is reachable from code and the admin today, not from a public endpoint yet - see Known gaps.',
      ] },
      {
        t: 'code',
        lang: 'http',
        v: 'GET  /api/catalog/inventory/?branch=3              balances for one branch\nPOST /api/catalog/inventory/12/restock/            { "quantity": 24, "reference": "DLV-2041" }\nGET  /api/catalog/stock-movements/?item=12         the ledger behind a balance\n\n# legacy equivalents, still live: /api/branch-inventory/ and .../{id}/restock/',
      },
      {
        t: 'note',
        kind: 'danger',
        v: 'The ledger is append-only. Stock must never be corrected by editing a number directly, because then the balance and the movements stop agreeing and nobody can explain the difference. The Django admin registers stock movements as read-only for exactly this reason - even a superuser cannot add, edit or delete a ledger row there.',
      },
      {
        t: 'p',
        v: 'How to read it during a count: take the balance, list the movements for that branch and item, and confirm the deltas add up to the balance. If they do not, something wrote stock outside the intended paths and that write is the bug.',
      },
      {
        t: 'note',
        kind: 'ok',
        v: 'Whether a line is counted comes from the item itself: **tracks_stock** is true for goods and normally false for services, so a massage never blocks a sale over stock while the shampoo sold alongside it does.',
      },
    ],
  },
];

const MONEY = [
  {
    id: 'sales',
    title: 'Ring up a sale (POS and checkout)',
    group: 'Money',
    summary: 'What the till sends, what comes back, and what can fail.',
    blocks: [
      {
        t: 'p',
        v: 'Every sale - spa service or retail bottle - goes through one function: **checkout()** in **api/sales/services.py**. It runs inside a single database transaction, so the sale, its lines, the stock changes, the daily total and the loyalty update either all happen or none do.',
      },
      { t: 'steps', v: [
        'If an idempotency key was sent and a sale already exists with it, that original sale is returned unchanged - no second sale.',
        'Each line is resolved through **BusinessItem** of the branch business, which is where the price comes from. An item that business does not sell is rejected.',
        'Line names and unit prices are copied onto the sale line, so an old receipt still reads correctly after a reprice.',
        'Items with **tracks_stock** are decremented with a guarded update; if the stock is not there the whole sale is rolled back.',
        'Tier discount and any selected rewards are applied, then the total is floored at zero.',
        'The sale is written with **status PAID**, a generated **transaction_number**, points earned and the tier held at purchase.',
        'The branch **DailySales** row for today is updated and the customer totals are refreshed.',
        'One **StockMovement** ledger row is appended per stock-tracked line.',
      ] },
      { t: 't', head: ['Field', 'Meaning', 'Notes'], rows: [
        ['**branch**', 'Which branch is selling', 'Required. Also decides the business and the price list'],
        ['**items**', 'Lines: item id, quantity, item_type', 'Quantity must be 1 or more; type must be PRODUCT or SERVICE'],
        ['**customer**', 'Client profile id', 'Optional; omit it and use customer_name for a walk-in'],
        ['**customer_name**', 'Walk-in name', 'A profile is created automatically, starting at Bronze'],
        ['**discount**', 'Manual discount in pesos', 'Must not be negative'],
        ['**amount_paid**', 'Cash or e-wallet taken', 'Must cover the final total, otherwise the sale is refused'],
        ['**reward_ids**', 'Reward ids to honour', 'Each must still be AVAILABLE for that customer'],
        ['**apply_tier_discount**', 'Apply the tier percentage', 'True by default; switch off for a negotiated price'],
        ['**notes**', 'Free text on the sale', 'The POS writes the payment method here, for example Payment: GCASH'],
      ] },
      {
        t: 'code',
        lang: 'http',
        v: 'POST /api/transactions/checkout/\nIdempotency-Key: 7f3a9c11-...        (or send "idempotency_key" in the body)\n\n{ "branch": 3, "customer": 12, "amount_paid": 750, "discount": 0,\n  "apply_tier_discount": true, "reward_ids": [],\n  "items": [ { "item": 8, "quantity": 1, "item_type": "SERVICE" },\n             { "item": 21, "quantity": 2, "item_type": "PRODUCT" } ],\n  "notes": "Payment: GCASH" }\n\n-> 201 { "id": 88, "transaction_number": "TXN-20260929-1A2B3C4D",\n         "subtotal": "750.00", "discount": "75.00", "total": "675.00",\n         "points_earned": "6.75", "status": "PAID", "items": [ ... ] }',
      },
      {
        t: 'p',
        v: 'The receipt number is generated by the server as **TXN-YYYYMMDD-XXXXXXXX** and is unique. Never invent one on the device: two tills picking the same number would fail at save time.',
      },
      {
        t: 'note',
        kind: 'info',
        v: 'Idempotency is what makes a flaky network safe. Generate a fresh key per attempted sale and reuse it on retries only. If a request times out, resend it exactly and you get the original sale back instead of a duplicate.',
      },
      {
        t: 'note',
        kind: 'warn',
        v: 'Cashiers, staff and branch admins can only sell for the branch on their own profile. Selling elsewhere returns 403 You can only transact for your assigned branch - that is a scope problem, not a password problem.',
      },
    ],
  },
  {
    id: 'voids',
    title: 'Voids, refunds and the audit trail',
    group: 'Money',
    summary: 'One call restores stock, moves the money and records who did it.',
    blocks: [
      {
        t: 'p',
        v: 'A void is not a delete. The original sale stays on the record; the void flips it to **VOIDED** and writes compensating entries so the numbers still add up at closing time.',
      },
      { t: 'steps', v: [
        'Stock for every stock-tracked line goes back with a **VOID** ledger row.',
        'The amount moves out of that day **total_sales** into **total_void**, so closing reports show both.',
        'The sale is marked **VOIDED** and the reason is appended to the notes.',
        'An audit entry records who voided which receipt and why.',
      ] },
      {
        t: 'code',
        lang: 'http',
        v: 'POST /api/transactions/88/void/\n{ "reason": "customer left, no service given" }\n\n-> 200 the voided transaction   |   400 { "detail": "Transaction is already voided." }',
      },
      {
        t: 'note',
        kind: 'danger',
        v: 'Only a Branch Admin or Superadmin may void. Always send a reason: the audit log and receipt history are the only evidence of why money left the till, and a second void is refused with Transaction is already voided.',
      },
      {
        t: 'p',
        v: 'Points earned on a voided sale are not clawed back automatically, and rewards already claimed are not released. Check the customer balance after voiding a large sale.',
      },
    ],
  },
];

const CUSTOMERS = [
  {
    id: 'loyalty',
    title: 'Clients, tiers and rewards',
    group: 'Money',
    summary: 'Points from spend, tier discounts, rewards that can be honoured.',
    blocks: [
      {
        t: 'p',
        v: 'A client is a **ClientProfile**: contact details, lifetime spend, points, tier and free items waiting. Clients belong to the business they were created in, so the same phone number at two businesses is two separate profiles.',
      },
      { t: 't', head: ['Tier', 'Lifetime spend', 'Discount at checkout'], rows: [
        ['**Bronze**', 'from 0', '0%'],
        ['**Silver**', 'from 1,000', '5%'],
        ['**Gold**', 'from 5,000', '10%'],
        ['**Platinum**', 'from 10,000', '15%'],
      ] },
      { t: 'ul', v: [
        '**Points**: each sale adds **total / 100** points, so a 6,750 peso sale earns 67.5 points. Points record loyalty; they are not spent automatically.',
        '**Free items**: every full 5,000 pesos inside a single sale adds one free item to the balance.',
        '**Tier discount**: a percentage off the subtotal, applied when **apply_tier_discount** is true. The tier held at purchase is stored on the sale.',
        '**Rewards**: voucher style rows carrying a discount percentage. At checkout each selected reward must still be AVAILABLE for that customer and is marked CLAIMED once used.',
        '**Upgrades**: crossing a threshold recalculates the tier and creates a welcome notification for the new tier.',
      ] },
      {
        t: 'code',
        lang: 'http',
        v: 'GET  /api/clients/search/?q=0917\nGET  /api/clients/find_by_phone/?phone=0917\nPOST /api/clients/                     { "first_name": "...", "phone_number": "..." }\nGET  /api/customer-tier/by-customer/12/\nGET  /api/clients/12/transactions/          GET /api/clients/12/tier_info/\nGET  /api/customer-rewards/by_customer/?customer=12\nPOST /api/customer-detection/detect/        { "query": "Ana" }   -> matching profiles',
      },
      {
        t: 'note',
        kind: 'ok',
        v: 'The Customer Rewards screen gathers all of it in one place: profile, tier progress, points, free items, reward history and recent visits.',
      },
    ],
  },
  {
    id: 'rooms',
    title: 'Rooms and floor status',
    group: 'Money',
    summary: 'Branch-owned rooms with a live occupancy clock.',
    blocks: [
      {
        t: 'p',
        v: 'Rooms (**RoomTable**) belong to a branch and carry a type: Pedicure & Manicure, Foot Spa, Massage Room or VIP. A room records whether it is occupied, when it started, for how many minutes, which staff member is on it, and the guest name and service in progress.',
      },
      { t: 'ul', v: [
        '**Check in**: post a duration (30 minutes if omitted), the guest name, the service and the staff member. The start time is stamped by the server, and a room already in use is rejected.',
        '**Check out**: clears occupancy, start time, duration, guest and staff in one call, returning the room to the free list.',
        '**Time remaining** is computed from the start time and the duration rather than stored, so a card cannot drift out of date.',
        '**Scope**: the room list, the available list and the occupied list are filtered to the branches you may see.',
        'Catalog items marked **requires_room** consume a room; **requires_staff** marks those needing a therapist.',
      ] },
      {
        t: 'code',
        lang: 'http',
        v: 'GET  /api/rooms/        GET /api/rooms/available/     GET /api/rooms/occupied/\nPOST /api/rooms/4/check_in/    { "duration_minutes": 60, "customer_name": "Ana",\n                                 "service_type": "Foot spa", "assigned_staff": 7 }\nPOST /api/rooms/4/check_out/\n\n# 400 { "detail": "Room is already occupied." } when checking into a busy room',
      },
      {
        t: 'note',
        kind: 'warn',
        v: 'There is no booking calendar yet: occupancy is a live status, not a schedule. Advance reservations are on the roadmap (see Known gaps below).',
      },
    ],
  },
  {
    id: 'reporting',
    title: 'Day close, dashboards and audit',
    group: 'Money',
    summary: 'One DailySales row per branch per day; the audit log is separate.',
    blocks: [
      {
        t: 'p',
        v: '**DailySales** holds exactly one row per branch per day (enforced by a unique constraint) with **total_sales**, **total_expenses**, **total_void** and **transaction_count**. Sales add to it, expenses add to another column rather than subtracting, and voids move money from sales into the void column instead of erasing it.',
      },
      {
        t: 'p',
        v: 'That separation is what makes a day closeable: gross sales, what went out, and what was cancelled stay visible as three numbers rather than one net figure nobody can question.',
      },
      { t: 'ul', v: [
        '**Dashboard summary** answers today, seven days and thirty days, scoped to your branches.',
        '**Branch comparison** compares branches inside a business you belong to.',
        '**Expenses summary** totals what went out for the period, kept apart from sales rather than netted off.',
        '**Audit logs** are append-only records of sensitive actions: sales, voids, price changes, staff status changes, logins and logouts, each with the ip address.',
      ] },
      {
        t: 'code',
        lang: 'http',
        v: 'GET /api/dashboard/summary/\nGET /api/dashboard/branch_comparison/\nGET /api/transactions/today/          GET /api/transactions/stats/\nGET /api/daily-sales/?branch=3        GET /api/expenses/summary/\nGET /api/audit-logs/recent/',
      },
      {
        t: 'note',
        kind: 'info',
        v: 'If a day total looks wrong, do not edit the number. Find the transaction or expense that caused it, correct it through its own screen, and the daily row follows.',
      },
    ],
  },
];

const BUILDING = [
  {
    id: 'api',
    title: 'Calling the API (developer guide)',
    group: 'Building',
    summary: 'Token auth, paging, limits and the routes that matter.',
    blocks: [
      {
        t: 'p',
        v: 'Base URL: **http://localhost:8000/api** in development. Interactive references live at **/api/docs/** (Swagger) and **/api/redoc/**, generated from the code so they cannot drift. The machine-readable copy is committed as **backend/schema.yml**.',
      },
      { t: 'steps', v: [
        'Sign in: **POST /api/auth/login/** with a username and password.',
        'Keep the **token** from the response; every later call sends **Authorization: Token <token>**.',
        'Read **businesses** and **primary_business** from the same response; the app keeps them and shows a **Business** picker when the account belongs to more than one.',
        'Send **X-Business: <slug>** to work in a business other than your primary one. The SPA attaches it to every call (**utils/session.js**), so only hand-written clients need to add it by hand.',
        'Logout invalidates the token, so a new login is required afterwards.',
      ] },
      { t: 'ul', v: [
        'Everything requires authentication by default; there is no anonymous read.',
        'List responses are paged with page-size **50**: expect **{ count, next, previous, results }** and follow **next** until it is null.',
        'Limits: 100 requests per minute per anonymous IP, 1000 per user, and **login is capped at 10 per minute per IP**.',
        'Errors come back as **{ "detail": "human readable reason" }**; validation failures may also carry a per-field list.',
        'Money is a string decimal in JSON (for example "675.00"), never a float - parse it as a decimal.',
      ] },
      {
        t: 'code',
        lang: 'bash',
        v: '# 1. sign in, then reuse the token\ncurl -s -X POST http://localhost:8000/api/auth/login/ \\\n     -H "Content-Type: application/json" \\\n     -d \'{"username":"demo_cashier","password":"..."}\'\n\ncurl -H "Authorization: Token $TOKEN" http://localhost:8000/api/branches/\ncurl -H "Authorization: Token $TOKEN" "http://localhost:8000/api/catalog/inventory/?branch=3"',
      },
      { t: 't', head: ['Area', 'Routes'], rows: [
        ['Auth', '**POST /auth/login/** · **POST /auth/logout/** · **GET /user-profiles/me/**'],
        ['Tenancy', '**/businesses/** · **/business-types/** · **/branches/** · **/user-access/**'],
        ['Catalog', '**/catalog/items/** · **/catalog/categories/** · **/catalog/business-items/** · **GET /branch-catalog/by-branch/{id}/**'],
        ['Stock', '**/catalog/inventory/** · **POST /catalog/inventory/{id}/restock/** · **/catalog/stock-movements/**'],
        ['Sales', '**POST /transactions/checkout/** · **/transactions/** · **POST /transactions/{id}/void/** · **GET /transactions/today/** · **GET /transactions/stats/**'],
        ['Clients', '**/clients/** · **/clients/search/** · **/clients/find_by_phone/** · **/customer-tier/by-customer/{id}/** · **/customer-rewards/** · **/customer-detection/detect/**'],
        ['Rooms', '**/rooms/** · **/rooms/available/** · **/rooms/occupied/** · **POST /rooms/{id}/check_in/** · **POST /rooms/{id}/check_out/**'],
        ['Reports', '**/dashboard/summary/** · **/dashboard/branch_comparison/** · **/daily-sales/** · **/expenses/** · **/expenses/summary/**'],
        ['People', '**/attendance/** · **/user-profiles/** · **/branches/{id}/staffing/**'],
        ['Governance', '**/audit-logs/** · **/audit-logs/recent/** · **/notifications/customer_alerts/**'],
      ] },
      {
        t: 'note',
        kind: 'warn',
        v: 'The per-business catalog routes (**/vss-services/**, **/vreal-products/**, **/bb-products/**, **/auto-spa/**, **/kb-items/**, **/panganan-menus/**, **/products/**, **/branch-inventory/**) are compatibility shims so existing screens keep working. Build new screens on **/catalog/** instead; the shims are scheduled for removal.',
      },
      {
        t: 'p',
        v: 'Setup steps for a fresh workstation or a new server are in the next section; the route table above is what you need day to day.',
      },
    ],
  },
  {
    id: 'setup',
    title: 'Setting up a workstation or server',
    group: 'Building',
    summary: 'Backend, seed data, frontend, and what changes for production.',
    blocks: [
      { t: 'steps', v: [
        'Create and activate a virtual environment inside **backend/** (Windows: **py -3 -m venv .venv**, then **.venv\\Scripts\\Activate.ps1**).',
        'Install dependencies: **python -m pip install -r requirements.txt**.',
        'Copy **backend/.env.example** to **backend/.env** and fill in at least **DJANGO_SECRET_KEY**, **DJANGO_DEBUG** and **DJANGO_ALLOWED_HOSTS**.',
        'Apply the schema: **python manage.py migrate**.',
        'Create the company, the default business types and the starter businesses: **python manage.py bootstrap_company**. It is idempotent, so re-running it is safe.',
        'Seed catalogs and logins in one go with **python manage.py setup_demo_data**, or step by step: **python manage.py import_vss_services <file>** and **python manage.py import_vreal_products <file>** (a description-and-price table), then **python manage.py create_demo_users**.',
        'Create your own administrator login: **python manage.py createsuperuser**.',
        'Check the system: **python manage.py check**, then **python manage.py test api** - that suite is the guard rail for business isolation and the stock ledger.',
        'Run the backend with **python manage.py runserver**, and the frontend from **frontend/** with **npm install** then **npm run dev**.',
      ] },
      { t: 't', head: ['Variable', 'Purpose', 'Notes'], rows: [
        ['**DJANGO_SECRET_KEY**', 'Signing key', 'The development fallback must never reach production'],
        ['**DJANGO_DEBUG**', 'Debug mode', '**True** locally, **False** in production'],
        ['**DJANGO_ALLOWED_HOSTS**', 'Comma separated host names', 'Unrestricted only while debugging'],
        ['**CORS_ALLOWED_ORIGINS**', 'Origins allowed to call the API', 'Comma separated, for example **http://localhost:5173**'],
        ['**SECURE_SSL_REDIRECT**', 'Force HTTPS when not debugging', 'Defaults to **True** once **DJANGO_DEBUG=False**'],
        ['**SECURE_HSTS_SECONDS**', 'HSTS lifetime', 'One year by default when not debugging'],
      ] },
      {
        t: 'note',
        kind: 'danger',
        v: 'The frontend hard-codes its API base URL (**http://localhost:8000/api** in **App.jsx** and several pages) and stores the token in **localStorage**. Both must move into configuration and safer storage before this is reachable from the internet.',
      },
      { t: 'ul', v: [
        'Before a release run **python manage.py check --deploy** and read every warning.',
        'The development database is SQLite (**backend/db.sqlite3**); production targets PostgreSQL, which is where concurrent tills get real row locking.',
        'Generated files are ignored on purpose (**.venv**, **__pycache__**, **db.sqlite3**, **node_modules**, **dist**). Do not commit them.',
      ] },
    ],
  },
];

const TROUBLE = [
  {
    id: 'troubleshooting',
    title: 'Troubleshooting and the messages you will see',
    group: 'Support',
    summary: 'What the server says, what it actually means, what to do.',
    blocks: [
      { t: 't', head: ['Message or symptom', 'What it really means', 'What to do'], rows: [
        ['**Invalid username or password.** (401)', 'Wrong credentials, or the account was deactivated', 'Check the account is active; login is limited to 10 attempts per minute per IP'],
        ['**Authentication credentials were not provided.** (401)', 'No token, or it was cleared and never re-sent', 'Sign in again; the SPA stores the token under **authToken**'],
        ['**You do not have permission ...** (403)', 'Role is not allowed that action, or the row is outside your branch scope', 'Check the role on your access row, then the branch ticks - not the password'],
        ['**You can only transact for your assigned branch.** (403)', 'Checkout posted to a branch other than the profile branch', 'Have a branch admin move the profile or grant the correct branch'],
        ['**Insufficient stock for <item>.** (400)', 'A stock-tracked line has no stock at that branch', 'Receive stock for that branch, or remove the line - stock is per branch, not company-wide'],
        ['**Quantity must be at least 1.** (400)', 'A line arrived with a zero or blank quantity', 'Remove the empty line before sending the sale'],
        ['**Item <id> is not available for this business.** (400)', 'The catalog row is not priced for this business, or is inactive', 'Create or re-enable the **BusinessItem** for this business'],
        ['**Each item needs a valid type, id and quantity.** (400)', 'A line is missing **item_type**, or the type is not PRODUCT or SERVICE', 'Send the item id, quantity and one of the two allowed types'],
        ['**Payment is less than the transaction total.** (400)', 'The amount tendered does not cover the final total after discounts', 'Re-check the tendered cash; discounts and tier percentage land before this test'],
        ['**Transaction is already voided.** (400)', 'A second void was attempted on the same receipt', 'Nothing to do - the first void already stands, and it is in the audit log'],
        ['**Quantity received must be positive.** / **Quantity must be positive.** (400)', 'Receive stock was sent zero or a negative number', 'Use a positive quantity to receive; losses are recorded as a negative adjustment instead'],
        ['**Stock quantity cannot be negative.** (400)', 'An adjustment would push the balance below zero', 'Recount, or receive the missing stock first'],
        ['Data does not change when I switch business', 'You have no active access row for that business, so the header was ignored', 'A Superadmin must add a **UserAccess** row for you in that business'],
        ['The POS list is empty at a branch', 'No **BusinessItem** rows exist for that business, or all are inactive', 'Add the items this business sells and mark them available'],
        ['Everything reads as 404', 'The backend is not running, or the base URL points at the wrong port', 'Confirm the API answers at **http://localhost:8000/api/** first'],
        ['Browser blocks the request (CORS)', 'The frontend origin is not listed in **CORS_ALLOWED_ORIGINS**', 'Add the origin (for example **http://localhost:5173**) and restart the server'],
        ['Two receipts for one sale', 'No idempotency key was sent, and the first response never arrived', 'Send a fresh key per attempted sale and reuse it when retrying'],
      ] },
      {
        t: 'note',
        kind: 'info',
        v: 'Order of blame that solves most tickets: is the token valid, is the role right, is the branch in scope, is the row in this business. Those four answer almost everything, and each has its own screen.',
      },
    ],
  },
];

const GOVERNANCE = [
  {
    id: 'integrity',
    title: 'Rules that keep the numbers honest',
    group: 'Support',
    summary: 'The invariants, and the habits that protect them.',
    blocks: [
      { t: 't', head: ['Invariant', 'How it is enforced', 'What breaks without it'], rows: [
        ['A sale and its stock never disagree', 'One database transaction around checkout; guarded decrement', 'Stock sold twice, or units that vanished'],
        ['Stock balances can be explained line by line', 'The **StockMovement** ledger is append-only and read-only in the Django admin', 'A balance nobody can reconcile at stock take'],
        ['A retried request is not a second sale', 'Unique **idempotency_key** on the sale; replay returns the original', 'Duplicate receipts on a flaky network'],
        ['One day close per branch', 'Unique branch and date on **DailySales**, updated through a locked row', 'Two competing totals for the same day'],
        ['A business cannot see another business', 'Every query is filtered by the request scope, proven by a dedicated test suite', 'Someone else clients and takings leaking across the counter'],
        ['Names on old receipts do not change', 'Item name and unit price are copied onto the sale line', 'Yesterday receipt showing today price'],
      ] },
      { t: 'ul', v: [
        'Do: correct stock with receive and adjust operations, so a movement explains the change.',
        'Do: give each attempted sale its own idempotency key and reuse it on retry.',
        'Do: add a second business to a test when you add an endpoint, so isolation is proven, not assumed.',
        'Do not: edit a stock number directly, or delete a sale to make a report match.',
        'Do not: rename a business slug, or reuse an old slug for a different business.',
        'Do not: copy a price into another business as a new item; add a business price instead.',
      ] },
      {
        t: 'note',
        kind: 'ok',
        v: 'These rules are tested: **python manage.py test api** covers business isolation, the checkout engine, the immutability of the stock ledger through the Django admin and the permission matrix - 33 tests. If one fails, the invariant is broken and belongs fixed in code, not patched in the database.',
      },
    ],
  },
  {
    id: 'gaps',
    title: 'Known gaps and what is coming next',
    group: 'Support',
    summary: 'An honest list of what today does not do.',
    blocks: [
      {
        t: 'note',
        kind: 'ok',
        v: 'Recently closed: the header now carries a **Business** picker for accounts that belong to more than one business, and both tills stamp an **Idempotency-Key** on every attempted sale.',
      },
      { t: 't', head: ['Gap', 'Effect today', 'Planned direction'], rows: [
        ['Two role systems coexist', 'Capabilities are keyed on the legacy profile role while scope uses the access grant, so a manager can be scoped correctly yet lack rights', 'Key capabilities on the active access grant, derive the profile role from it, then retire the column'],
        ['Sales screen on legacy routes', 'The compatibility shims stay alive longer than intended', 'Point it at **/catalog/items/** plus business prices'],
        ['No bookings calendar', 'Rooms hold a live status only; advance reservations happen off-system', 'Add a reservation model with time slots, then require one where the business needs it'],
        ['No branch-to-branch transfer', 'Stock moves are recorded as an adjustment out plus a receive in', 'A transfer pair that writes both ledger sides atomically'],
        ['Owner cannot write', 'Owners must borrow a branch admin account to make changes', 'Decide the intended owner contract and align the matrix'],
        ['Frontend configuration', 'Hard-coded API URLs and a token kept in localStorage', 'Environment-driven base URL and a safer session strategy'],
      ] },
      {
        t: 'note',
        kind: 'info',
        v: 'This list mirrors the roadmap section of **SYSTEM_DOCUMENTATION.md**. Fix one, update both.',
      },
    ],
  },
];

const GLOSSARY = [
  {
    id: 'glossary',
    title: 'Glossary',
    group: 'Support',
    summary: 'The words this manual uses, in one place.',
    blocks: [
      { t: 't', head: ['Term', 'Meaning here'], rows: [
        ['**Business**', 'A tenant: one company operation with its own clients, staff, prices and reports. Has a unique slug.'],
        ['**BusinessType**', 'The kind of business (spa, store, restaurant). Carries a code, an icon, a default unit and whether it tracks stock.'],
        ['**Branch**', 'A physical location of one business. Stock, rooms and daily totals live here.'],
        ['**UserAccess**', 'One person assignment inside one business: role, allowed branches, primary flag, active flag.'],
        ['**Active business**', 'The business a request operates on, chosen from the header, the body, the posted branch, or your primary grant.'],
        ['**Scope**', 'The rows you may see: your allowed branches inside the active business.'],
        ['**Item**', 'A company-wide catalog definition, either PRODUCT or SERVICE. Carries **tracks_stock**, unit, duration, and whether it needs staff or a room.'],
        ['**BusinessItem**', 'The price of an item for one business, plus whether that business sells it.'],
        ['**InventoryLevel**', 'The current stock balance for one item at one branch.'],
        ['**StockMovement**', 'One immutable ledger line: signed delta, resulting balance, reason, reference, actor, timestamp.'],
        ['**Ledger, append-only**', 'Data you may add to but never edit or delete, so history stays explainable.'],
        ['**Idempotency key**', 'A unique label for one attempted write, so a retry cannot create a second record.'],
        ['**Snapshot**', 'A copy of a name or price stored on the transaction, so old documents keep reading correctly.'],
        ['**Void**', 'A compensating reversal of a sale: stock returns, money moves to the void column, the original stays.'],
        ['**Token**', 'The string returned at login and sent as **Authorization: Token ...** on later calls.'],
        ['**Shim route**', 'An old URL kept alive on purpose so existing screens work while the new routes take over.'],
      ] },
      {
        t: 'note',
        kind: 'info',
        v: 'Something missing or out of date here? This page is a file in the repository: **frontend/src/components/documentation/content.js**. Editing it needs no backend change and no migration.',
      },
    ],
  },
];

export const SECTIONS = [
  ...FOUNDATION,
  ...PEOPLE,
  ...OPERATIONS,
  ...MONEY,
  ...CUSTOMERS,
  ...BUILDING,
  ...TROUBLE,
  ...GOVERNANCE,
  ...GLOSSARY,
];








