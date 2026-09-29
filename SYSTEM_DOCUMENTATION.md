# Bungad & Villareal Management System — System Documentation

**Architecture:** Single company · many businesses · many branches · one catalog · centralized access control
**Stack:** Django 5.1 + Django REST Framework 3.15 (backend) · React 19 + Vite 8 + Tailwind 4 (frontend)
**Last updated:** 2026-09-29 · Backend test suite: **33/33 passing** · `manage.py check`: clean · OpenAPI: 0 errors

> This document describes the system **as built** after the multi-business SaaS refactor
> (Phases 0–5 of [`MULTI_BUSINESS_SAAS_PLAN.md`](MULTI_BUSINESS_SAAS_PLAN.md)).
> `MULTITENANT_SAAS_PLAN.md` is obsolete (it assumed many companies; there is only one).

---

## 1. System Overview

One legal company operates several businesses (spa, retail, kitchen, auto spa, …). Each business
operates through one or more physical branches. Everything — people, catalog, sales, stock,
loyalty — belongs to that single company, but every read/write is scoped to the **business** and
**branch** the signed-in user is allowed to touch.

```
Company  (singleton, pk=1 — "Bungad & Villareal Group")
│
├── BusinessType   (spa / retail / restaurant / auto-spa … user-extensible data, not code)
│
├── Business       ("Villareal Spa Services", "VReal Products", "BB Retail",
│       │           "Panganan Menu", "KB Items", "Auto Spa Services")
│       │
│       └── Branch ("Cavite Main", "Dasma", …)  ← physical outlet; unit of operations
│               │
│               ├── InventoryLevel / StockMovement   (stock lives at a branch)
│               ├── Transaction / TransactionItem    (sales are taken at a branch)
│               ├── RoomTable, Attendance, Expense, DailySales, CustomerFeedback
│
├── Item + Category          (ONE company-wide catalog of every product & service)
│       └── BusinessItem     (which business sells which item, at what price)
│
└── UserAccess               (what a user may do, and in which business / branches)
```

### Design rules the codebase enforces

| # | Rule | Mechanism |
|---|------|-----------|
| 1 | A business, not a tenant, is the isolation boundary | `api/access/scoping.py::auto_scope()` always filters `business` first |
| 2 | One catalog serves every business | `catalog.Item` + `catalog.BusinessItem` (per-business price override) |
| 3 | A user can hold many roles in many businesses | `access.UserAccess` rows (role × business × optional branch list) |
| 4 | Scoping is automatic, never hand-written | `ScopedQuerysetMixin` / `BusinessScopedManager` replace 13 manual filters |
| 5 | Every stock change is in a ledger | `StockMovement` is append-only; `InventoryLevel` is the balance |
| 6 | Sales are atomic and replay-safe | `api/sales/services.py::checkout()` + `Transaction.idempotency_key` |
| 7 | Authorization lives in one matrix | `api/permissions.py::ROLE_ACTIONS` (`"<Resource>:<action>"` keys) |

---

## 2. Repository Layout

```
bungad-villareal-system/
├── backend/
│   ├── core/                      settings.py · urls.py · wsgi/asgi
│   └── api/
│       ├── models.py              operational models + re-exports of every domain model
│       ├── views.py               auth, legacy catalog shims, POS & operational viewsets
│       ├── serializers.py         operational serializers
│       ├── permissions.py         ROLE_ACTIONS matrix + RoleBasedPermission
│       ├── urls.py                single router, all routes under /api/
│       ├── admin.py               Django admin (grouped by domain)
│       ├── company/               Company (singleton)
│       ├── business/              BusinessType · Business
│       ├── access/                UserAccess · middleware · authentication · context
│       │                          scoping · managers · permissions
│       ├── catalog/               Category · Item · BusinessItem · InventoryLevel · StockMovement
│       ├── sales/                 services.py (checkout / void / receive / adjust)
│       ├── management/commands/   bootstrap_company · create_demo_users · setup_demo_data ·
│       │                          import_vss_services · import_vreal_products
│       ├── migrations/            0001…0007 legacy · 0008–0010 SaaS refactor
│       └── tests/                 test_api.py (17) · test_business_isolation.py (10) · test_admin.py (6)
├── frontend/
│   └── src/
│       ├── App.jsx                auth, router, axios instance, layout/shell
│       └── components/            CashierPOS · SalesPage · ClientsPage · CustomersRewardsPage ·
│                                  CustomerRewardsPanel · AdministrationPage · Crudtable ·
│                                  CustomerTierBadge
├── MULTI_BUSINESS_SAAS_PLAN.md    architecture plan (implemented)
├── MULTITENANT_SAAS_PLAN.md       superseded — do not follow
└── SYSTEM_DOCUMENTATION.md        this file
```

`api/models.py` re-exports every domain model so historical imports (`from api.models import Item`)
keep working; new code should import from the domain package (`from api.catalog.models import Item`).

---

## 3. Runtime & Tooling

| Layer | Choice | Notes |
|-------|--------|-------|
| Language | Python 3.10 | `backend/.venv` exists but is **stale** (missing `drf_spectacular`); the working interpreter is the system Python 3.10 with `requirements.txt` installed — see §12 |
| Web framework | Django 5.1.8 | `core.settings` |
| API | djangorestframework 3.15.2 | token **and** session auth |
| API docs | drf-spectacular 0.30.0 | `/api/schema/`, `/api/docs/` (Swagger), `/api/redoc/` |
| CORS | django-cors-headers 3.6.0 | `CORS_ALLOWED_ORIGINS` env-driven; credentials allowed |
| Database | SQLite (`backend/db.sqlite3`) | swap to PostgreSQL for production |
| Secrets | `python-dotenv` reads `backend/.env` | see `backend/.env.example`; process env wins |
| Frontend | React 19.2, Vite 8, Tailwind 4, react-router 7 | `axios` for HTTP, `recharts` charts, `sweetalert2` dialogs, `lucide-react` icons |

---

## 4. Data Model

### 4.1 Structure & access (SaaS layer)

| Model | Table owner | Key fields | Purpose |
|-------|-------------|-----------|---------|
| `Company` | `api_company` | `legal_name`, `display_name`, `tax_id`, `default_currency`, `timezone`, `default_tax_rate`, `loyalty_enabled` | Singleton (`get_solo()`, `pk` forced to 1, `delete()` raises). Company defaults that businesses may override |
| `BusinessType` | `api_businesstype` | `code` (slug, unique), `name`, `icon`, `default_unit`, `tracks_stock` | Extensible kind of business — adding "Salon" is a DB row, not a code change |
| `Business` | `api_business` | `name`, `slug` (unique), `business_type` (PROTECT), `receipt_header`, `currency`, `tax_rate`, `loyalty_enabled`, `is_active` | The isolation boundary. Blank `currency`/`tax_rate` ⇒ inherit Company |
| `Branch` | `api_branch` | `business` FK (nullable, CASCADE), `code`, `name`, `branch_type` (legacy), `address`, `is_active` | Outlet. `business` drives scoping; `branch_type` remains only for legacy POS catalog resolution |
| `UserAccess` | `api_useraccess` | `user` FK, `role`, `business` FK (NULL = company-wide), `branches` M2M (empty = all), `is_primary`, `is_active` | One row per (user, role, business). `unique_together = (user, role, business)` + CHECK constraint: company roles must have `business = NULL`, business roles must not |

`UserAccess.ROLE_CHOICES`: `OWNER`, `COMPANY_ADMIN`, `ACCOUNTANT`, `BUSINESS_MANAGER`, `SUPERVISOR`,
`CASHIER`, `STAFF`. `COMPANY_ROLES = {OWNER, COMPANY_ADMIN, ACCOUNTANT}` are company-wide
(`is_company_wide == True`) and see every business.

### 4.2 Unified catalog & stock

| Model | Key fields | Purpose |
|-------|-----------|---------|
| `Category` | `name`, `kind` (PRODUCT/SERVICE), `parent`, `sort_order`, `is_active` | Company-wide grouping; `unique_together (name, kind)` |
| `Item` | `item_type` (PRODUCT/SERVICE), `category`, `name`, `sku`, `barcode` (unique), `cost_price`, `selling_price`, `is_taxable`, `tracks_stock`, `min_stock`, `unit`, `duration`, `duration_unit`, `requires_staff`, `requires_room`, `attributes` (JSON), `image`, `is_active` | **One row per sellable thing** — replaced the 7 legacy catalog tables |
| `BusinessItem` | `business`, `item`, `price_override`, `is_available`, `sort_order` | Which business sells which item, and at what price. `effective_price = price_override ?? item.selling_price`. `unique_together (business, item)` |
| `InventoryLevel` | `branch`, `item`, `stock_qty`, `reorder_point` | Current balance per **branch** (`unique_together`) |
| `StockMovement` | `branch`, `item`, `quantity_delta`, `reason`, `reference`, `balance_after`, `created_by` | Append-only audit ledger — every receive / sale / void / adjust / transfer |

`Item.attributes` is where business-specific detail lives (shade, size, engine type, therapist
requirement, …) — that is what removed the need for per-business catalog tables.

### 4.3 Operational domain (unchanged shape, now scoped)

`ClientProfile` (company-wide customers + loyalty tier), `CustomerReward`, `RewardClaim`,
`RoomTable`, `Transaction` + `TransactionItem` (now FK → `Item`), `DailySales` (per-branch daily
ledger), `Attendance` (unique on user + branch + date, so covering two outlets works),
`CustomerFeedback`, `Expense`, `AuditLog`, `UserProfile` (legacy single role/branch + `skills`).

### 4.4 Migration history

| Migration | Content |
|-----------|---------|
| `0001`–`0007` | Legacy schema (7 catalogs, branch-only hierarchy, loyalty, attendance, expenses, audit) |
| `0008_business_businessitem_businesstype_category_company_and_more` | Adds `Company`, `BusinessType`, `Business`, `UserAccess`, `BusinessItem`, `Category`, `InventoryLevel`, `StockMovement`, `Branch.business`, `Branch.code`; widens `Attendance` uniqueness |
| `0009_unified_catalog` | **Data migration**: copies the 7 legacy catalogs into `Item` + `Category` + `BusinessItem`, moves `BranchInventory` into `InventoryLevel` and writes opening-balance `StockMovement` rows |
| `0010_delete_autospaservice_delete_bbproduct_and_more` | Drops the 7 legacy catalog models + `BranchInventory` |

Apply with `python manage.py migrate`. A pre-refactor snapshot is kept at
`backend/backup_pre_saas.json` (`python manage.py loaddata backup_pre_saas.json` restores it).

---

## 5. Access Control & Request Lifecycle

Access control answers two independent questions, handled by two independent layers:

1. **Which business / branches is this request acting on?** → `api/access/*` (context + scoping)
2. **Is this role allowed to perform this action at all?** → `api/permissions.py::ROLE_ACTIONS`

### 5.1 Files

| File | Responsibility |
|------|----------------|
| `access/models.py` | `UserAccess` grant model |
| `access/middleware.py` | `BusinessMiddleware` — early (session/admin) context resolution |
| `access/authentication.py` | `BusinessContextMixin`, `BusinessTokenAuthentication`, `BusinessSessionAuthentication` — apply context right after DRF authenticates |
| `access/context.py` | `resolve_grant()`, `apply_business_context()`, `ensure_business_context()` — the single decision point |
| `access/scoping.py` | `auto_scope()`, `ScopedQuerysetMixin` — queryset narrowing |
| `access/managers.py` | context-var + `BusinessScopedManager` / `BusinessScopedModel` for model-level default filtering |
| `access/permissions.py` | `BusinessAccessPermission` (write must target the active business), `BranchScopePermission` (object-level branch check) |
| `api/permissions.py` | role → action matrix (`ROLE_ACTIONS`, `BRANCH_ADMIN_DENIED_ACTIONS`, `ROLE_ALIASES`, `RoleBasedPermission`) |

### 5.2 Request lifecycle

```
HTTP request
   ├─ SessionMiddleware → AuthenticationMiddleware      (session cookie ⇒ user known)
   ├─ BusinessMiddleware                                (api/access/middleware.py)
   │     └─ apply_business_context(request)
   │          • reads X-Business header
   │          • picks the UserAccess grant
   │          • stamps request.access / request.business /
   │            request.company_wide / request.allowed_branch_ids
   │          • stamps request._business_context_for = user.pk
   │          • sets the context-var used by BusinessScopedManager
   ├─ DRF APIView.initial()
   │     └─ BusinessTokenAuthentication.authenticate()  (Authorization: Token <key>)
   │           └─ BusinessContextMixin → apply_business_context(request, user)
   │              ← this is what makes token auth work: the middleware ran while
   │                request.user was still AnonymousUser
   ├─ Permissions: IsAuthenticated → RoleBasedPermission
   │                                → BusinessAccessPermission / BranchScopePermission
   │        (both call ensure_business_context(request) first)
   └─ get_queryset(): ScopedQuerysetMixin → auto_scope(queryset, request, branch_lookup)
                      (also calls ensure_business_context(request) first)
```

### 5.3 Lazy resolution (`ensure_business_context`) — why it exists

`BusinessMiddleware` runs **before** DRF resolves a token, so at middleware time the user is
anonymous and no grant can be looked up. Every consumer of the context calls
`ensure_business_context(request)`, which:

* recomputes the context when the stamped user pk differs from `request.user.pk`;
* returns immediately when the context was already resolved for this user (repeat calls are free);
* performs **no DB query** for anonymous requests (views still fail closed on `IsAuthenticated`).

A request whose user is resolved late (token auth, `APIClient.force_authenticate` in tests) is
therefore scoped exactly as well as a session request. Re-applying the context always recomputes
from scratch, so a spoofed `X-Business` header can only ever **narrow** access, never widen it.

### 5.4 Active business selection (`resolve_grant`)

| Priority | Rule |
|----------|------|
| 1 | `X-Business: <slug>` header — accepted **only** if it matches an active grant of the user |
| 2 | The user's `is_primary` grant |
| 3 | The user's first active grant (stable ordering) |
| — | No grants at all → no context; scoping falls back to legacy `UserProfile.branch` (§5.5) |

Unknown or unauthorized header values are logged and ignored — never an error, never a grant.

### 5.5 Scoping rules (`auto_scope`)

```
company_wide grant (OWNER / COMPANY_ADMIN / ACCOUNTANT / superuser) → no narrowing
model has a `business` field    → filter(business=<active business>)   ← always first
model has only `branch`         → filter(branch__business=<active>)
?business=<id> naming a DIFFERENT business                            → queryset.none()
grant.branches non-empty        → filter(<branch_lookup>__in=allowed)  (+ .distinct() on joins)
no grant row at all             → legacy fallback: UserProfile.branch for BRANCH_ADMIN /
                                  CASHIER / STAFF; queryset.none() when that user is unassigned
```

`branch_lookup` is set per viewset: `branch_id` by default, `pk` for `Branch` itself,
`inventory_levels__branch_id` for catalog rows whose branch link runs through stock.
Everything fails **closed**: an unresolved or foreign business never leaks rows.

### 5.6 Role matrix (`api/permissions.py`)

Keys are `"<ViewSet minus 'ViewSet'>:<action>"`; `RoleBasedPermission` takes `view.action`, falling
back to the HTTP method via `METHOD_ACTIONS`. Detail routes without a router action allow `GET`
when either `:list` or `:retrieve` is permitted.

| Role | Scope | Notes |
|------|-------|-------|
| `SUPERADMIN` | `{'*'}` | Everything, including `UserAccess` / `Business` / `BusinessType` mutations |
| `OWNER` | explicit read-only allow-list | Org-wide visibility + analytics; **cannot** mutate operational data (test-enforced) |
| `BRANCH_ADMIN` | `{'*'}` minus `BRANCH_ADMIN_DENIED_ACTIONS` | Everything inside its scope; denied company-level actions (branch comparison, access-grant CRUD, business & business-type writes) |
| `CASHIER` | front-of-house allow-list | Catalogs, clients, rooms, checkout/void, reward claims, stock receiving, own attendance |
| `STAFF` | customer / room / attendance allow-list | No transactions, expenses, or inventory values |

`get_user_role()` reads `UserProfile.role` first and otherwise maps Django group names through
`ROLE_ALIASES` (`"Branch Admin"` → `BRANCH_ADMIN`, `"Spa Therapist"` → `STAFF`, …), so pre-profile
accounts and fixtures keep working. `IsSuperAdmin` and `IsBranchAdminOrAbove` are the coarse
helpers used by a few non-router views.

> **Known duality (see §12):** the *capability* matrix still keys off `UserProfile.role`
> (`SUPERADMIN/OWNER/BRANCH_ADMIN/CASHIER/STAFF`) while the *scope* comes from `UserAccess.role`
> (`BUSINESS_MANAGER/SUPERVISOR/…`). Scope and capability are both enforced on every request;
> unifying them into one role source is the main remaining refactor.

### 5.7 Business switching from the UI

1. `POST /api/auth/login/` returns `businesses[]` and `primary_business` → render the switcher.
2. To act on another business, send `X-Business: <slug>` (e.g. `vreal`) on later requests.
3. If the header names a business the user has no grant for, the server falls back to the primary
   grant silently — so the client must trust the data it receives (or re-read
   `GET /api/businesses/`), never assume the header took effect.

---

## 6. Sales & Inventory Engine

All mutations go through `api/sales/services.py`; viewsets only validate input and delegate. Each
service is wrapped in `@db_transaction.atomic`.

### 6.1 `checkout(...)` — the single sale path

```
checkout(branch, cashier, items, customer=None, amount_paid, discount,
         reward_ids=(), apply_tier_discount=True, idempotency_key=None, notes='')
```

| Step | Behaviour |
|------|-----------|
| Replay guard | If `idempotency_key` already exists on a `Transaction`, that transaction is returned unchanged — a double-clicked POS button cannot double-charge |
| Item resolution | `BusinessItem(business=branch.business, item=<id>, is_available=True)` → price = `effective_price`. Falls back to a direct active `Item` (price = `selling_price`) when the item has no business link; anything else is rejected |
| Stock deduction | For `tracks_stock` items: conditional update `stock_qty >= qty → stock_qty = F('stock_qty') - qty`. Zero rows updated ⇒ `ValidationError('Insufficient stock …')`. Race-safe under concurrency — no read-modify-write |
| Loyalty | Tier discount via `CustomerProfile.get_discount_rate()` when `apply_tier_discount`; claimed `reward_ids` applied and recorded as `RewardClaim`; earned `CustomerReward` created; tier snapshot stored on the transaction |
| Ledger | `Transaction` + `TransactionItem` rows, `DailySales` totals for `(branch, date)`, `StockMovement` per deducted item, audit log |
| Output | `Transaction` with `transaction_number`, totals, change and item lines. The legacy `catalog_source` receipt label is derived from the branch's business (`vss`/`vreal`/`bb` → `VSS`/`VREAL`/`BB`, else `GENERIC`) |

`POST /api/transactions/checkout/` is the HTTP entry point; a direct `POST /api/transactions/` is
deliberately not permitted by the role matrix — sales must run through the service.

### 6.2 Other services

| Service | Effect |
|---------|--------|
| `void_sale(transaction, staff, reason)` | Marks `VOID`/`VOIDED`, restores stock with `F()` updates, appends `reason='VOID'` movements, moves the amount from `DailySales.total_sales` into `total_void`. Rejects double voids |
| `receive_stock(branch, item, quantity, reference, user)` | `get_or_create` the branch `InventoryLevel`, add via `F()`, append `reason='RECEIVE'` movement |
| `adjust_stock(branch, item, new_quantity, reason, reference, user)` | Sets the balance, records the signed delta as a movement; negative targets rejected |

`InventoryLevel` is a **balance**; `StockMovement` is the **proof**. Never touch `stock_qty` outside
these functions — the ledger must stay reconcilable.

That invariant is also enforced where the temptation is greatest: the Django admin registers
`StockMovement` with add/change/delete permissions disabled, so ledger rows are readable and
filterable but immutable through the UI (guarded by `api/tests/test_admin.py`).

---

## 7. API Reference

Base URL `http://localhost:8000/api/`. Interactive docs: `/api/docs/` (Swagger UI), `/api/redoc/`,
raw schema `/api/schema/` (also dumped to `backend/schema.yml`).

**Auth:** `Authorization: Token <key>` (used by the SPA) or a Django session cookie (admin, browsable
API). Pagination is `PageNumberPagination` with `PAGE_SIZE=50`, so list responses are
`{count, next, previous, results[]}`. Throttles: anon 100/min, user 1000/min, login 10/min.
Every list endpoint below is automatically scoped per §5.5.

### 7.1 Auth, businesses & access

| Method & path | Purpose |
|---------------|---------|
| `POST /api/auth/login/` | `{username, password}` → `{token, user{id, username, role, role_code, branch, services, is_staff, is_superuser}, businesses[], primary_business}`; writes an `AuditLog(LOGIN)` |
| `POST /api/auth/logout/` | Revokes the current token |
| `GET /api/businesses/` · `GET /api/businesses/{id}/` | Businesses the caller may open (company-wide grants see all) |
| `GET,POST /api/business-types/` | Business-type dictionary (writes are company-level) |
| `GET,POST /api/user-access/` · `PATCH/DELETE /api/user-access/{id}/` | `UserAccess` grants — mutations are company-level (denied to `BRANCH_ADMIN`); callers without a company-wide grant only see their own grants |
| `GET /api/user-profiles/` · `GET /api/user-profiles/me/` | Staff profiles / own profile |

`Company` (singleton) is managed in the Django admin; its values are applied server-side to
receipts, currency and tax defaults rather than exposed as its own endpoint.

### 7.2 Unified catalog & stock

| Method & path | Purpose |
|---------------|---------|
| `GET,POST /api/catalog/items/` · `GET,PATCH,DELETE /api/catalog/items/{id}/` | The one catalog (`?item_type=PRODUCT|SERVICE`, `?category=`, `?search=`) |
| `GET,POST /api/catalog/categories/` | Categories, per `kind` |
| `GET,POST /api/catalog/business-items/` | Item ↔ business availability and `price_override`; `effective_price` is read-only |
| `GET /api/catalog/inventory/` · `POST /api/catalog/inventory/{id}/restock/` | Per-branch balances (`InventoryLevel`) |
| `GET /api/catalog/stock-movements/` | Append-only ledger |

### 7.3 Sales, clients, rooms & staff

| Method & path | Purpose |
|---------------|---------|
| `POST /api/transactions/checkout/` | Create a sale (§6.1); accepts `idempotency_key` |
| `GET /api/transactions/` · `GET /api/transactions/today/` · `GET /api/transactions/stats/` | Sales history, scoped |
| `POST /api/transactions/{id}/void/` | Void a sale (stock restored, ledger written) |
| `GET /api/daily-sales/` | Per-branch daily ledger (read-only) |
| `GET /api/branch-catalog/by-branch/{branch_id}/` | Flat POS catalog for one outlet — `{id, name, price, item_type, category, …}` from `Item` + `BusinessItem` |
| `GET,POST /api/clients/` · `GET /api/clients/search/?q=` · `/find_by_phone/` · `/{id}/transactions/` · `/{id}/rewards/` · `/{id}/tier_info/` | Customers — company-wide by design, so a regular recognized at any outlet |
| `GET /api/customer-tier/by-customer/{id}/` · `GET /api/customer-rewards/?customer_id=&status=AVAILABLE` · `GET,POST /api/reward-claims/` | Loyalty tiers, points, redemptions |
| `GET /api/customer-detection/detect/` · `GET /api/notifications/customer_alerts/` | Walk-in detection & reward alerts |
| `GET /api/rooms/` · `GET /api/rooms/available/` · `/occupied/` · `POST /api/rooms/{id}/check_in/` · `/check_out/` | Spa room board |
| `GET,POST /api/branches/` · `GET /api/branches/{id}/staffing/` · `/stats/` | Outlets, staffing gaps |
| `GET,POST /api/attendance/` · `GET /api/attendance/today/` · `/my_records/` | Time in / out |
| `GET /api/expenses/` · `GET /api/expenses/summary/` · `GET /api/feedback/` · `GET /api/audit-logs/` · `GET /api/audit-logs/recent/` | Costs, feedback, audit trail |
| `GET /api/dashboard/summary/` · `GET /api/dashboard/branch_comparison/` | Analytics; `branch_comparison` is company-level (denied to `BRANCH_ADMIN`) |

### 7.4 Legacy compatibility shims (read-only)

The pre-refactor catalog URLs still resolve, backed by `Item` / `BusinessItem` through
`views.business_catalog_queryset(business_slug, item_type)` — same viewset class names, routes,
payload field names and `ROLE_ACTIONS` keys, so the current SPA keeps working untouched:

| Legacy route | Serves |
|--------------|--------|
| `/api/vss-services/` | items linked to business slug `vss` |
| `/api/vreal-products/` | slug `vreal` |
| `/api/bb-products/` | slug `bb` |
| `/api/panganan-menus/` | slug `panganan` |
| `/api/kb-items/` | slug `kb` |
| `/api/auto-spa/` | slug `autospa` |
| `/api/products/` | every `Item` with `item_type=PRODUCT` |
| `/api/branch-inventory/` | `InventoryLevel` (same field names as the old `BranchInventory`) |

**Do not build new features on these routes** — they exist only so the frontend can migrate
page-by-page. Removal is tracked in §12.

---

## 8. Frontend (Single-Page App)

| Concern | Implementation |
|---------|----------------|
| Entry / shell | `src/App.jsx` — login screen, sidebar navigation, page switching, dark-mode toggle, header/layout |
| Routing | React Router 7 routes exist for the three catalog pages (`/vss-services`, `/vreal-products`, `/bb-products`); the remaining pages are switched inside the shell by an active-page state, gated by `canAccess(role, capability)` against a client-side `ROLE_CAPABILITIES` map |
| HTTP | seven `axios` instances (the shell plus six page components), each with a request interceptor that adds `Authorization: Token <token>` and `X-Business: <slug>` (helper in `src/utils/session.js`) |
| Session | `localStorage` keys `authToken`, `authUser` (the login payload from §7.1), `authBusinesses` (granted businesses from login) and `activeBusiness` (the slug sent as `X-Business`); logout clears all four |
| Business switcher | `App.jsx` keeps `businesses` / `primary_business` from the login payload; when the account holds **more than one** business the header shows a **Business** picker. Choosing one writes `activeBusiness` and re-keys the workspace container, so every page remounts and refetches under the new scope. The effective slug is derived during render, so a grant revoked between sessions falls back to the first remaining business instead of sending a stale slug |
| Components | `CashierPOS.jsx` (outlet POS), `SalesPage.jsx` (sales history / manual sale), `ClientsPage.jsx`, `CustomersRewardsPage.jsx` + `CustomerRewardsPanel.jsx` + `CustomerTierBadge.jsx` (loyalty), `AdministrationPage.jsx` (staff, branches, access), `CrudTable.jsx` (generic list/editor reused by the catalog pages), `DocumentationPage.jsx` (in-app handbook, content in `components/documentation/content.js`) |
| In-app handbook | `DocumentationPage.jsx` renders the operator/developer manual (search, sticky section nav, collapsible sections, printable). Copy lives as typed blocks in `src/components/documentation/content.js` so wording changes need no logic change. Opened by the sidebar **Documentation** item, gated by the client-side `documentation` capability granted to every role — this only hides the link, the page itself contains no privileged data |
| Build | `npm run dev` (Vite, port 5173), `npm run build` → `frontend/dist`, `npm run lint` (eslint flat config) |

**How the POS gets its catalog today** (`CashierPOS.jsx`):

1. Reads the signed-in user's branch from `authUser.branch.id` (from the login payload).
2. `GET /branch-catalog/by-branch/<branch_id>/` → one flat list of `Item`s available in that
   outlet's business, plus `branch_id`, `branch_name`, `branch_type`, `branch_type_display`.
3. Renders category tabs; on submit posts `POST /transactions/checkout/` with
   `{branch, items:[{item, quantity, …}], customer, amount_paid, discount, reward_ids}`.

So the POS is already **business-agnostic**: the outlet's `Branch.business` decides which items
come back — no per-business code path in the client.

**Still legacy in the client:** `SalesPage.jsx` loads `/products/` and `/vss-services/` (compat
shims) — listed as follow-up #3 in §12. Both tills now send an `Idempotency-Key` header on
checkout (one `crypto.randomUUID()` per attempted sale, reused while the cart is unsold), so a
retry replays the original sale instead of creating a second one.

---

## 9. Management Commands & Runbook

Run from `backend/`. Commands live in `api/management/commands/`.

| Command | What it does |
|---------|--------------|
| `python manage.py bootstrap_company` | Creates the singleton `Company`, the default `BusinessType` rows, the initial six `Business`es, and the `OWNER` access grant. Idempotent |
| `python manage.py create_demo_users` | Creates/updates one local demo account per role, each with the matching `UserAccess` grant(s) |
| `python manage.py setup_demo_data` | Convenience wrapper: migrate → import catalog seed files → create demo users |
| `python manage.py import_vss_services <file>` | Reads a `DESCRIPTION<TAB>PRICE` file with `CATEGORY_KEY` header lines → `Category(kind=SERVICE)` + `Item(item_type=SERVICE)` + `BusinessItem(business='vss')` |
| `python manage.py import_vreal_products <file>` | Same format, `item_type=PRODUCT`, business slug `vreal` |

Both importers are `get_or_create`-based, so re-running them on the same file is safe.

### 9.1 Fresh environment

```bash
cd backend
python -m pip install -r requirements.txt
copy .env.example .env            # then set a real SECRET_KEY
python manage.py migrate
python manage.py bootstrap_company
python manage.py setup_demo_data  # or: import_vss_services/import_vreal_products + create_demo_users
python manage.py createsuperuser
python manage.py runserver        # API on http://localhost:8000

cd ../frontend
npm install
npm run dev                       # SPA on http://localhost:5173
```

### 9.2 Routine verification

```bash
cd backend
python manage.py check                                   # system check
python manage.py test api                                # full suite (33 tests)
python manage.py spectacular --file schema.yml           # OpenAPI regeneration
cd ../frontend && npm run lint && npm run build
```

### 9.3 Backup / restore

```bash
python manage.py dumpdata api --indent 2 -o backup.json
python manage.py loaddata backup.json
```

`backend/backup_pre_saas.json` is the snapshot taken immediately before the SaaS refactor.

## 10. Testing

Three modules under `backend/api/tests/` (plain Django `TestCase`, SQLite test DB, no external
services):

| Module | Covers |
|--------|--------|
| `test_api.py` (17 tests) | Login success/failure; role gating (cashier can read catalogs but not manage branches, therapist cannot read transactions, admin can); branch-admin visibility; owner is read-only on operational data; superuser can create branch admins and edit staff/branch; branch staffing gap report; checkout deducts stock; unauthenticated access rejected; client profile is org-wide; direct `POST /transactions/` rejected; void restores inventory and logs; branch-admin blocked from `branch_comparison` |
| `test_business_isolation.py` (10 tests) | Cashier sees only granted-branch transactions; catalog scoped by active grant; **business switching via `X-Business` header**; grant-less user falls back to own branch; company owner sees every business; branch admin cannot create access grants; checkout idempotency; insufficient-stock rejection; void restores stock and writes the ledger; login returns `businesses` + `primary_business` |
| `test_admin.py` (6 tests) | The `StockMovement` ledger is visible but immutable through the Django admin: list renders, `add/` and POSTing a change or delete return 403, bulk delete leaves the rows in place |

Isolation tests deliberately mix auth styles — `APIClient` with `force_authenticate`/token **and**
`client.force_login` sessions — because the business context is resolved lazily (§5.3). Adding a
new scoped viewset? Add one isolation test that asserts a second business's rows are invisible.

---

## 11. Configuration & Deployment

`core/settings.py` reads `backend/.env` through `python-dotenv` with `override=False`, so **real
environment variables always beat the file**. `.env` is git-ignored; `.env.example` is the template.

| Variable | Effect when unset |
|----------|-------------------|
| `DJANGO_SECRET_KEY` | Falls back to the committed insecure dev key — must be set in production |
| `DJANGO_DEBUG` | **Defaults to `True`** — set `DJANGO_DEBUG=False` explicitly |
| `DJANGO_ALLOWED_HOSTS` | `['*']` while `DEBUG`, otherwise `localhost`/`127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | `CORS_ALLOW_ALL_ORIGINS = True`; when set, only those origins (comma-separated) |
| `SECURE_SSL_REDIRECT` | Redirects only when `DEBUG` is off; defaults to `True` then |
| `SECURE_HSTS_SECONDS` | `31536000`, plus `SECURE_HSTS_INCLUDE_SUBDOMAINS` / `_PRELOAD` |

Other fixed settings worth knowing:

| Area | Value |
|------|-------|
| Time zone | `Asia/Manila` with `USE_TZ = True` |
| Cookies | `SESSION_COOKIE_HTTPONLY=True`, `SAMESITE='Lax'`, `SECURE` whenever `DEBUG` is off |
| Security headers | XSS filter + `SECURE_CONTENT_TYPE_NOSNIFF` always on |
| Database | SQLite at `backend/db.sqlite3` (local-only; untracked) |
| Static / media | `STATIC_ROOT=backend/staticfiles`, `MEDIA_ROOT=backend/media` |
| Uploads | 2.5 MB memory limit, `DATA_UPLOAD_MAX_NUMBER_FIELDS=10000` |
| Logging | console handler at `INFO` |
| Allowed CORS headers | includes `x-business`, so the SPA can send the business-switch header from another origin |

### 11.1 Production checklist

1. `DJANGO_DEBUG=False`, real `DJANGO_SECRET_KEY`, real `DJANGO_ALLOWED_HOSTS`, explicit
   `CORS_ALLOWED_ORIGINS` (SPA origin only).
2. Replace SQLite with PostgreSQL in `DATABASES` and run `migrate` against it.
3. `python manage.py collectstatic`, serve `/static/` and `/media/` from the web server or object storage.
4. Run behind a WSGI/ASGI server (`gunicorn core.wsgi` or `uvicorn core.asgi:application`)
   behind nginx/Caddy with TLS; HSTS is already enabled.
5. Nightly `dumpdata` (or `pg_dump`) backups; keep at least one off-site copy.
6. Re-issue demo credentials — `create_demo_users` seeds known passwords and must never run in production.

### 11.2 Repository hygiene

`.gitignore` covers `backend/.venv/`, `__pycache__/`, `backend/.env`, `backend/db.sqlite3*`,
`backup_pre_saas.json`, `frontend/node_modules/`, `frontend/dist/`. Those paths were previously
committed, so they have been **untracked** (`git rm -r --cached`) while staying on disk: tracked
files went from 7,210 → 60. Commit that removal once so clones stop carrying a virtualenv.

---

## 12. Known Gaps & Roadmap

### 12.1 Gaps, ordered by impact

| # | Gap | Where | Why it matters | Suggested fix |
|---|-----|-------|----------------|---------------|
| 1 | Two role systems coexist | `api/permissions.py` keys on `UserProfile.role`; scope keys on `UserAccess.role` | A user granted `BUSINESS_MANAGER` whose legacy profile still says `STAFF` is scoped to the right business but lacks manager *capabilities* | Key `ROLE_ACTIONS` on the active grant (`request.access.role`), generate `UserProfile.role` from grants, then drop the column |
| 2 | ~~SPA has no business switcher~~ **closed** | `frontend/src/App.jsx`, `src/utils/session.js` | Closed 2026-09-29: login grants are kept in state, the header renders a **Business** picker (multi-business accounts), every axios instance injects `X-Business`, and switching remounts the workspace | Nothing left; per-request switching is covered by `test_business_isolation.py` |
| 3 | Sales page on legacy shims | `SalesPage.jsx` calls `/products/`, `/vss-services/` | Keeps the retired route contract alive | Switch to `/api/catalog/items/` (+ `business-items`) |
| 4 | ~~No idempotency key from clients~~ **closed** | `CashierPOS.jsx`, `SalesPage.jsx` | Closed 2026-09-29: both tills generate one `crypto.randomUUID()` per attempted sale, send it as `Idempotency-Key`, and reuse it until the sale is recorded | Nothing left; the key resets only after a sale comes back |
| 5 | `Branch.branch_type` still drives POS tabs | `CashierPOS.jsx`, `branch-catalog` payload | Duplicates what `Business` + `Category` already express | Group by category/business, then delete `branch_type` |
| 6 | Compatibility shims still routed | §7.4 | Two ways to read a catalog invites drift | Delete the shims once #3 lands, and move their `ROLE_ACTIONS` keys to `Items`/`Inventory` |
| 7 | `backend/.venv` is incomplete | venv has Django 5.2 but no `drf_spectacular`; the system Python 3.10 matches `requirements.txt` | `manage.py` fails under the venv interpreter | Recreate it: `python -m venv backend/.venv` then `pip install -r backend/requirements.txt` |
| 8 | Stock transfers unimplemented | `StockMovement.REASONS` offers `TRANSFER_IN` / `TRANSFER_OUT` but no service uses them | Multi-branch company needs outlet-to-outlet moves | Add `transfer_stock(from_branch, to_branch, item, qty, reference)` writing both movements atomically, plus a `POST /catalog/inventory/{id}/transfer/` |
| 9 | Import de-duplication is name-based | `import_vss_services`, `import_vreal_products` `get_or_create(name, item_type)`; `Item.barcode` is globally unique | Same-named services across businesses collapse into one `Item`, and a duplicated barcode is swallowed by the broad `except Exception` per-row handler | Key on `(business, name)` or a per-business SKU namespace; surface import errors instead of printing them |
| 10 | Single-company / single-box assumptions | `Company` singleton, SQLite, no CI | Fine for one legal entity; blocks hosting | Postgres + CI running `manage.py check`/`test api`/`npm run lint` on every push |

### 12.2 Verified while writing this document

* `python manage.py check` clean; `python manage.py test api` → **33/33 passing** (§10), including
  the new `test_admin.py` guard for the immutable ledger.
* `import_vss_services` and `import_vreal_products` write to `Category` / `Item` / `BusinessItem`
  for slugs `vss` and `vreal` — exercised with a temporary seed file, then the two probe rows were
  deleted again.
* `x-business` added to `CORS_ALLOW_HEADERS` — previously a cross-origin `X-Business` header would
  have been rejected by the browser preflight, silently pinning the SPA to the primary business.
* Generated artifacts (`.venv`, `__pycache__`, SQLite files) untracked (§11.2).
* Business switcher (#2) and POS idempotency keys (#4) implemented; eslint output for every
  touched file is byte-for-byte equal to its `HEAD` baseline (21 pre-existing errors in the
  shell/pages remain — `npm run lint` has never been clean repo-wide, only for the newer files).

### 12.3 Suggested next sprint

1. Grant-driven permission matrix (#1) with regression tests for each business role.
2. ~~Business switcher + idempotency keys in the POS (#2, #4)~~ — done 2026-09-29.
3. Migrate the remaining SPA pages to `/api/catalog/*`, then delete the shims and `branch_type` (#3, #5, #6).
4. `transfer_stock` and its UI (#8).
5. Postgres, CI, and a staging deploy (§11.1, #10).


