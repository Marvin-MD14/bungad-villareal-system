# Bungad & Villareal Management System — System Documentation

**Architecture:** Single company · many businesses · many branches · one catalog · centralized access control
**Stack:** Django 5.1 + Django REST Framework 3.15 (backend) · React 19 + Vite 8 + Tailwind 4 (frontend)
**Last updated:** 2026-09-30 · Backend suite: **98 tests across 8 modules** · Frontend suite: **17 tests** · `manage.py check`: clean · `manage.py erd --check`: clean · CI: `.github/workflows/ci.yml` · OpenAPI: 0 errors

> **Looking for the flow view?** [`ARCHITECTURE.md`](ARCHITECTURE.md) is the
> whole-system diagram set and process walkthrough — layers, every data connection,
> the request lifecycle, sign-in, checkout and the guard stack. This file is the
> reference inventory (models, endpoints, env vars, runbook); that file is the map.
> **Need to change a table's connections?** [`ERD.md`](ERD.md) lists all 55
> relationships with their delete policies, flags the ones that disagree with their
> neighbours, and is verified against the live schema by `manage.py erd --check`.
>
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
│       │                          reseed_demo · import_vss_services · import_vreal_products ·
│       │                          backup_db · erd
│       ├── migrations/            0001…0007 legacy · 0008–0010 SaaS refactor · 0011–0017 follow-ups
│       └── tests/                 8 modules, 90 tests (see §10)
├── frontend/
│   └── src/
│       ├── App.jsx                auth, router, axios instance, layout/shell
│       └── components/            CashierPOS · SalesPage · ClientsPage · CustomersRewardsPage ·
│                                  CustomerRewardsPanel · AdministrationPage · Crudtable ·
│                                  CustomerTierBadge
├── ARCHITECTURE.md               how the system behaves: request lifecycle, checkout,
│                                  scoping, auth — the flow view of the same codebase
├── ERD.md                       every model connection, its delete policy, and the
│                                  `manage.py erd --check` gate that keeps it honest
├── .github/workflows/ci.yml      backend suite · frontend lint/test/build
├── MULTI_BUSINESS_SAAS_PLAN.md   architecture plan (implemented)
├── MULTITENANT_SAAS_PLAN.md      superseded — do not follow
└── SYSTEM_DOCUMENTATION.md       this file
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

> ### Glossary — Business vs. Branch (they are NOT the same thing)
>
> This is the single most-confused pair in the system, so it is spelled out here:
>
> - A **Business** is the top operating unit — the thing the **Owner/superadmin
>   creates** (e.g. "Spa Biz", "Retail Biz"). It is the **parent** and the
>   **isolation boundary**; every scoped row carries its `business`.
> - A **Branch** is one physical **outlet** *of* a business (e.g. "Main",
>   "DSM-01"). Sales, expenses, rooms, stock and attendance hang off the branch;
>   the branch in turn belongs to exactly one parent business.
>
> So: **Business = parent / tenant the superadmin creates. Branch = its outlet.**
> The Owner can create as many businesses as the company runs, and each business
> then owns one or more branches. A grant may cover a whole business
> (`business=<biz>`) or be narrowed to specific outlets of it (`branches=[…]`).
> The two names are not interchangeable — a "branch" always implies its parent
> "business".

### 4.1 Structure & access (SaaS layer)

| Model | Table owner | Key fields | Purpose |
|-------|-------------|-----------|---------|
| `Company` | `api_company` | `legal_name`, `display_name`, `tax_id`, `default_currency`, `timezone`, `default_tax_rate`, `loyalty_enabled` | Singleton (`get_solo()`, `pk` forced to 1, `delete()` raises). Company defaults that businesses may override |
| `BusinessType` | `api_businesstype` | `code` (slug, unique), `name`, `icon`, `default_unit`, `tracks_stock` | Extensible kind of business — adding "Salon" is a DB row, not a code change |
| `Business` | `api_business` | `name`, `slug` (unique), `business_type` (PROTECT), `receipt_header`, `currency`, `tax_rate`, `loyalty_enabled`, `is_active` | The parent unit + isolation boundary (the business the Owner creates). Blank `currency`/`tax_rate` ⇒ inherit Company |
| `Branch` | `api_branch` | `business` FK (CASCADE), `code`, `name`, `branch_type` (legacy/derived), `address`, `is_active` | An outlet of exactly one `Business`. `business` drives scoping; `branch_type` is derived from the parent business for legacy POS catalog resolution |
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

`ClientProfile` (customers + loyalty tier), `CustomerReward`, `RewardClaim`,
`RoomTable`, `Transaction` + `TransactionItem` (now FK → `Item`), `DailySales` (per-branch daily
ledger), `Attendance` (unique on user + branch + date, so covering two outlets works),
`CustomerFeedback`, `Expense`, `AuditLog`, `UserProfile` (legacy single role/branch + `skills`).

> **Customers are per-business.** `ClientProfile.business` is the owning tenant; a customer
> (and their loyalty balance, rewards and claims) is invisible to every other business. This
> used to be a shared platform-wide list, which let a cashier at one outlet read and sell to
> another business's customers. A business-scoped caller always has its own business stamped
> on the customer it creates — the payload cannot choose — and a company-wide caller
> (`OWNER`/`SUPERADMIN`) must name the business. Migration `0017` backfilled existing rows from
> the business of a transaction the customer actually paid at, falling back to the first
> business on the platform.
> `CustomerReward` and `RewardClaim` have no `business` column of their own and inherit the
> tenant through `customer__business` / `reward__customer__business`.

### 4.4 Migration history

| Migration | Content |
|-----------|---------|
| `0001`–`0007` | Legacy schema (7 catalogs, branch-only hierarchy, loyalty, attendance, expenses, audit) |
| `0008_business_businessitem_businesstype_category_company_and_more` | Adds `Company`, `BusinessType`, `Business`, `UserAccess`, `BusinessItem`, `Category`, `InventoryLevel`, `StockMovement`, `Branch.business`, `Branch.code`; widens `Attendance` uniqueness |
| `0009_unified_catalog` | **Data migration**: copies the 7 legacy catalogs into `Item` + `Category` + `BusinessItem`, moves `BranchInventory` into `InventoryLevel` and writes opening-balance `StockMovement` rows |
| `0010_delete_autospaservice_delete_bbproduct_and_more` | Drops the 7 legacy catalog models + `BranchInventory` |
| `0011_branch_one_business` | Attaches orphan branches to a business (creating "Standalone Operations" if none), de-duplicates outlet names per business, makes `Branch.business` non-null and drops `branch_type` — the legacy label is derived now |
| `0012_role_grants_from_profiles` | Converts every `UserProfile.role`/`.branch` into a `UserAccess` grant **before** dropping those columns; adds `avatar`/`phone_number`, branch opening hours and `RoomTable.item` |
| `0013_transaction_item_branch_unit_price` | Gives `TransactionItem` its own `branch` and the `unit_price` / `description` snapshot a receipt needs |
| `0014_alter_transactionitem_catalog_source` | `catalog_source` becomes a derived receipt label rather than a routing decision |
| `0015_devicetoken` | Adds `DeviceToken`: per-device credentials, expiry, rotation chain |
| `0016_split_superadmin_from_owner` | Un-merges `SUPERADMIN` from `OWNER` (the §6.3 experiment) and re-points existing grants |
| `0017_clientprofile_business` | Gives `ClientProfile` its owning `business`, backfills it, and indexes `phone_number`; see §12 for the remaining nullable column |

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
| `access/models.py` | `UserAccess` grant model; `DeviceToken` — expiring, rotating, per-device credential (§7.9) |
| `access/middleware.py` | `BusinessMiddleware` — early (session/admin) context resolution |
| `access/authentication.py` | `BusinessContextMixin`, `DeviceTokenAuthentication` (rejects expired / rotated / revoked / password-stale keys), `BusinessSessionAuthentication` — apply context right after DRF authenticates |
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
   │     └─ DeviceTokenAuthentication.authenticate()  (Authorization: Token <key>)
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
| `SUPERADMIN` | `{'*'}` minus nothing | **Platform operator.** Creates/retires businesses and business types, hands out access grants, changes company settings. No denial list |
| `OWNER` | `{'*'}` minus `PLATFORM_DENIED_ACTIONS` | **Company owner.** Full read/write across every business, but may **not** restructure the platform it runs on (no `Business` / `BusinessType` / `UserAccess` writes, no `Company:update`) |
| `COMPANY_ADMIN` | `{'*'}` minus `COMPANY_ADMIN_DENIED_ACTIONS` | Every business, except user management and business types |
| `BUSINESS_MANAGER` | `{'*'}` minus `BUSINESS_MANAGER_DENIED_ACTIONS` | Everything inside its scope; denied company-level actions (branch comparison, access-grant CRUD, business & business-type writes) |
| `SUPERVISOR` | `{'*'}` minus `SUPERVISOR_DENIED_ACTIONS` | Like a Business Manager, but may not add or delete catalog entries |
| `CASHIER` | front-of-house allow-list | Catalogs, clients, rooms, checkout/void, reward claims, stock receiving, own attendance |
| `STAFF` | customer / room / attendance allow-list | No transactions, expenses, or inventory values |

> **SUPERADMIN vs OWNER.** §6.3 briefly folded these into one code, which made the
> header read "Role: Owner" for the superadmin account. They are distinct roles
> again because their jobs differ: the Superadmin operates the SaaS, the Owner
> runs the company. Same wildcard, different denials. Note that Django's
> `is_superuser` flag is a *separate* thing (it grants access to the Django admin
> site); API authorization keys off the `UserAccess` role, and migration `0016`
> re-labels any pre-existing platform operator's grant from `OWNER` to
> `SUPERADMIN` so they are not silently downgraded.

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
| `POST /api/auth/login/` | `{username, password, device_name?}` → `{token, expires_at, user{...}, businesses[], primary_business}`; writes an `AuditLog(LOGIN)`. The token is a per-device `DeviceToken` that expires (`API_TOKEN_LIFETIME_HOURS`, default 12) |
| `POST /api/auth/logout/` | Revokes **this device's** token only — other tills stay signed in |
| `POST /api/auth/rotate-token/` | Mints a fresh expiring token and revokes the presented one (renew a long shift without re-entering the password) |
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

### 7.4 Legacy routes: retired, not shimmed

The seven per-catalog URLs of the pre-SaaS schema (`/api/vss-services/`,
`/api/vreal-products/`, `/api/bb-products/`, `/api/panganan-menus/`, `/api/kb-items/`,
`/api/auto-spa/`), plus `/api/products/` and `/api/branch-inventory/`, **no longer
resolve**. They were kept alive as read-only shims over `Item` / `InventoryLevel` so the
SPA could migrate page by page; `SalesPage.jsx` and `AdministrationPage.jsx` were the last
callers and both now read `/api/catalog/items/` and `/api/catalog/inventory/`. With no
caller left, the shims and `business_catalog_queryset()` were deleted — two ways to read
one catalog was a standing invitation for the two answers to disagree.

If a request hits one of those paths today it gets `404`, which is the intended answer:
the route contract changed, and silence would have been worse. `/api/branch-catalog/` is
*not* a shim — it is the POS's catalog endpoint over the unified tables, and it stays.

---

## 8. Frontend (Single-Page App)

| Concern | Implementation |
|---------|----------------|
| Entry / shell | `src/App.jsx` — login screen, sidebar navigation, page switching, dark-mode toggle, header/layout |
| Routing | React Router 7 routes exist for the two unified-catalog pages (`/catalog/services`, `/catalog/products`, both backed by `GET /catalog/items/`); the remaining pages are switched inside the shell by an active-page state, gated by `canAccess(role, capability)` |
| HTTP | one shared `axios` instance in `src/utils/api.js` (plus the shell's own, which only adds a timeout). The request interceptor adds `Authorization: Token <token>` and `X-Business: <slug>` (helper in `src/utils/session.js`). The origin comes from `VITE_API_BASE_URL` (see `.env.example`); the old per-page copies of the base URL — one of which said `localhost` while the rest said `127.0.0.1` — are gone |
| Page data | Every list in the shell is fetched, not seeded. `App.jsx` loads `/dashboard/summary/`, `/user-profiles/`, `/catalog/items/`, `/catalog/inventory/`, `/audit-logs/` and `/rooms/` on sign-in and whenever the active business changes (`Promise.allSettled`, so one failing endpoint cannot blank the rest). It previously held hardcoded demo rows — five fake staff, five fake products, three fake audit entries, fifteen fake rooms and a fixed revenue series — which meant the dashboard, users, inventory, rooms and audit tabs rendered invented data that never touched the database |
| Nav permissions | `canAccess()` reads `GET /auth/capabilities/`, which derives the SPA's capability names from the live `ROLE_ACTIONS` matrix via `UI_CAPABILITY_PROBES` (`api/permissions.py`). The SPA's own `ROLE_CAPABILITIES` copy was a second, free-to-drift statement of the policy. Until that request resolves the nav shows nothing privileged |
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

**No longer legacy in the client:** `SalesPage.jsx` and `AdministrationPage.jsx` used to
load `/products/` and `/vss-services/` (compat shims, follow-up #3 in §12). Both now
read `/catalog/items/?item_type=…`, and the shell's catalog routes point at the same
endpoint. Both tills send an `Idempotency-Key` header on
checkout (one `crypto.randomUUID()` per attempted sale, reused while the cart is unsold), so a
retry replays the original sale instead of creating a second one.

---

## 9. Management Commands & Runbook

Run from `backend/`. Commands live in `api/management/commands/`.

| Command | What it does |
|---------|--------------|
| `python manage.py bootstrap_company` | Creates the singleton `Company`, the default `BusinessType` rows, the initial six `Business`es, and the `OWNER` access grant. Idempotent |
| `python manage.py create_demo_users` | Creates/updates the five local demo accounts (Superadmin, Owner, Business Manager, Cashier, Staff), each with the matching `UserAccess` grant(s) — cashier/staff pinned to the VSS `Main` branch, the Business Manager business-wide; also purges the retired Company Admin / Accountant / Supervisor demo accounts (2026-10-01 — their roles stay assignable) |
| `python manage.py setup_demo_data` | Convenience wrapper: migrate → import catalog seed files → create demo users |
| `python manage.py reseed_demo` | **Full demo rebuild (2026-10-01).** Wipes businesses/branches/users/grants and all operational rows, then seeds: 6 Businesses (VSS ×2 branches, VReal ×2, BB/Panganan/Auto Spa ×1, KB with no branch), one Business Manager per business, **1 cashier + 2 staff per branch** (the branch-less KB staffs the business itself), payment methods, loyalty programs, per-branch inventory/rooms/clients, **14 days of paid sales** with tendered payments + shifts + loyalty ledger, DailySales roll-ups, attendance, expenses and feedback. Deterministic seed; writes `DEMO_LOGINS.md` with every username/password. Dev-only — never run in production |
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
python manage.py reseed_demo      # optional: full org (6 businesses, 7 branches, 32 logins) + 14 days of demo ops
python manage.py createsuperuser
python manage.py runserver        # API on http://localhost:8000

cd ../frontend
npm install
npm run dev                       # SPA on http://localhost:5173
```

### 9.2 Routine verification

```bash
cd backend
python manage.py check                                   # system check (incl. api.E001)
python manage.py makemigrations --check --dry-run        # no model left un-migrated
python manage.py erd --check                             # ERD.md vs the live schema
python manage.py test api                                # full suite (90 tests)
python manage.py spectacular --file schema.yml           # OpenAPI regeneration
cd ../frontend && npm run lint && npm test && npm run build
```

### 9.3 Backup / restore

```bash
python manage.py dumpdata api --indent 2 -o backup.json
python manage.py loaddata backup.json
```

`backend/backup_pre_saas.json` is the snapshot taken immediately before the SaaS refactor.

## 10. Testing

Eight modules under `backend/api/tests/` — **98 tests**, plain Django `TestCase`,
SQLite test DB, no external services (`test_erd.py` needs no DB at all):

| Module | Covers |
|--------|--------|
| `test_api.py` (30) | Login success/failure; role gating (cashier reads catalogs but cannot manage branches, therapist cannot read transactions, admin can); branch-admin visibility; owner read-only on operational data; superuser creates branch admins and edits staff/branch; staffing gap report; checkout deducts stock; unauthenticated access rejected; client profile is org-wide; direct `POST /transactions/` rejected; void restores inventory and logs; branch-admin blocked from `branch_comparison` |
| `test_business_isolation.py` (23) | Cashier sees only granted-branch transactions; catalog scoped by active grant; **business switching via `X-Business`**; grant-less user falls back to own branch; owner sees every business; branch admin cannot create grants; checkout idempotency; insufficient-stock rejection; void restores stock and writes the ledger; login returns `businesses` + `primary_business`; serializer fields cannot smuggle another tenant; unscoped reads fail closed inside a request |
| `test_role_capability.py` (9) | Which grant decides a request when several exist (grant beats a stale profile, the active business picks the grant, revoked grants lock the account); then the per-role action matrix: business manager denied company-level actions, supervisor keeps operations but not catalog writes, company admin spans businesses but cannot manage users, accountant reads money and writes expenses but never sells, owner grant reaches every business |
| `test_write_scoping.py` (6) | The tenant stamp on **writes**: expense / room / feedback created by a business user are stamped and visible; a company-wide writer is stamped from the branch, not from its owner-less grant; saving a room or an expense onto another business's branch is rejected |
| `test_throttle_transfers.py` (13) | Checkout rate limiting (configured limit enforced, keyed per business, reads untouched); `transfer_stock`: moves stock and writes both balancing movements, creates the destination row, refuses to overdraw without side effects, refuses cross-business and self-transfers, denies a cashier; branch authority at checkout (a business grant covers every outlet, a narrowed grant pins the till to the ticked outlet, no grant = no sale) |
| `test_audit_immutability.py` (3) | Every write is correlated by `X-Request-ID` and a caller-supplied id is reused; a `Transaction` cannot be hard-deleted |
| `test_admin.py` (6) | The `StockMovement` ledger is visible but immutable through the Django admin: list renders, `add/` and POSTing a change or delete return 403, bulk delete leaves the rows in place |
| `test_erd.py` (8) | The `ERD.md` registry equals the live model graph; the tenant edges and the money-row `PROTECT`s are present; `--model` impact analysis; `--check` **must fail** when a relationship is undocumented; `--write` is idempotent |

Isolation tests deliberately mix auth styles — `APIClient` with `force_authenticate`/token **and**
`client.force_login` sessions — because the business context is resolved lazily (§5.3). Adding a
new scoped viewset? Add one isolation test that asserts a second business's rows are invisible,
and run `manage.py erd --check` if the change touched the schema.

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
6. Re-issue demo credentials — `create_demo_users` seeds known passwords and must never run in production. Neither must `reseed_demo`, which wipes and repopulates all tenant data (see `DEMO_LOGINS.md` for its generated accounts).

### 11.2 Repository hygiene

`.gitignore` covers `backend/.venv/`, `__pycache__/`, `backend/.env`, `backend/db.sqlite3*`,
`backup_pre_saas.json`, `frontend/node_modules/`, `frontend/dist/`. Those paths were previously
committed, so they have been **untracked** (`git rm -r --cached`) while staying on disk: tracked
files went from 7,210 → 60. Commit that removal once so clones stop carrying a virtualenv.

Debugging output created by piping the terminal (`*_err.txt`, `*_out.txt`, `backend/mg.txt`,
`frontend/bld.txt`) is now ignored too — a dozen such files had accumulated in the working
tree, and they are gone. `frontend/_pv.txt` is one of them and is locked by OneDrive on this
machine, so it survives on disk; it is ignored, and can be deleted whenever the lock clears.

The catalog **input** files the importers read (`seed_products.txt`, `seed_services.txt`) are
local-only too, and were never committed — the commands take the path as a positional
argument (`python manage.py import_vreal_products seed_products.txt`), and the rows they
produced are what lives in `db.sqlite3` (`32` categories, `257` items today). If those lists
are needed again, export them from a migrated database rather than re-typing them:
`python manage.py dumpdata api.Category api.Item api.BusinessItem --indent 2 > catalog.json`.

---

## 12. Known Gaps & Roadmap

### 12.1 Gaps, ordered by impact

| # | Gap | Where | Why it matters | Suggested fix |
|---|-----|-------|----------------|---------------|
| 1 | ~~Two role systems coexist~~ **closed** | `api/permissions.py::get_effective_role`, `UserProfile.role` | Closed: authorization reads the **active grant**; `UserProfile.role` is now a read-only property derived from the account's most-powerful active grant and is never a source of truth | Regression-covered by `test_role_capability.py` |
| 2 | ~~SPA has no business switcher~~ **closed** | `frontend/src/App.jsx`, `src/utils/session.js` | Closed 2026-09-29: login grants are kept in state, the header renders a **Business** picker (multi-business accounts), every axios instance injects `X-Business`, and switching remounts the workspace | Nothing left; per-request switching is covered by `test_business_isolation.py` |
| 3 | ~~Sales page on legacy shims~~ **closed** | `SalesPage.jsx`, `AdministrationPage.jsx` | Closed: both read `/api/catalog/items/?item_type=…`; no caller of the old routes remained | Shims deleted — see #6 |
| 4 | ~~No idempotency key from clients~~ **closed** | `CashierPOS.jsx`, `SalesPage.jsx` | Closed 2026-09-29: both tills generate one `crypto.randomUUID()` per attempted sale, send it as `Idempotency-Key`, and reuse it until the sale is recorded | Nothing left; the key resets only after a sale comes back |
| 5 | POS tabs are still keyed on `branch_type` | `CashierPOS.jsx` reads `branch_type` / `branch_type_display` off `/branch-catalog/by-branch/…` | The **column** is gone (migration `0011`) and the value is now derived from the parent business, but the client still groups its tabs by that legacy label instead of by `Category` | Group by category/business in the client, then drop the derived property and the two payload keys |
| 6 | ~~Compatibility shims still routed~~ **closed** | §7.4 | Closed: with #3 gone the eight legacy URLs 404 by design, and `business_catalog_queryset()` was deleted — one catalog, one way to read it | If an old device still calls them, fix the device |
| 7 | `backend/.venv` is incomplete | venv has Django 5.2 but no `drf_spectacular`; the system Python 3.10 matches `requirements.txt` | `manage.py` fails under the venv interpreter | Recreate it: `python -m venv backend/.venv` then `pip install -r backend/requirements.txt` |
| 8 | ~~Stock transfers unimplemented~~ **closed** | `api/sales/services.py::transfer_stock`, `POST /api/catalog/inventory/{id}/transfer/` | Closed: moves stock between two branches of **one** business atomically, writes the balancing `TRANSFER_OUT`/`TRANSFER_IN` pair with `balance_after`, and refuses overdrafts, self-transfers and cross-business moves | Client UI for the transfer form; the service and its 6 tests are in place |
| 9 | Import de-duplication is name-based | `import_vss_services`, `import_vreal_products` `get_or_create(name, item_type)`; `Item.barcode` is globally unique | Same-named services across businesses collapse into one `Item`, and a duplicated barcode is swallowed by the broad `except Exception` per-row handler | Key on `(business, name)` or a per-business SKU namespace; surface import errors instead of printing them |
| 10 | Postgres parity is untested | SQLite dev DB; `Company` singleton | CI (**added**: backend suite + `erd --check` + frontend lint/test/build) runs on SQLite too, so Postgres-specific behaviour — constraint names, `CheckConstraint` support, `on_delete` rebuilds — is unverified until deployment | Add a Postgres service job to `ci.yml` and run the same suite against it |
| 11 | Schema map can drift | `ERD.md` | Closed the moment it was written: `manage.py erd --check` compares the committed registry against the live model graph in CI and in `test_erd.py`, and one test proves the check can fail | Keep the diagrams' rationale columns honest by hand — only the registry is machine-checked |

### 12.2 Verified while writing this document

* `python manage.py check` clean; `python manage.py makemigrations --check` clean;
  `python manage.py test api` → **98/98 passing** (§10), including the `test_admin.py`
  guard for the immutable ledger and the `test_erd.py` gate for the schema map.
* `python manage.py erd --check` → `ERD.md matches the models (55 relationships)`, and
  `--model Branch` / `--model Business` confirm the inbound counts quoted in `ERD.md` §8.
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

1. ~~Grant-driven permission matrix (#1) with regression tests for each business role~~ — done,
   covered by `test_role_capability.py`.
2. ~~Business switcher + idempotency keys in the POS (#2, #4)~~ — done 2026-09-29.
3. ~~Delete the catalog shims (#3, #6)~~ — done; `transfer_stock` (#8) is live, so what is left
   of that list is **the POS tab grouping on `branch_type` (#5)** and a transfer form in the UI.
4. Work `ERD.md` §8 top to bottom: rows 1–3 are one `on_delete` change each, and each one ends
   with `erd --write` plus a diagram edit — the gate will not let the map stay stale.
5. Postgres parity job in CI (#10) and a staging deploy (§11.1).


