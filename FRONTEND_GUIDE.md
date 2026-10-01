# Frontend Developer Guide — Bungad Villareal System API

Target audience: whoever builds the web POS / admin SPA against this Django REST
backend. Everything below is implemented **and covered by tests** as of
migration `0018`. Anything not listed here but present in `Compare_System.md`
is roadmap — see §11.

The machine-readable contract lives at **`GET /api/schema/`** (OpenAPI 3) with
interactive docs at **`/api/docs/`** (Swagger UI) and **`/api/redoc/`**.
Shortcuts redirect there: **`/docs/`**, `/redoc/`, `/schema/` (no `/api/`
prefix) 302 to the real pages. These URLs are served by the **Django backend**
(`:8000`) — asking your SPA dev server (Vite `:5173`, etc.) for `/docs/` will
404.
Run the backend: `cd backend && .venv/Scripts/python manage.py runserver`
(local DB is SQLite at `backend/db.sqlite3`; it auto-switches to PostgreSQL when
`DATABASE_URL=postgres://…` is set).

---

## 1. Conventions you must design around

| Rule | What it means for the UI |
| --- | --- |
| Every route is under `/api/` | e.g. `POST /api/transactions/checkout/` |
| Auth is `Authorization: Token <key>` | device tokens **expire** — handle 401 with "sign in again", not a silent retry |
| Tenant selection via `X-Business: <slug>` header | sent with every request after login; without it the server uses the user's *primary* grant |
| List endpoints are paginated | `{ "count": n, "next": url|null, "previous": url|null, "results": [...] }`, 50 per page — always read `results` |
| Errors are `{ "detail": "..." }` or `{ "<field>": ["..."] }` | show `detail` verbatim; field errors map onto form fields |
| Every response carries `X-Request-ID` | log it with client errors so support can trace the request server-side |
| Money is decimal-as-string in JSON | e.g. `"150.00"` — never `parseFloat` into arithmetic; use a decimal lib or integer centavos |
| Login throttle 10/min/IP; checkout throttled per user+till | surface 429 with a countdown; disable the button client-side too |

### Fail-closed multi-tenancy (why some lists come back empty)

Access = one `UserAccess` grant resolved per request. A user with **no grant**
sees *nothing* and gets 403 on writes. A business-scoped user only ever sees
rows of the active business (and, if the grant ticks specific branches, only
those branches). A `business` query param naming a *different* business returns
an **empty list** — it is neutralised, never honoured. So: an empty list is
meaningful UI state ("no records for this tenant/branch"), not a bug.

---

## 2. Auth flows

### Login — `POST /api/auth/login/`

```json
{ "username": "ana", "password": "***", "device_name": "Front Desk iPad" }
```

Response `200`:

```json
{
  "token": "a1b2c3…",
  "expires_at": "2026-09-30T18:00:00Z",
  "user": { "id": 4, "username": "ana", "role": "Cashier", "role_code": "CASHIER",
             "branch": { "id": 1, "name": "Main" }, "services": [],
             "is_staff": false, "is_superuser": false },
  "businesses": [ { "id": 2, "name": "Bungad Spa", "slug": "bungad-spa",
                    "type": "spa", "type_name": "Spa" } ],
  "primary_business": { "id": 2, "name": "Bungad Spa", "slug": "bungad-spa" }
}
```

Store `token`; if `businesses.length > 1` show a business switcher that sets
the `X-Business: <slug>` header and **re-fetches everything** when it changes —
the scope of every endpoint follows it.

### Session lifecycle

- `POST /api/auth/rotate-token/` — swap the current token for a fresh one
  (call at app open / before `expires_at`). Returns `{ "token": …, "expires_at": … }`.
- `POST /api/auth/logout/` — revokes the device token server-side.
- A token dies instantly if the password changes or an admin revokes it; the
  401 body says which ("Please sign in again" vs "password has changed").

### Capabilities — `GET /api/auth/capabilities/`

```json
{
  "role": "CASHIER",
  "capabilities": ["audit", "catalog", "clients", "customer_rewards",
                    "dashboard", "documentation", "inventory", "loyalty",
                    "payments", "rooms", "sales", "shifts", "users"],
  "roles": [ { "value": "SUPERADMIN", "label": "Superadmin" } ]
}
```

**Render the navigation from `capabilities` — never from a hardcoded role
list.** The backend derives them from the real permission matrix, so they
cannot drift. Keys: `dashboard, sales, clients, client_manage,
customer_rewards, rooms, room_manage, inventory, inventory_manage, catalog,
catalog_manage, users, user_manage, administration, audit, documentation,
payments, shifts, loyalty` (the last three are new: Payments history, Cashier
Shifts, Loyalty screens). `roles` feeds every role dropdown (grant/user forms).

---

## 3. Checkout — the endpoint that matters

`POST /api/transactions/checkout/`
Send an `Idempotency-Key: <uuid>` header (or `idempotency_key` in the body). A
retry with the same key returns the **original receipt** — safe on flaky
networks. Generate the key when the cart is first submitted; keep it until a
response arrives.

Request:

```json
{
  "branch": 1,
  "items": [ { "item": 12, "item_type": "PRODUCT", "quantity": 2 } ],
  "customer": 7,
  "discount": "0.00",
  "reward_ids": [],
  "apply_tier_discount": true,
  "notes": "",
  "payments": [
    { "method": "CASH",  "amount": "100.00", "tendered": "120.00" },
    { "method": "GCASH", "amount": "50.00",  "reference": "GC-999" }
  ],
  "shift": 3
}
```

- `item_type` ∈ `PRODUCT|SERVICE`; `item` is a catalog `Item` id (from
  `GET /api/branch-catalog/by-branch/1/`, the POS feed).
- `payments` is **optional** (split tenders): `amount`s must add up exactly to
  the receipt total; `tendered` defaults to `amount` (set it for cash handed
  over so change is computed per tender); `method` accepts a `PaymentMethod`
  id **or code** (`CASH/GCASH/MAYA/CARD` are provisioned per business). Omit
  `payments` entirely and legacy `amount_paid` becomes one CASH tender — old
  clients keep working untouched.
- `shift` optional: pin the sale to an open shift; omitted ⇒ the cashier's
  open shift at that branch is auto-attached (§4).
- Walk-in: send `customer_name` instead of `customer`; the server creates the
  profile.
- Loyalty: with a `customer`, tier discount applies automatically
  (`apply_tier_discount`), points earn per the business's loyalty program,
  `reward_ids` burns AVAILABLE rewards (see §6).

Response `201` (the receipt — render from this, don't recompute):

```json
{
  "id": 88, "transaction_number": "TXN-20260930-0042",
  "branch": 1, "branch_name": "Main", "customer": 7,
  "customer_name": "Ana Lim", "staff": 4, "staff_name": "ana",
  "transaction_type": "SALE", "status": "PAID", "shift": 3,
  "subtotal": "150.00", "discount": "0.00", "total": "150.00",
  "amount_paid": "170.00", "change": "20.00",
  "customer_tier_at_purchase": "BRONZE", "tier_discount_applied": "0.00",
  "points_earned": "1.50", "rewards_applied": [],
  "items": [ { "id": 91, "item_type": "PRODUCT", "item": 12,
               "description": "Test Candle", "unit_price": "75.00",
               "price": "75.00", "quantity": 2, "discount": "0.00",
               "total": "150.00", "product_name": "Test Candle",
               "service_name": "" } ],
  "payments": [
    { "id": 5, "method": 1, "method_code": "CASH",  "method_name": "Cash",
      "amount": "100.00", "tendered": "120.00", "change": "20.00",
      "reference": "" },
    { "id": 6, "method": 2, "method_code": "GCASH", "method_name": "GCash",
      "amount": "50.00", "tendered": "50.00", "change": "0.00",
      "reference": "GC-999" }
  ],
  "created_at": "2026-09-30T09:14:02Z"
}
```

Receipt numbers are now **sequential per business per day**
(`TXN-YYYYMMDD-0001…`) — display them, never parse them.

Errors to handle: `400` (unknown item/branch, stock short, payments don't add
up, unknown payment method), `403` (branch not assigned to this cashier),
`429` (throttle). `POST /transactions/` and `DELETE /transactions/{id}/` are
deliberately **405** — corrections go through `POST /transactions/{id}/void/`
(body `{ "reason": "…" }`), which restores stock, moves the daily total into
voids, and reverses earned loyalty points as a new ledger entry.

---

## 4. Cashier shifts (open → sell → close)

| Call | Purpose |
| --- | --- |
| `POST /api/cashier-shifts/open/` `{ "branch": 1, "opening_float": "500.00" }` | open the till; `409` (with the existing `shift`) if one is already open |
| `GET /api/cashier-shifts/current/` | `{ "shift": {…} }` or `{ "shift": null }` — on POS boot: if null, prompt to open |
| `GET /api/cashier-shifts/` | scoped list of shifts (every status — filter `status === "OPEN"` client-side; page size 50). Managers can pin one cashier with `current/?staff=<id>` |
| `POST /api/cashier-shifts/{id}/close/` `{ "closing_cash": "700.00" }` | count the drawer; response carries `expected_cash` and `over_short` |
| `GET /api/payments/?shift={id}` / `?transaction={id}` | tender drill-down per shift or per receipt |
| `GET /api/payment-methods/` | tender list to render the checkout buttons (per business; CRUD for managers) |

Rules the UI should reflect:

- One open shift per staff **and** branch (DB-enforced; API answers `409`).
- Sales and their tenders attach to the open shift **automatically** — do not
  make cashiers pick a shift per sale.
- Closing computes `expected_cash = opening_float + Σ cash-tender amounts`
  (GCash/Card never touch the drawer). `over_short = counted − expected`;
  render it green (over) / red (short).
- Only the shift owner or a manager can close it (`403` otherwise); closing an
  already-closed shift is `409`.
- Suggested boot sequence: `current/` → open if null → enable checkout.
- Shift object:

```json
{ "id": 3, "business": 2, "branch": 1, "branch_name": "Main",
  "staff": 4, "staff_name": "ana", "status": "CLOSED",
  "opening_float": "500.00", "opened_at": "…", "closed_at": "…",
  "closing_cash": "700.00", "expected_cash": "650.00",
  "over_short": "50.00", "notes": "" }
```

---

## 5. Payments history — `GET /api/payments/`

Read-only ledger of every tender (`POST`/`PATCH`/`DELETE` are 405 for every
role). Supported filters: `?transaction=<id>` and `?shift=<id>`; tenant
scoping is automatic. One row per tender, so a split payment shows as multiple
rows — group by `transaction` in the UI.

```json
{ "count": 3, "next": null, "previous": null, "results": [ … Payment objects … ] }
```

Use it for the end-of-day report: cash total = Σ `amount` where
`method_code=CASH`; e-wallet total = GCash+Maya rows; card total = CARD rows.

---

## 6. Loyalty — how the client should present it

### What the UI reads

| Call | Returns |
| --- | --- |
| `GET /api/clients/{id}/` | profile incl. `loyalty_points`, `total_spent`, `loyalty_tier`, `tier_display`, `discount_rate`, `next_tier_info`, `free_items_available`, `available_rewards_count` (loyalty values are cached-but-derived and **read-only** on the API — checkout owns them) |
| `GET /api/loyalty-programs/` | earning rules for the tenant: `earn_amount`, `redeem_value`, `free_item_threshold`, `points_valid_days`, `is_active` |
| `GET /api/loyalty-programs/for-current-business/` | the active tenant's program, auto-created with defaults on first call |
| `GET /api/loyalty-ledger/?customer={id}` | append-only point history, newest first (read-only for every role) |

Ledger row (`points` is **signed**: + earns, − deductions):

```json
{ "id": 12, "business": 2, "customer": 7, "customer_name": "Ana Lim",
  "branch": 1, "transaction": 88, "transaction_number": "TXN-…",
  "entry_type": "EARN", "entry_type_display": "Earned on sale",
  "points": "1.50", "balance_after": "12.50",
  "reason": "Earned on TXN-20260930-0042",
  "created_by": 4, "created_by_name": "ana", "created_at": "…" }
```

`entry_type` ∈ `EARN | REDEEM | ADJUST | EXPIRE`. A voided sale appends a
reversing `ADJUST` (negative) row — the original `EARN` stays, so the customer
"points history" screen is just this list rendered as-is. Rows are immutable at
the model level: the API exposes the ledger **read-only**; manual adjustments
arrive later as a dedicated action, not raw POSTs.

### Rules (server-enforced — mirror in the UI for disabled states)

- Points **earned** = `total ÷ program.earn_amount`, truncated to 0.01
  (default program: 1 point per ₱100). `redeem_value` (default ₱1/point) is
  the display conversion for "≈ ₱X value"; paying with points at checkout is
  **not wired yet** — `REDEEM` rows appear only when that ships, so render the
  balance as information, not a tender option.
- `free_items_available` grows by `total ÷ program.free_item_threshold`
  (default ₱5 000; `0` disables). Render as "free items ready: n" on the
  customer screen; they're redeemed through the rewards flow.
- Earning is active only when `business.loyalty_enabled` AND the program is
  `is_active` with `earn_amount > 0`; otherwise receipts show
  `points_earned: "0.00"` and no ledger row is written.
- Tiers live on the customer, not the program: BRONZE ₱0/0%, SILVER
  ₱1 000/5%, GOLD ₱5 000/10%, PLATINUM ₱10 000/15% of cumulative
  `total_spent`. The profile response already resolves `loyalty_tier`,
  `tier_display`, `discount_rate` and `next_tier_info` (what's needed for the
  next upgrade) — display those; never recompute or write them (the serializer
  rejects loyalty writes).
- Checkout flow for a loyalty sale: show balance + tier badge → tier discount
  applies automatically server-side (visible as `tier_discount_applied` on the
  receipt) → `reward_ids` burns AVAILABLE one-off rewards
  (`/api/customer-rewards/`; they flip to `USED` with the receipt id, `400` if
  not AVAILABLE). Per-customer lookups:
  `GET /api/customer-rewards/by-customer/{id}/`,
  `GET /api/customer-tier/by-customer/{id}/`.
- Tier upgrades also emit a notification row ("🎉 Welcome to …") the
  notifications screen can surface.

---

## 7. Ownership (Owner) — what changes in the admin UI

- New role `OWNER` (appears in `roles` from capabilities; grant form uses it).
- Exactly **one active OWNER per business** — DB-enforced. Assigning a second
  returns `400` with `detail: "Business 'X' already has an active Owner: …"`.
  UI: show the current owner on the grant screen and offer *transfer* (deactivate
  the old grant first) instead of a second row.
- An Owner is business-scoped: sees their business's data (all branches),
  manages users/grants within it, but not global superadmin tools.
- `Business.owner` (read-only on `/api/businesses/`) mirrors the active owner's
  user id for badges like "Owned by ana".

---

## 8. Who can do what (new modules) — quick reference

Derived from `ROLE_ACTIONS`; call `/api/auth/capabilities/` at runtime instead
of hardcoding this table. It is here so you know *why* a button disappears.

| Module | CASHIER | STAFF | ACCOUNTANT | Mgr/Admin wildcard roles |
| --- | --- | --- | --- | --- |
| `/payment-methods/` | read | read | read | full CRUD |
| `/payments/` | read | read | read | read (rows are immutable — no edit/delete for anyone) |
| `/cashier-shifts/` | open/close/**own**, list, `current/` | read + `current/` | read | list/read; close still requires being the owner-or-manager |
| `/loyalty-programs/` | read | read | read | create/update (delete denied — history would orphan) |
| `/loyalty-ledger/` | read | read | read | read-only for **everyone** — the viewset itself is read-only; ledger rows only exist because checkout wrote them |

Immutable-by-design (the API denies even superusers): edit/delete on
`Payment` and `LoyaltyTransaction`, delete on `LoyaltyProgram`,
edit/delete on `CashierShift`. Build the UI as read-only for those fields —
corrections happen through new rows (void, ADJUST), never in place.

---

## 9. Endpoint map (all of it, one glance)

**Auth** `POST /auth/login/` · `POST /auth/logout/` · `POST /auth/rotate-token/`
· `GET /auth/capabilities/` · `GET /user-profiles/me/` (full profile)
**Tenancy** `/businesses/` · `/business-types/` · `/branches/`
(+ `{id}/stats/`, `{id}/staffing/`) · `/company/` · `/user-access/`
**POS** `GET /branch-catalog/by-branch/{branch_id}/` · `/catalog/items/` ·
`/catalog/categories/` · `/catalog/business-items/` ·
`POST /transactions/checkout/` · `POST /transactions/{id}/void/` ·
`/transactions/` (read) · `/transactions/today/` · `/transactions/stats/` ·
`/daily-sales/`
**Payments/shifts** *(new)* `/payment-methods/` · `/payments/` (read) ·
`/cashier-shifts/` + `POST open/`, `POST {id}/close/`, `GET current/`
**Customers** `/clients/` (+ `search/`, `find_by_phone/`, `{id}/transactions/`,
`{id}/feedback/`, `{id}/rewards/`, `{id}/tier_info/`) · `/customer-rewards/`
(+ `{id}/claim/`, `by-customer/{customer_id}/`) · `/reward-claims/` ·
`/customer-tier/by-customer/{customer_id}/`
**Loyalty** *(new)* `/loyalty-programs/` (+ `for-current-business/`) ·
`/loyalty-ledger/` (read-only)
**Inventory** `/catalog/inventory/` (+ `restock/`) ·
`/catalog/stock-movements/`
**Rooms** `/rooms/` (+ `available/`, `occupied/`, `{id}/check_in/`,
`{id}/check_out/`)
**Ops** `/attendance/` (+ `today/`, `my_records/`, `check_in/`, `check_out/`,
`stats/`) · `/expenses/` (+ `summary/`, `recent/`) · `/feedback/` ·
`/notifications/` (+ `customer_alerts/`) · `/customer-detection/detect/`
**Admin** `/dashboard/summary/` · `/dashboard/branch_comparison/` ·
`/audit-logs/` · `/user-profiles/…`

Also served: `/api/schema/` (OpenAPI), `/api/docs/` (Swagger UI), `/api/redoc/`
— generate a typed client from the schema instead of hand-writing calls.
(`/docs/`, `/redoc/`, `/schema/` at the root redirect to these; they only
exist on the Django port, never on the SPA dev-server port.)
Standard REST on every collection: `GET list` returns DRF pagination
(`{count, next, previous, results}`, page size 50, `?page=`/`?page_size=`);
`GET /{id}/`, `POST`, `PATCH`, `DELETE` where the role allows. Query filters
are per-endpoint (there is no global search/ordering backend): the ones that
exist include `?transaction=`/`?shift=` (payments), `?customer=` (loyalty
ledger), `?staff=` (shift `current/`), and `?business=<id>` for company-wide
roles on scoped collections. Check `/api/schema/` before inventing a param —
unsupported ones are silently ignored.

---

## 10. Suggested build order / checklist

1. **Auth shell** — login, token store w/ `expires_at`, 401→re-login,
   rotate-token on app open, logout. Business switcher from `businesses[]`
   setting the `X-Business` header.
2. **Capability router** — fetch `/auth/capabilities/` once per session;
   mount routes per §2; unknown capability ⇒ no route.
3. **POS** — shift gate (`current/` → open modal) → `/branch-catalog/by_branch/`
   grid → cart → checkout sheet w/ `payment-methods/` tender buttons,
   split-tender validation (Σ = total live in the UI), `Idempotency-Key`,
   receipt render from the 201 body → print/PDF.
4. **Customer screen** — search/phone lookup, profile with points & tier,
   ledger timeline (`/loyalty-ledger/?customer=`), rewards claim/redeem.
5. **Manager** — shifts list + close-with-count dialog showing
   `expected_cash`/`over_short`; payments report grouped by method;
   daily-sales vs payments cross-check; loyalty program editor
   (`earn_amount`, `free_item_threshold`, `points_valid_days`, `is_active`).
6. **Admin** — grants UI incl. single-OWNER guard UX (§7), audit log,
   expenses, businesses/branches CRUD.

Edge cases that will bite if skipped: 401 mid-checkout (cart must survive;
same idempotency key after re-login is safe), empty grant state (§1),
business switch busting every cache, decimal strings (§1), 429 backoff,
`X-Request-ID` capture on error toasts.

---

## 11. Roadmap (in `Compare_System.md`, not yet implemented)

Do **not** build screens for these yet: refunds/returns as first-class
documents (void only today), purchase orders & supplier invoices, reservations
& scheduling, restaurant module (tables/menu courses), gift cards, multi-currency,
offline-first sync (idempotency keys are the groundwork), push notifications.
When each lands it arrives as new endpoints + capability keys; your capability
router means zero rework.