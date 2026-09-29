# Multi-Tenant SaaS POS — Architecture Review & Rebuild Plan

**System:** Bungad & Villareal Management System
**Goal:** Turn the current *single-company* POS into a **SaaS platform** where one company (tenant) can own **many businesses**, each with its own products/services of any kind, all sharing one database **without ever leaking data across companies**.
**Date:** 2026-09-26

---

## 1. Executive Summary

Today the backend assumes **one company** owns everything and that every business is one of four hard-coded flavors (`VSS`, `VREAL`, `BB`, `MIXED`). Adding a fifth kind of business today means editing **7 files** (model, serializer, viewset, url, permissions ×2, frontend). Onboarding a second company is **impossible** because names, barcodes and transaction numbers are globally unique and customers are shared globally.

The rebuild does three things:

| # | Change | Why |
|---|--------|-----|
| **A** | Introduce **Tenant (company) → Business → Location** hierarchy | One company, many businesses, many outlets — and room to add more later |
| **B** | Replace **7 hard-coded catalog tables** with **1 unified catalog** (`Category` + `Item` + per-business price) | "All kinds of products and services" becomes data, not code |
| **C** | Enforce isolation at **3 layers** (queryset manager, permissions, DB constraints) | No query can ever cross companies, even if a developer forgets a filter |

Net effect: **fewer tables, fewer endpoints, fewer duplicated serializers**, plus a hard tenant boundary.

---

## 2. Current State — What Blocks a SaaS Today

### 2.1 No company/tenant concept
`Branch` is the top of the hierarchy (`backend/api/models.py:12`) and is the only "owner" of anything.
There is no `Tenant`/`Company` model, so `ClientProfile`, `Product`, `Expense`, `AuditLog` and catalogs have **no owner at all** — they belong to "the system".

### 2.2 Global uniqueness = second company cannot exist
Every one of these will collide the moment a second company is onboarded:

| Field | Location | Problem |
|-------|----------|---------|
| `Branch.name` | `models.py:20` | Two companies can't both have "Main Branch" |
| `Product.name` | `models.py:102` | Same product name in two companies = `IntegrityError` |
| `Product.barcode` | `models.py:104` | Barcodes are reusable across companies |
| `Transaction.transaction_number` | `models.py:505` | Two companies generate the same receipt number |
| `DailySales (branch, date)` | `models.py:595` | OK per branch, but no tenant filter above it |
| `ClientProfile.phone_number` | `models.py:189` | Same customer/phone in two companies is ambiguous |

### 2.3 Business type is hard-coded, not data
Seven near-identical models exist for what is conceptually the same thing — **an item you sell**:

`Product` · `VSSService` · `VRealProduct` · `BBProduct` · `PangananMenu` · `KBItem` · `AutoSpaService`

Each one drags along its own serializer, viewset, URL, permission entries and frontend page. `TransactionItem` even carries **two nullable FKs** (`product`, `service`) plus a `catalog_source` enum (`models.py:548-563`) — a third catalog type would need a third nullable FK.

### 2.4 Isolation is manual and easy to forget
`branch_scoped_queryset()` (`views.py:45`) must be called **by hand inside every `get_queryset()`**. It is currently applied in 13 places. One forgotten call = a cross-branch (and later cross-company) data leak. There is no default-safe manager.

### 2.5 Roles are single and global
`UserProfile` is `OneToOneField(User)` with **one** role and **one** branch (`models.py:56-64`). A user cannot be:
- cashier at Business A **and** admin at Business B,
- a member of two companies,
- a platform superadmin without a fake profile.

### 2.6 Security & robustness gaps for a money-handling SaaS

| Area | Current state | Risk |
|------|---------------|------|
| Database | **SQLite** (`settings.py`) | Whole-DB write lock; `select_for_update()` barely helps → **double-sold stock** under real POS concurrency |
| Rate limiting | Global only (`100`/`1000` per min) | One noisy tenant starves everyone (no per-tenant quota) |
| Checkout idempotency | None | Network retry = **duplicate sale / double stock deduction** |
| Audit log | Has `branch`, no `tenant` | Cannot prove which company an action belongs to |
| Token auth | Single long-lived DRF token | No expiry, no rotation, no per-tenant scoping |
| Deletes | Hard deletes | A POS must never lose a receipt; no soft delete / retention |
| Tenant suspension / plans | None | Cannot bill, throttle or suspend a customer |

### 2.7 Data volume today (why a rebuild is cheap right now)
`13 users · 2 branches · 3 clients · 7 transactions · 30 transaction items · 160 VSS + 99 VReal catalog rows`
Everything fits in a single data migration — this is the **cheapest moment** to rebuild.

---


## 3. Target Architecture

### 3.1 The hierarchy

```
Platform
│
├── Tenant "Bungad Villareal Group"        ← the COMPANY that pays for the SaaS
│     │  (billing, plan, isolation boundary, data-ownership boundary)
│     │
│     ├── Business "VSS Aesthetic Spa"     ← one business they created
│     │     ├── Location "Cavite Main"
│     │     └── Location "Dasma Branch"
│     │
│     ├── Business "Panganan Kitchen"      ← another business, different kind
│     │     └── Location "Imus"
│     │
│     └── Business "Bungad Auto Spa"       ← added later, no code changes needed
│           └── Location "Bacoor"
│
└── Tenant "Another Company"               ← completely invisible to the first
      └── Business "Their Spa"
            └── Location "Main"
```

| Level | Owns | Answers |
|-------|------|---------|
| **Tenant** | Users, customers, loyalty program, catalog, reports, billing | "Whose data is this?" |
| **Business** | Its own catalog selection, prices, branding, business type | "Which business is this sale for?" |
| **Location** | Inventory, rooms/tables, transactions, attendance, daily ledger | "Which outlet?" |

**Design decision:** keep `Location` even if a business starts with one outlet. Inventory, rooms, attendance and daily sales are inherently location-scoped; retro-fitting a location later would be a second painful migration.

### 3.2 The four "hard limits" that prevent overlap

These are the rules that make coexistence safe. They are enforced in code **and** in the database.

**Rule 1 — Every tenant-owned row carries `tenant_id`.**
No exceptions. A row without a tenant is either platform-level (only `Tenant` itself, plans, platform staff) or a bug.

**Rule 2 — Queries are tenant-filtered *by default*, not by memory.**
Custom manager `TenantManager` returns only the active tenant's rows. A developer writing `Item.objects.all()` automatically gets their own tenant's items. Reading across tenants requires the explicit, reviewable `Item.all_objects` API.

**Rule 3 — Uniqueness is *per tenant*, never global.**
`UNIQUE(tenant_id, name)`, `UNIQUE(tenant_id, barcode)`, `UNIQUE(tenant_id, transaction_number)`, `UNIQUE(tenant_id, phone_number)`.
Two companies can use the same product name, the same barcode, the same customer phone — they simply live in different rows.

**Rule 4 — Cross-tenant references are impossible at the schema level.**
Every FK between tenant-owned rows is validated to share the same `tenant_id` (`clean()` + serializer validation + composite constraints). A `Transaction` from Tenant A can never point at an `Item` from Tenant B.

### 3.3 Isolation layers (defence in depth)

| Layer | Mechanism | Blocks |
|-------|-----------|--------|
| **L1 — Request** | `TenantMiddleware` resolves the tenant from the authenticated user's membership (or subdomain / `X-Tenant` header for platform staff) and stores it in a context variable. Missing tenant on a tenant endpoint ⇒ **403**. | Wrong tenant in URL/header |
| **L2 — ORM** | `TenantManager` + `TenantScopedModel.save()` auto-stamp and filter `tenant_id`. | A forgotten `.filter(tenant=...)` |
| **L3 — Permissions** | `TenantPermission` (is a member?) + `BusinessScopePermission` (role allowed in *this* business?) + the existing `ROLE_ACTIONS` matrix. | Wrong role, wrong business |
| **L4 — Database** | Composite unique constraints, `CheckConstraint(stock_qty >= 0)`, `on_delete=PROTECT` on money rows, and (Phase 4, PostgreSQL) **Row-Level Security** keyed on `app.tenant_id`. | Raw SQL, scripts, future code mistakes |

**Why RLS is worth it on PostgreSQL:** even a hand-written `psql` query or a future reporting notebook physically cannot read another company's rows. SQLite cannot do this at all — one of the reasons to switch engines.


## 4. New Database Schema (detailed)

### 4.1 Tenancy core — `backend/api/tenancy/models.py` *(new file)*

```python
from django.conf import settings
from django.db import models


class Plan(models.Model):
    """What a tenant is allowed to do (billing + feature limits)."""
    code = models.SlugField(unique=True)            # free / standard / enterprise
    name = models.CharField(max_length=100)
    max_businesses = models.PositiveIntegerField(default=1)
    max_locations = models.PositiveIntegerField(default=1)
    max_users = models.PositiveIntegerField(default=5)
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    features = models.JSONField(default=dict, blank=True)   # {"loyalty": true, "multi_currency": false}

    def __str__(self):
        return self.name


class Tenant(models.Model):
    """A company that subscribes to the platform. THE isolation boundary."""
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),          # non-payment / abuse → API returns 402
        ('TRIAL', 'Trial'),
        ('CLOSED', 'Closed'),
    ]

    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=60, unique=True)     # tenant-a.pos.example.com
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='tenants')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='TRIAL')
    default_currency = models.CharField(max_length=3, default='PHP')
    timezone = models.CharField(max_length=64, default='Asia/Manila')
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='owned_tenants',
        help_text='Billing owner / primary contact for this company',
    )
    settings = models.JSONField(default=dict, blank=True)   # receipt header, logo, tax defaults
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Membership(models.Model):
    """Links a user to a tenant with a role. Replaces UserProfile.role."""
    ROLE_CHOICES = [
        ('OWNER', 'Owner'),                  # full control of the company
        ('ADMIN', 'Company Admin'),          # manage businesses, users, catalog
        ('MANAGER', 'Business Manager'),     # one business
        ('SUPERVISOR', 'Supervisor'),        # one location, void/refund rights
        ('CASHIER', 'Cashier'),
        ('STAFF', 'Staff'),
        ('ACCOUNTANT', 'Accountant'),        # read-only finance
    ]

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_default = models.BooleanField(default=False, help_text='Tenant used when the user logs in')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('tenant', 'user')
        ordering = ['tenant__name', 'user__username']

    def __str__(self):
        return f'{self.user.username} @ {self.tenant.name} ({self.role})'


class MembershipScope(models.Model):
    """Narrows a membership to specific businesses / locations.

    No rows = membership covers the whole tenant.
    Rows   = membership is limited to exactly those businesses/locations.
    """
    membership = models.ForeignKey(Membership, on_delete=models.CASCADE, related_name='scopes')
    business = models.ForeignKey('Business', on_delete=models.CASCADE, null=True, blank=True, related_name='member_scopes')
    location = models.ForeignKey('Location', on_delete=models.CASCADE, null=True, blank=True, related_name='member_scopes')

    class Meta:
        unique_together = ('membership', 'business', 'location')
```

**Why this replaces `UserProfile`:** a user is no longer "one role, one branch". They hold a `Membership` **per company** and can be `CASHIER` in one company and `OWNER` in another. `MembershipScope` expresses "cashier only at the Dasma branch" without extra columns.

---


### 4.2 Business & Location — replaces `Branch` *(edit `backend/api/models.py`)*

```python
class Business(TimestampMixin):
    """One business a company owns. Business 'type' is data, not code."""
    tenant = models.ForeignKey('tenancy.Tenant', on_delete=models.CASCADE, related_name='businesses')
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=80)
    business_type = models.ForeignKey(
        'catalog.BusinessType', on_delete=models.PROTECT, related_name='businesses',
        help_text='Spa / Restaurant / Auto shop / Retail ... fully data-driven',
    )
    logo = models.ImageField(upload_to='tenant/business/', blank=True, null=True)
    receipt_header = models.TextField(blank=True)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)   # %
    currency = models.CharField(max_length=3, blank=True)                        # falls back to tenant
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('tenant', 'slug')          # NOT globally unique any more
        ordering = ['tenant__name', 'name']
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'name'], name='uniq_business_name_per_tenant'),
        ]

    def __str__(self):
        return f'{self.name}'


class Location(TimestampMixin):
    """A physical outlet of a business. Inventory, rooms and sales live here."""
    tenant = models.ForeignKey('tenancy.Tenant', on_delete=models.CASCADE, related_name='locations')
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='locations')
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=20, blank=True)        # e.g. DSM-01 for receipt numbering
    address = models.TextField(blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    opens_at = models.TimeField(null=True, blank=True)
    closes_at = models.TimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('business', 'name')
        ordering = ['business__name', 'name']

    def __str__(self):
        return f'{self.business.name} — {self.name}'
```

**Mapping from today:** `Branch` (2 rows) becomes 1 `Business` + 1 `Location` per branch, all under a single seeded `Tenant` ("Bungad Villareal Group"). The old `branch_type` choice list is replaced by the `BusinessType` table below — adding "Car Wash" later is an **INSERT, not a code change**.

### 4.3 Database-level guarantees (the part SQLite was missing)

```python
class Meta:
    constraints = [
        # Stock can never go negative, even if two cashiers hit the same item
        models.CheckConstraint(check=models.Q(stock_qty__gte=0), name='stock_qty_non_negative'),
        # One price row per (business, item)
        models.UniqueConstraint(fields=['business', 'item'], name='uniq_price_per_business_item'),
        # Per-tenant receipt numbering (was globally unique before)
        models.UniqueConstraint(fields=['tenant', 'transaction_number'], name='uniq_receipt_per_tenant'),
        # One ledger row per location per day
        models.UniqueConstraint(fields=['location', 'date'], name='uniq_daily_sales_per_location'),
    ]
```

---


## 5. The Unified Catalog — biggest simplification

### 5.1 What exists now (7 tables, 7 serializers, 7 viewsets, 7 routes)

| Model | Roughly the same fields |
|-------|------------------------|
| `Product` | name, category, barcode, purchase/selling price, min_stock |
| `VSSService` | category, description, price |
| `VRealProduct` | category, product, price, size |
| `BBProduct` | product_name, price, category |
| `PangananMenu` | category, menu, price |
| `KBItem` | name, price |
| `AutoSpaService` | service, price |

All seven are *"a thing with a name, a price, a category, and an active flag"*. The only real differences are the **category list** and whether it is stock-tracked.

### 5.2 What replaces them — `backend/api/catalog/models.py` *(new file)*

```python
class BusinessType(models.Model):
    """Spa / Salon / Restaurant / Auto shop / Retail — user-extensible."""
    code = models.SlugField(unique=True)          # 'spa', 'restaurant', 'auto-shop'
    name = models.CharField(max_length=100)
    default_unit = models.CharField(max_length=20, default='pc')   # pc / session / hour
    tracks_stock = models.BooleanField(default=True)
    is_platform = models.BooleanField(default=True)   # platform template vs tenant custom

    def __str__(self):
        return self.name


class Category(models.Model):
    """Grouping inside one tenant (Spa Services, Beverages, Soap ...)."""
    tenant = models.ForeignKey('tenancy.Tenant', on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=10, choices=[('PRODUCT', 'Product'), ('SERVICE', 'Service')])
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('tenant', 'name', 'kind')
        ordering = ['sort_order', 'name']


class Item(models.Model):
    """ONE table for every sellable thing, in every business, of every kind."""
    ITEM_TYPES = [('PRODUCT', 'Product'), ('SERVICE', 'Service')]
    DURATION_UNITS = [('MIN', 'Minutes'), ('HOUR', 'Hours'), ('DAY', 'Days')]

    tenant = models.ForeignKey('tenancy.Tenant', on_delete=models.CASCADE, related_name='items')
    item_type = models.CharField(max_length=10, choices=ITEM_TYPES)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='items')
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=64, blank=True)          # internal code
    barcode = models.CharField(max_length=100, blank=True)     # per-tenant unique
    description = models.TextField(blank=True)

    # Pricing (default; per-business overrides live in BusinessItem)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_taxable = models.BooleanField(default=True)

    # Stock behaviour (products only; services usually False)
    tracks_stock = models.BooleanField(default=True)
    min_stock = models.PositiveIntegerField(default=0)
    unit = models.CharField(max_length=20, default='pc')

    # Service behaviour
    duration = models.PositiveIntegerField(null=True, blank=True)
    duration_unit = models.CharField(max_length=5, choices=DURATION_UNITS, blank=True)
    requires_staff = models.BooleanField(default=False)
    requires_room = models.BooleanField(default=False)

    # Per-business extras that don't deserve a column (size, shade, engine type)
    attributes = models.JSONField(default=dict, blank=True)

    image = models.ImageField(upload_to='tenant/items/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'name', 'item_type'], name='uniq_item_name_per_tenant'),
            models.UniqueConstraint(
                fields=['tenant', 'barcode'],
                condition=~models.Q(barcode=''),
                name='uniq_barcode_per_tenant',
            ),
        ]
        indexes = [
            models.Index(fields=['tenant', 'item_type', 'is_active']),
            models.Index(fields=['tenant', 'barcode']),
        ]
```

---


### 5.3 One catalog, many businesses — `BusinessItem`

```python
class BusinessItem(models.Model):
    """Which items a business sells, and at what price.

    This is how ONE shared catalog serves MANY businesses without
    duplicating products — and how the same item can cost 150 at the
    spa and 130 at the kiosk.
    """
    tenant = models.ForeignKey('tenancy.Tenant', on_delete=models.CASCADE, related_name='business_items')
    business = models.ForeignKey('Business', on_delete=models.CASCADE, related_name='catalog_entries')
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='business_entries')
    price_override = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_available = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('business', 'item')

    @property
    def effective_price(self):
        return self.price_override if self.price_override is not None else self.item.selling_price
```

### 5.4 Inventory + stock ledger

```python
class InventoryLevel(models.Model):
    """Stock per LOCATION (replaces BranchInventory)."""
    tenant = models.ForeignKey('tenancy.Tenant', on_delete=models.CASCADE, related_name='inventory_levels')
    location = models.ForeignKey('Location', on_delete=models.CASCADE, related_name='inventory_levels')
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='inventory_levels')
    stock_qty = models.IntegerField(default=0)
    reorder_point = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('location', 'item')
        constraints = [
            models.CheckConstraint(check=models.Q(stock_qty__gte=0), name='inventory_non_negative'),
        ]


class StockMovement(models.Model):
    """Append-only stock ledger — the audit trail BranchInventory never had."""
    REASONS = [
        ('SALE', 'Sale'), ('VOID', 'Void/Return'), ('RECEIVE', 'Stock received'),
        ('ADJUST', 'Manual adjustment'), ('TRANSFER_OUT', 'Transfer out'),
        ('TRANSFER_IN', 'Transfer in'), ('WASTE', 'Damage/Waste'),
    ]

    tenant = models.ForeignKey('tenancy.Tenant', on_delete=models.CASCADE, related_name='stock_movements')
    location = models.ForeignKey('Location', on_delete=models.PROTECT, related_name='stock_movements')
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='stock_movements')
    quantity_delta = models.IntegerField()                 # +receive / -sale
    reason = models.CharField(max_length=20, choices=REASONS)
    reference = models.CharField(max_length=64, blank=True)  # transaction number
    balance_after = models.IntegerField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['tenant', 'item', 'created_at'])]
```

### 5.5 Sales line item (simplified)

```python
class TransactionItem(models.Model):
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey('catalog.Item', on_delete=models.PROTECT, null=True, blank=True)
    item_type = models.CharField(max_length=10, choices=[('PRODUCT', 'Product'), ('SERVICE', 'Service')])
    description = models.CharField(max_length=255)   # snapshot: name at time of sale
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.IntegerField(default=1)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    tenant = models.ForeignKey('tenancy.Tenant', on_delete=models.PROTECT, related_name='transaction_items')
```

**Why `description` and `unit_price` are duplicated on purpose:** a receipt must reprint exactly what was sold even if the item is later renamed or repriced. Do **not** normalise this away — it is the standard POS "snapshot" pattern.

### 5.6 Before / after

| Before | After |
|--------|-------|
| 7 catalog tables | **1** `Item` (+ `Category`, `BusinessType`) |
| 7 serializers, 7 viewsets, 7 routes | **2** of each (`Item`, `Category`) |
| `TransactionItem`: 2 nullable FKs + `catalog_source` enum | **1** nullable FK: `item` |
| New business kind = new model + view + url + perms + frontend page | New business kind = **1 row in `BusinessType`** |
| Same item in 2 businesses = 2 duplicated rows | 1 `Item` + 2 `BusinessItem` price rows |
| Stock changes with no history | `StockMovement` ledger (who, when, why) |
| Stock can go negative | DB `CheckConstraint` blocks it |

---


## 6. Enforcement Layer (security + robustness)

### 6.1 Automatic tenant filtering — `backend/api/tenancy/managers.py` *(new)*

```python
from contextvars import ContextVar
from django.core.exceptions import ValidationError
from django.db import models

_current_tenant = ContextVar('current_tenant', default=None)


def get_current_tenant():
    return _current_tenant.get()


def set_current_tenant(tenant):
    _current_tenant.set(tenant)


class TenantQuerySet(models.QuerySet):
    def for_tenant(self, tenant):
        return self.filter(tenant=tenant)


class TenantManager(models.Manager):
    """Default manager: silently scopes every query to the active tenant."""

    def get_queryset(self):
        tenant = get_current_tenant()
        qs = TenantQuerySet(self.model, using=self._db)
        if tenant is None:
            return qs.none()          # fail-closed: no tenant => no rows
        return qs.filter(tenant=tenant)


class TenantScopedModel(models.Model):
    """Inherit on every tenant-owned model. Stamps tenant, blocks cross-tenant FKs."""
    tenant = models.ForeignKey('tenancy.Tenant', on_delete=models.CASCADE, editable=False)

    objects = TenantManager()                    # default, tenant-filtered
    all_objects = models.Manager()               # platform / CLI / superadmin only

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.tenant_id is None:
            tenant = get_current_tenant()
            if tenant is None:
                raise ValueError('No active tenant: cannot save tenant-owned row.')
            self.tenant = tenant
        return super().save(*args, **kwargs)

    def clean(self):
        """Reject references that point at another tenant's data."""
        super().clean()
        for field in self._meta.fields:
            value = getattr(self, field.name, None)
            other = getattr(value, 'tenant_id', None)
            if other is not None and other != self.tenant_id:
                raise ValidationError({field.name: 'Cross-tenant reference is not allowed.'})
```

**Bootstrap/CLI note:** management commands and data migrations must call `set_current_tenant()` explicitly or use `all_objects`. That friction is intentional — "read every company" is always a deliberate, reviewable act.

### 6.2 Tenant resolution — `backend/api/tenancy/middleware.py` *(new)*

```python
class TenantMiddleware:
    """Resolve the active tenant once per request, then fail closed."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant = None
        user = getattr(request, 'user', None)
        request.tenant = None
        request.membership = None

        if user is not None and user.is_authenticated:
            memberships = Membership.objects.filter(
                user=user, is_active=True
            ).select_related('tenant')

            header = request.headers.get('X-Tenant')          # tenant switcher
            if header:
                chosen = memberships.filter(tenant__slug=header).first()
                tenant, request.membership = (chosen.tenant, chosen) if chosen else (None, None)
            if tenant is None:                                # default company
                chosen = memberships.filter(is_default=True).first() or memberships.first()
                tenant, request.membership = (chosen.tenant, chosen) if chosen else (None, None)

            # billing gate: suspended company cannot use the API
            if tenant and tenant.status in {'SUSPENDED', 'CLOSED'} and not user.is_staff:
                return JsonResponse({'detail': 'This account is not active.'}, status=402)

        set_current_tenant(tenant)
        try:
            return self.get_response(request)
        finally:
            set_current_tenant(None)      # never leak a tenant between requests
```

Register **after** `AuthenticationMiddleware`:

```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'api.tenancy.middleware.TenantMiddleware',        # <-- new, after auth
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

---


### 6.3 Tenant + business aware permissions — `backend/api/tenancy/permissions.py` *(new)*

```python
class TenantPermission(BasePermission):
    """User must be an active member of the request's tenant."""

    def has_permission(self, request, view):
        if getattr(request, 'tenant', None) is None:
            return False
        membership = getattr(request, 'membership', None)
        return bool(membership and membership.is_active)


class BusinessScopePermission(BasePermission):
    """Membership must cover the business/location being touched."""

    def has_object_permission(self, request, view, obj):
        target = getattr(obj, 'business', None) or getattr(obj, 'location', None)
        if target is None:
            return True
        scopes = getattr(request.membership, 'scopes', None)
        if scopes is None or not scopes.exists():
            return True                       # unscoped membership = whole tenant
        business_id = getattr(target, 'business_id', target.id)
        return scopes.filter(business_id=business_id).exists()
```

The existing `ROLE_ACTIONS` matrix keeps its job — it answers *"may a CASHIER create an Expense?"*; the new classes answer *"…and in which company / business?"*:

```python
class RoleBasedPermission(BasePermission):
    def has_permission(self, request, view):
        return (TenantPermission().has_permission(request, view)
                and action_allowed(get_user_role(request.user), view))
```

### 6.4 Removing the manual scoping call

`branch_scoped_queryset()` (13 manual call sites in `views.py`) disappears. Viewsets become boring:

```python
# BEFORE (easy to forget the filter in one view)
class ProductViewSet(AuditLogMixin, viewsets.ModelViewSet):
    def get_queryset(self):
        return branch_scoped_queryset(
            Product.objects.all(), self.request, branch_lookup='branch_inventories__branch_id'
        )

# AFTER (filtering is automatic and central; nobody can forget it)
class ItemViewSet(AuditLogMixin, viewsets.ModelViewSet):
    serializer_class = ItemSerializer
    permission_classes = [RoleBasedPermission]
    filterset_fields = ['item_type', 'category', 'is_active']

    def get_queryset(self):
        business_id = self.request.query_params.get('business')
        qs = Item.objects.select_related('category')       # already tenant-scoped
        if business_id:
            qs = qs.filter(business_entries__business_id=business_id,
                           business_entries__is_available=True)
        return qs
```

---

## 7. Security & Robustness Checklist

| # | Control | Change from today |
|---|---------|-------------------|
| 7.1 | **PostgreSQL instead of SQLite** (`DATABASES` from `DATABASE_URL`) | Real row locks, real concurrency, RLS, `select_for_update` that works |
| 7.2 | **Idempotent checkout** — `Idempotency-Key` header stored in `PaymentIntent`/`IdempotencyKey` table, unique per tenant; replaying the same key returns the original receipt instead of charging twice | Prevents double sales on retry |
| 7.3 | **Per-tenant rate limits** — throttle key includes `tenant_id` (`TenantRateThrottle`), plan-based quotas | One company can't starve others |
| 7.4 | **Atomic stock with `F()` expressions** — `InventoryLevel.objects.filter(pk=..., stock_qty__gte=qty).update(stock_qty=F('stock_qty') - qty)` then check the row count; plus the `CheckConstraint` as a hard stop | No negative stock / no lost update |
| 7.5 | **Money as `Decimal` + explicit `currency`** on tenant/business; never float; quantize to 2 dp at the boundary | Correct totals |
| 7.6 | **Immutable money rows** — `Transaction`, `TransactionItem`, `StockMovement`, `AuditLog` are never hard-deleted; use `voided_at` / reversal entries. Deletes only via status change | POS auditability |
| 7.7 | **Soft delete + `is_active`** for catalog/customer records; `on_delete=PROTECT` for anything referenced by money rows | No broken receipts |
| 7.8 | **Token/session hardening** — short-lived access token + refresh (or rotating DRF tokens), token invalidation on password change, one token per device | Token theft has a blast radius |
| 7.9 | **Tenant in the audit log** — `AuditLog.tenant` FK + `request_id`; every write logs tenant, user, business, location, IP | Provable per-company history |
| 7.10 | **Plan enforcement** — `max_businesses`, `max_users`, `max_locations` checked in serializers; exceeding ⇒ 402 with an upgrade message | Monetisation works |
| 7.11 | **Data lifecycle** — export-all for a tenant, and a documented close/erase procedure; per-tenant DB backup restore test | Contractual/compliance need |
| 7.12 | **Observability** — JSON logs always carrying `tenant_id`, `request_id`, `user_id`; `/healthz` (liveness) and `/readyz` (DB + cache) endpoints; error tracking | Fast incident triage |
| 7.13 | **Secrets & config** — `SECRET_KEY` per environment from a secret manager; `.env` never committed; `DEBUG=False` by default in prod (already added) | Credential hygiene |
| 7.14 | **Backups** — nightly `pg_dump` per tenant or full-cluster + PITR (WAL archiving); monthly restore drill | Recoverability |

---


## 8. File-by-File Change List

### 8.1 NEW files

| Path | Purpose |
|------|---------|
| `backend/api/tenancy/__init__.py` | Package marker |
| `backend/api/tenancy/models.py` | `Plan`, `Tenant`, `Membership`, `MembershipScope` |
| `backend/api/tenancy/managers.py` | `TenantQuerySet`, `TenantManager`, `TenantScopedModel`, context var |
| `backend/api/tenancy/middleware.py` | `TenantMiddleware` (resolve + fail closed + 402 gate) |
| `backend/api/tenancy/permissions.py` | `TenantPermission`, `BusinessScopePermission` |
| `backend/api/tenancy/throttling.py` | `TenantRateThrottle` (per-tenant quota) |
| `backend/api/catalog/models.py` | `BusinessType`, `Category`, `Item`, `BusinessItem`, `InventoryLevel`, `StockMovement` |
| `backend/api/catalog/serializers.py` | `ItemSerializer`, `CategorySerializer`, `BusinessItemSerializer`, `StockMovementSerializer` |
| `backend/api/catalog/views.py` | `ItemViewSet`, `CategoryViewSet`, `BusinessItemViewSet`, `InventoryViewSet` |
| `backend/api/catalog/services.py` | `checkout_service()`, `receive_stock()`, `adjust_stock()` — all business logic in one testable place |
| `backend/api/tenancy/tests/test_isolation.py` | Cross-tenant leak tests (the most important tests in the system) |
| `backend/api/management/commands/bootstrap_tenant.py` | `python manage.py bootstrap_tenant --name "X" --plan standard` (creates Tenant + OWNER + default Business/Location) |
| `backend/api/migrations/0008_tenancy_backfill.py` | Data migration: create Tenant #1, map `Branch` → `Business`+`Location`, `BranchInventory` → `InventoryLevel`, catalogs → `Item` |

### 8.2 EDITED files

| Path | What changes |
|------|--------------|
| `backend/api/models.py` | `Branch` → `Business` + `Location`; `UserProfile` → deprecated shim over `Membership`; add `tenant` to `ClientProfile`, `RoomTable`, `Transaction`, `TransactionItem`, `DailySales`, `Attendance`, `CustomerFeedback`, `Expense`, `AuditLog`, `CustomerReward`, `RewardClaim`; swap global `unique=True` for per-tenant uniques; delete the 7 catalog models. Consider **splitting this file**: `models/people.py`, `models/sales.py`, `models/ops.py` (it is already ~850 lines) |
| `backend/api/serializers.py` | Delete 5 obsolete catalog serializers; add `tenant`/`business`/`location` to payloads; make `TransactionSerializer` expose `receipt_number` per tenant |
| `backend/api/views.py` | Remove `branch_scoped_queryset` (13 call sites); `checkout` calls `catalog.services.checkout_service()` inside `transaction.atomic()` with idempotency key; `BranchCatalogViewSet` → `BusinessCatalogViewSet` returning one flat item list; add `tenant` from `request.tenant` instead of `get_user_branch()` |
| `backend/api/permissions.py` | Keep `ROLE_ACTIONS`; rename roles to `Membership.ROLE_CHOICES`; add tenant/business checks; `BRANCH_ADMIN_DENIED_ACTIONS` → `BUSINESS_ADMIN_DENIED_ACTIONS` |
| `backend/api/urls.py` | Collapse `vss-services`, `vreal-products`, `bb-products`, `panganan-menus`, `kb-items`, `auto-spa`, `products` → **`catalog/items/`**, `catalog/categories/`; keep old paths as read-only compatibility shims for one release |
| `backend/api/admin.py` | Register `Tenant`/`Membership`/`Item`; make `Tenant` read-only in admin for tenant users; platform admin only for cross-tenant views |
| `backend/core/settings.py` | PostgreSQL from `DATABASE_URL`; `TenantMiddleware`; tenant throttles; `MEDIA_ROOT` per tenant (`media/<tenant_slug>/`); plan/feature flags; `DEFAULT_PERMISSION_CLASSES` keeps `IsAuthenticated` |
| `backend/api/management/commands/create_demo_users.py` | Create users **+ memberships** in the seeded tenant (not bare Django `User` + groups) |
| `backend/api/tests.py` | Update to the new schema; keep the 4 existing behavioural tests; add isolation tests |

### 8.3 DELETED / deprecated

| Item | Replaced by |
|------|-------------|
| `VSSService`, `VRealProduct`, `BBProduct`, `PangananMenu`, `KBItem`, `AutoSpaService`, `Product` | `catalog.Item` |
| `BranchInventory` | `catalog.InventoryLevel` + `StockMovement` |
| `Branch` | `Business` + `Location` |
| `UserProfile` (role/branch/services) | `Membership` + `MembershipScope` + `Item.staff_skills` (M2M) |

---

## 9. Old → New Table Mapping (for the data migration)

| Old table | New table | Rule |
|-----------|-----------|------|
| `Branch` (2 rows) | `Tenant` (1: "Bungad Villareal Group") + `Business` (per row) + `Location` (per row) | `branch_type` → `BusinessType` lookup (`VSS`→spa, `BB`→retail, …) |
| `VSSService` (160) | `Item(item_type='SERVICE')` | `category`→`Category`, `description`→`name`, `price`→`selling_price` |
| `VRealProduct` (99) | `Item(item_type='PRODUCT')` | `product`→`name`, `size`→`attributes.size` |
| `Product` | `Item(item_type='PRODUCT')` | keep `barcode`, `min_stock`, `cost_price` |
| `BBProduct`, `PangananMenu`, `KBItem`, `AutoSpaService` | `Item` | one pass each; `category` → `Category(kind=...)` |
| `BranchInventory` | `InventoryLevel` + opening `StockMovement(reason='RECEIVE')` | `branch`→`location`, `product`→`item` |
| `ClientProfile` | `ClientProfile` + `tenant` | add tenant; phone uniqueness becomes per-tenant |
| `Transaction` | `Transaction` + `tenant`, `business`, `location` | `transaction_number` unique per tenant |
| `TransactionItem` | `TransactionItem` + `tenant`, `item` | Old `product`/`service` FKs → single `item` |
| `DailySales`, `Attendance`, `RoomTable`, `Expense`, `CustomerFeedback`, `AuditLog`, `CustomerReward`, `RewardClaim` | same name + `tenant` (+ `business`/`location`) | backfill all to Tenant #1 |
| `BranchCatalog` viewset | `BusinessCatalogViewSet` | one flat list from `BusinessItem` |

---


## 10. Migration Roadmap (phased — the app keeps working)

Do **not** do this in one commit. Expand → migrate → contract.

| Phase | Work | Exit test |
|-------|------|-----------|
| **0 — Prep** *(½ day)* | Move to PostgreSQL (dev + prod), back up `db.sqlite3`, freeze feature work | `migrate` runs on Postgres; 17 tests pass |
| **1 — Tenancy core** *(1–2 days)* | Add `Plan`, `Tenant`, `Membership`, `MembershipScope`, middleware, managers; data migration creates Tenant #1 + one Membership per existing user | Every endpoint still works; user of Tenant A cannot read Tenant B |
| **2 — Business & Location** *(1–2 days)* | Add `Business` + `Location`, backfill from `Branch`, add `business`/`location` FKs to `RoomTable`, `Transaction`, `DailySales`, `Attendance`; keep `Branch` as a read-only view | Checkout works on the new hierarchy; receipts show business + location |
| **3 — Unified catalog** *(2–3 days)* | Add `Category`, `Item`, `BusinessItem`, `InventoryLevel`, `StockMovement`; migrate all 7 catalogs; switch checkout to `Item`; **keep old routes as shims** | Old frontend still renders via shims; `/catalog/items/` returns everything |
| **4 — Tenant scoping everywhere** *(2 days)* | Add `tenant` to all remaining models, composite uniques, check constraints; drop global `unique=True`; enable Postgres RLS | Isolation suite green; `psql` as a tenant role cannot read other rows |
| **5 — Hardening** *(1–2 days)* | Idempotency keys, per-tenant throttles, `F()` stock updates, `AuditLog.tenant`, soft deletes, plan limits, `/healthz` | Replaying checkout twice ⇒ one sale; audit log shows tenant |
| **6 — Cleanup** *(1 day)* | Delete the 7 legacy tables, `BranchInventory`, `Branch`; remove shims; split `models.py`; update `updates.md` | Dead code gone; check + test suite green |

**Rollback story:** every phase is additive until Phase 6, and Phase 6 only drops tables unused for one release — keep the pre-Phase-6 `pg_dump` for a month.

### 10.1 Useful commands

```bash
# Phase 0
python manage.py dumpdata --indent 2 > backup_$(date +%F).json

# Phase 1
python manage.py makemigrations tenancy
python manage.py migrate
python manage.py bootstrap_tenant --name "Bungad Villareal Group" --plan standard

# Phase 4 — PostgreSQL row-level security
python manage.py shell -c "from api.tenancy.rls import enable_rls; enable_rls()"
```

---

## 11. API & Frontend Impact

| Area | Today | After |
|------|-------|-------|
| Login | `POST /api/auth/login/` → `token` + `user.branch` | also returns `tenants[]`, `default_tenant`, `default_business` |
| Tenant switch | not possible | `X-Tenant: <slug>` header (middleware handles it) |
| Catalog reads | 7 endpoints (`/vss-services/`, `/vreal-products/`, `/bb-products/`, …) | 2 endpoints (`/catalog/items/?business=<id>&item_type=SERVICE`); old paths kept as **read-only shims** for one release |
| POS catalog | `/branch-catalog/by-branch/{id}/` → 3 nested arrays | `/business-catalog/{business_id}/` → 1 flat array `{id, name, price, item_type, category}` |
| Inventory | `/branch-inventory/` | `/inventory/?location=<id>` + `/inventory/movements/` |
| Reports | `/dashboard/summary/` (branch-scoped) | same + `?business=`/`?location=` slicing, plus `/reports/consolidated/` for multi-business totals |
| Every response | no tenant info | adds `tenant`, `business`, `location` ids so the UI can label screens |

**Frontend work needed (Phase 6):** tenant/business switcher in the header, `X-Tenant` on every request, `CrudTable` pointed at `/catalog/items/` with a dynamic column map instead of one page per catalog, and a business selector on POS + dashboard.

---


## 12. Test Plan (what "safe coexistence" must prove)

| # | Test | Expected |
|---|------|----------|
| 12.1 | Tenant A lists items; Tenant B has items with the **same names** | A sees only A's rows |
| 12.2 | Tenant A requests Tenant B's item by id | **404** (not 403 — do not confirm existence) |
| 12.3 | Tenant A posts a transaction referencing B's `Item` | **400** validation error |
| 12.4 | Tenant A and Tenant B both create `Transaction` #000123 | Both succeed (per-tenant numbering) |
| 12.5 | Same phone registered as a customer in both tenants | Both succeed; loyalty stays separate |
| 12.6 | Cashier scoped to Location 1 posts a sale for Location 2 | **403** |
| 12.7 | Suspended tenant calls any endpoint | **402** |
| 12.8 | Two parallel checkouts of the last unit of stock | Exactly one succeeds; stock ends at 0, never −1 |
| 12.9 | Same `Idempotency-Key` replayed | One transaction, original receipt returned |
| 12.10 | `Membership` removed mid-session | Next request → **403** |
| 12.11 | Management command without `set_current_tenant()` touches tenant data | Raises `ValueError` (fail closed) |
| 12.12 | PostgreSQL RLS: connect as a tenant role, `SELECT * FROM api_item` | Only that tenant's rows |

---

## 13. Decisions Needed From You

1. **Is "Business" the right second level, or should every outlet be a Business?** (Recommended: Business = the kind of operation, Location = the physical outlet.)
2. **Do loyalty points belong to the company or to one business?** (Recommended: company-level, so a customer is rewarded across all their businesses.)
3. **The same item sold by two businesses — one shared `Item` with a per-business price, or a separate `Item` each?** (Recommended: shared `Item` + `BusinessItem` price override.)
4. **Per-tenant subdomains (`tenant.yourdomain.com`) or just the `X-Tenant` header?** (Header is simpler; subdomains look nicer for branding.)
5. **PostgreSQL hosting:** managed (RDS / Neon / Supabase) or self-hosted? Affects backups and the RLS rollout.
6. **Should existing single-company data become Tenant #1** (recommended, zero data loss) **or start clean?**

---

## 14. Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| Catalog models | 7 | 1 (`Item`) + 2 support tables |
| Catalog endpoints | 7 viewsets / 7 routes | 2 viewsets / 2 routes |
| Top-level owner of data | `Branch` (per business) | `Tenant` (per company) |
| Manual tenant/branch filters | 13 call sites, easy to forget | 0 (automatic manager) |
| Companies supported | 1 | Unlimited |
| Businesses per company | one type each, hard-coded | Unlimited, data-driven |
| Stock ledger | none | Full `StockMovement` history |
| Cross-tenant leak tests | 0 | 12 automated tests |
| Concurrency safety | SQLite lock | Postgres row locks + DB constraints |

**Bottom line:** the rebuild *removes* code (7 catalog stacks → 1, 13 manual scopes → 0) while *adding* two ideas — a `Tenant` above everything, and one `Item` table for everything. That is what makes "many companies, many businesses, every kind of product" safe to run on a single database.

---

## 15. What I Can Do Next (pick one)

| Option | Scope | Time |
|--------|-------|------|
| **A. Prototype the tenancy core** | Create `api/tenancy/` (models, managers, middleware, permissions, `bootstrap_tenant` command) + migrations + isolation tests, on top of the current models — nothing deleted, app keeps working | ~1 session |
| **B. Prototype the unified catalog** | Create `api/catalog/` beside the 7 legacy tables + a data migration + a compatibility shim so the existing frontend keeps working | ~1 session |
| **C. Full Phase 0–1** | Postgres switch + tenancy core + backfill Tenant #1 + isolation tests green | ~2 sessions |
| **D. Review only** | Answer the 6 questions in §13 first, then I refine this document into a ticket-by-ticket task list | now |

**Nothing was changed in the running application** — this document is a plan only. The current app is untouched: `manage.py check` clean, 17/17 tests passing.

---
