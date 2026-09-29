# Multi-Business POS — Architecture Review & Rebuild Plan

**System:** Bungad & Villareal Management System
**Corrected scope:** **ONE company.** That company runs **many businesses** (spa, kitchen, auto shop, …), and each business has **many branches**.
**No multi-tenant layer is needed.** The isolation boundary is **Business**, and the scoping unit for operations is **Branch**.
**Date:** 2026-09-26

> This document supersedes `MULTITENANT_SAAS_PLAN.md`, which wrongly assumed many separate companies.

---

## 1. Executive Summary

The good news: because there is only **one company**, most of the hard multi-tenant problems disappear. Names, barcodes and receipt numbers **may stay unique company-wide** — no composite-tenant keys, no tenant billing, no tenant suspension, no per-tenant RLS.

What is still missing is the middle layer. Today the hierarchy is flat:

```
NOW:   Branch  ──────────────────────────►  everything hangs off a "branch"
       (VSS / VREAL / BB / MIXED)

WANTED: Company
          └── Business  ("VSS Aesthetic Spa", "Panganan Kitchen", ...)
                └── Branch  ("Cavite Main", "Dasma", ...)
```

Three changes deliver the whole goal:

| # | Change | Why |
|---|--------|-----|
| **A** | Add **`Business`** between Company and `Branch` | One company can run many businesses; branches belong to a business |
| **B** | Replace the **7 hard-coded catalog tables** with **1 unified catalog** (`Category` + `Item` + per-business price) | "All kinds of products and services, usable by every business they create" becomes data, not code |
| **C** | Replace **1 role + 1 branch per user** with **`UserAccess`** (role in a business, optionally limited to branches) | A user can be a cashier at the spa and a manager at the kitchen; the owner sees everything |

Net effect: **fewer tables, fewer endpoints, fewer duplicated serializers** — while gaining a real business/branch boundary.

---

## 2. Current State — What Blocks "One Company, Many Businesses"

| # | Blocker | Where | Consequence |
|---|---------|-------|-------------|
| 2.1 | **No `Business` model** — `Branch` is the top level | `models.py:12` | "Business" and "branch" are the same thing; a spa branch and a kitchen branch are peers instead of belonging to different businesses |
| 2.2 | **Business kind is a hard-coded enum on the branch** — `branch_type` = `VSS`/`VREAL`/`BB`/`MIXED` | `models.py:13-26` | Adding a 5th business type = edit model, serializer, viewset, urls, permissions ×2, frontend |
| 2.3 | **7 near-identical catalog tables** — `Product`, `VSSService`, `VRealProduct`, `BBProduct`, `PangananMenu`, `KBItem`, `AutoSpaService` | `models.py:87-484` | Adding a business type means adding another catalog stack; a new item kind needs another nullable FK on `TransactionItem` |
| 2.4 | **A user has exactly one role and one branch** | `models.py:56-64` | No multi-business managers, no owner-over-everything, no supervisor over 2 outlets |
| 2.5 | **Staff skills are hard-wired to one catalog** — `UserProfile.services` → `VSSService` | `models.py:65-69` | A kitchen staff member cannot be linked to kitchen services |
| 2.6 | **Isolation between branches is manual** — `branch_scoped_queryset()` is called by hand in 13 places | `views.py:45` | One forgotten call = a spa manager seeing kitchen data |
| 2.7 | **`Attendance (user, date)` is unique** | `models.py:623` | A staff member covering two branches on one day **cannot check in at both** — a real bug once multi-branch staff exist |
| 2.8 | **`UserProfile.role` drives permissions with no business context** | `permissions.py` | `BRANCH_ADMIN` is a wildcard inside one branch, but there is no "manager of business X" or "owner of the company" |
| 2.9 | **SQLite** | `settings.py` | Whole-DB write lock; `select_for_update()` barely helps → **double-sold stock** in real POS use |

**What is already right and should be kept:** single company means `Item.name`, `barcode` and `ClientProfile` staying globally unique is *correct*; `DailySales (branch, date)` unique is *correct*; the `ROLE_ACTIONS` permission matrix is a good pattern; login throttling, `IsAuthenticated` default, PostgreSQL-ready settings work, and the audit-log mixin are all reusable.

**Data volume today:** `13 users · 2 branches · 3 clients · 7 transactions · 30 line items · 160 VSS + 99 VReal catalog rows` — everything fits in one data migration. This is the cheapest moment to restructure.


## 3. Target Architecture

### 3.1 The hierarchy

```
Company  "Bungad & Villareal Group"          ← ONE company (a single settings row)
│   owns: catalog, customers, users, loyalty, reports
│
├── Business  "VSS Aesthetic Spa"            ← type: spa
│     ├── Branch  "Cavite Main"
│     └── Branch  "Dasma"
│
├── Business  "Panganan Kitchen"             ← type: restaurant
│     └── Branch  "Imus"
│
└── Business  "Bungad Auto Spa"              ← type: auto-shop (added later, no code change)
      └── Branch  "Bacoor"
```

### 3.2 Who owns what — the rule that decides every foreign key

| Level | Owns | Examples |
|-------|------|----------|
| **Company** | Shared master data | `Category`, `Item` (the catalog pool), `ClientProfile`, `CustomerReward`, `RewardClaim`, `UserAccess`, `AuditLog` |
| **Business** | What this business sells, at what price | `BusinessItem` (availability + price override), branding, tax rate, `BusinessType` |
| **Branch** | Physical operations | `InventoryLevel`, `StockMovement`, `RoomTable`, `Transaction`, `TransactionItem`, `DailySales`, `Attendance`, `Expense`, `CustomerFeedback` |

**Design intent:** the company owns one shared catalog and one shared customer list, so *"all kinds of products and services can be used on all businesses that they create"* — a new business simply subscribes to the items it needs. Its stock, sales and staff time stay **per branch**.

### 3.3 The four rules that stop data from overlapping

**Rule 1 — Every operational row carries `business_id` (and `branch_id` when it is branch-level).**
Reports, permissions and filters then have one obvious key to use.

**Rule 2 — Company-wide roles see everything; business/branch roles are auto-filtered.**
`OWNER`, `COMPANY_ADMIN`, `ACCOUNTANT` → all businesses. `BUSINESS_MANAGER`, `SUPERVISOR`, `CASHIER`, `STAFF` → only their business, and only their branches when the access row narrows it.

**Rule 3 — Filtering is automatic, not remembered.**
A `BusinessScopedManager` filters by the request's *active business* by default. `Transaction.objects.all()` means "this business's transactions", not "every body's". Reading across businesses requires the explicit `all_businesses()` API — always a visible, reviewable decision.

**Rule 4 — Cross-business references are rejected, and money rows are constrained by the database.**
`clean()` refuses an FK pointing at another business; `CHECK(stock_qty >= 0)` makes negative stock impossible; `on_delete=PROTECT` keeps receipts intact; uniqueness for receipts is per business.

### 3.4 Scoping layers (defence in depth)

| Layer | Mechanism | Blocks |
|-------|-----------|--------|
| **L1 — Request** | `BusinessMiddleware` resolves the active business from `X-Business` (or the user's primary access) and stores it in a context variable | Wrong business selected in the UI |
| **L2 — ORM** | `BusinessScopedManager` + `BusinessScopedModel.save()` auto-stamp and filter | A forgotten `.filter(business=...)` |
| **L3 — Permissions** | UserAccess role + branch scope + the existing `ROLE_ACTIONS` matrix | Wrong role, wrong branch |
| **L4 — Database** | `CheckConstraint(stock_qty >= 0)`, `UNIQUE(business, transaction_number)`, `UNIQUE(business, name)` on branches, `PROTECT` on money rows | Bugs, scripts, raw SQL |

**No tenant layer, no billing, no RLS** — those were only needed for many separate companies.

---


## 4. New Database Schema (detailed)

### 4.1 Company — one row, company-wide settings *(new: `backend/api/company/models.py`)*

```python
class Company(models.Model):
    """The single company that owns everything. Use Company.get_solo()."""
    legal_name = models.CharField(max_length=200, default='Bungad & Villareal Group')
    display_name = models.CharField(max_length=150, blank=True)
    logo = models.ImageField(upload_to='company/', blank=True, null=True)
    tax_id = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    default_currency = models.CharField(max_length=3, default='PHP')
    timezone = models.CharField(max_length=64, default='Asia/Manila')
    default_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    receipt_footer = models.TextField(blank=True)
    loyalty_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Company'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1                      # enforce singleton
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError('The Company record cannot be deleted.')
```

**Why a singleton model instead of `settings.py`:** the owner must be able to change the receipt footer, tax default and logo **without a deploy**. This is configuration, not code.

### 4.2 Business — the new middle layer *(new: `backend/api/business/models.py`)*

```python
class BusinessType(models.Model):
    """Spa / Salon / Restaurant / Auto shop / Retail — user-extensible, not code."""
    code = models.SlugField(unique=True)              # 'spa', 'restaurant', 'auto-shop'
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=40, blank=True) # lucide icon name for the UI
    default_unit = models.CharField(max_length=20, default='pc')   # pc / session / hour
    tracks_stock = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Business(models.Model):
    """One business the company runs. Branches belong here."""
    name = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=80, unique=True)
    business_type = models.ForeignKey(
        BusinessType, on_delete=models.PROTECT, related_name='businesses',
        help_text='Spa / Restaurant / Auto shop ... determines default item kinds',
    )
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='business/', blank=True, null=True)
    receipt_header = models.TextField(blank=True)
    currency = models.CharField(max_length=3, blank=True)        # blank = use Company default
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    loyalty_enabled = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Businesses'

    def __str__(self):
        return self.name
```

### 4.3 Branch — edited, not replaced *(keep the name; the frontend already speaks "branch")*

```python
class Branch(models.Model):
    business = models.ForeignKey(              # <-- NEW
        'business.Business', on_delete=models.CASCADE, related_name='branches'
    )
    name = models.CharField(max_length=100)    # was unique=True -> now per business
    code = models.CharField(max_length=20, blank=True)   # 'DSM-01', used in receipt numbers
    address = models.TextField(blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    opens_at = models.TimeField(null=True, blank=True)
    closes_at = models.TimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('business', 'name')          # replaces global unique
        ordering = ['business__name', 'name']
        verbose_name_plural = 'Branches'

    def __str__(self):
        return f'{self.business.name} — {self.name}'
```

`branch_type` is **deleted** — its job moves to `Business.business_type`. `Branch` keeps its id everywhere, so existing FKs (`Transaction.branch`, `DailySales.branch`, `Attendance.branch`) need **no change** — that is why keeping the name matters.

---


### 4.4 UserAccess — replaces "one role, one branch" *(new)*

```python
class UserAccess(models.Model):
    """What a user may do, and where. One row per (user, business).

    Company-wide roles (OWNER / COMPANY_ADMIN / ACCOUNTANT) use business=None
    and see every business. Business roles must set a business; `branches`
    narrows them further (empty = every branch of that business).
    """
    COMPANY_ROLES = {'OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'}
    ROLE_CHOICES = [
        ('OWNER', 'Owner'),
        ('COMPANY_ADMIN', 'Company Admin'),
        ('ACCOUNTANT', 'Accountant'),
        ('BUSINESS_MANAGER', 'Business Manager'),
        ('SUPERVISOR', 'Supervisor'),
        ('CASHIER', 'Cashier'),
        ('STAFF', 'Staff'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='access_grants')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    business = models.ForeignKey(
        'business.Business', on_delete=models.CASCADE,
        null=True, blank=True, related_name='access_grants',
        help_text='NULL = company-wide role',
    )
    branches = models.ManyToManyField(
        Branch, blank=True, related_name='access_grants',
        help_text='Empty = all branches of the business',
    )
    is_primary = models.BooleanField(default=False, help_text='Business the user lands on after login')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'role', 'business')
        ordering = ['user__username', 'business__name']
        constraints = [
            # company roles must not carry a business; business roles must have one
            models.CheckConstraint(
                check=(models.Q(role__in=['OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'], business__isnull=True)
                       | ~models.Q(role__in=['OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'])),
                name='company_role_has_no_business',
            ),
        ]

    @property
    def is_company_wide(self):
        return self.role in self.COMPANY_ROLES

    def branch_ids(self):
        return list(self.branches.values_list('id', flat=True))

    def __str__(self):
        where = self.business.name if self.business else 'Whole company'
        return f'{self.user.username} — {self.role} @ {where}'
```

**`UserProfile` survives but loses its job.** It keeps personal data only (avatar, phone, skills); role and branch move to `UserAccess`. Staff skills stop pointing at one catalog table:

```python
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='staff/', blank=True, null=True)
    skills = models.ManyToManyField('catalog.Item', blank=True, related_name='skilled_staff',
                                    help_text='Services this staff member can perform')
    # role / branch / services  -> REMOVED (see UserAccess)
```

**What this unlocks:**

| Scenario | Today | After |
|----------|-------|-------|
| Owner sees all businesses | not expressible | `UserAccess(role='OWNER', business=None)` |
| Manager of the spa only | `BRANCH_ADMIN` on one branch | `UserAccess(role='BUSINESS_MANAGER', business=spa)` |
| Cashier at 2 of 3 spa branches | not possible | `UserAccess(role='CASHIER', business=spa, branches=[A, B])` |
| Accountant reads finance for all | not possible | `UserAccess(role='ACCOUNTANT', business=None)` |
| Staff covering two branches in one day | blocked by the unique constraint | see §4.6 |

### 4.5 Fixes to existing models

| Model | Change |
|-------|--------|
| `Branch` | + `business` FK, + `code`, − `branch_type`, unique per business |
| `Attendance` | `unique_together = ('user', 'date')` → **`('user', 'branch', 'date')`** — otherwise a staff member working two branches cannot check in twice |
| `Transaction` | + `business` FK (denormalised for reports/scoping), + `idempotency_key` (unique, nullable) |
| `TransactionItem` | `product`/`service`/`catalog_source` → **one** `item` FK + snapshot `description`/`unit_price` |
| `DailySales` | keeps `('branch', 'date')` (already correct); + `business` for fast reporting |
| `Expense` | + `business`; `branch` stays |
| `CustomerFeedback` | + `business` (branch already set) |
| `RoomTable` | + `business` (branch already set); `service_type` free text → optional `Item` FK |
| `ClientProfile` | unchanged ownership (company-level) — shared loyalty across businesses; add index on `phone_number` |
| `AuditLog` | + `business`, + `branch` (already), + `request_id`, + `user_agent` |
| `Product`/`VSSService`/`VRealProduct`/`BBProduct`/`PangananMenu`/`KBItem`/`AutoSpaService`/`BranchInventory` | **deleted** in Phase 5 — replaced by the unified catalog |

---


## 5. The Unified Catalog — biggest simplification

### 5.1 What exists now (7 tables, 7 serializers, 7 viewsets, 7 routes)

`Product` · `VSSService` · `VRealProduct` · `BBProduct` · `PangananMenu` · `KBItem` · `AutoSpaService`

All seven are *"a thing with a name, a price, a category and an active flag"*. The only real differences are the category list and whether stock is tracked.

### 5.2 What replaces them *(new: `backend/api/catalog/models.py`)*

```python
class Category(models.Model):
    """Grouping inside the company catalog (Spa Services, Beverages, Soap ...)."""
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=10, choices=[('PRODUCT', 'Product'), ('SERVICE', 'Service')])
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('name', 'kind')
        ordering = ['sort_order', 'name']
        verbose_name_plural = 'Categories'


class Item(models.Model):
    """ONE table for every sellable thing — every kind of product and service."""
    ITEM_TYPES = [('PRODUCT', 'Product'), ('SERVICE', 'Service')]

    item_type = models.CharField(max_length=10, choices=ITEM_TYPES)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='items')
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=64, blank=True)
    barcode = models.CharField(max_length=100, unique=True, null=True, blank=True)
    description = models.TextField(blank=True)

    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_taxable = models.BooleanField(default=True)

    tracks_stock = models.BooleanField(default=True)      # services usually False
    min_stock = models.PositiveIntegerField(default=0)
    unit = models.CharField(max_length=20, default='pc')  # pc / session / hour

    duration = models.PositiveIntegerField(null=True, blank=True)       # services
    duration_unit = models.CharField(max_length=5, blank=True, choices=[('MIN', 'Minutes'), ('HOUR', 'Hours')])
    requires_staff = models.BooleanField(default=False)
    requires_room = models.BooleanField(default=False)

    attributes = models.JSONField(default=dict, blank=True)   # size, shade, engine type ...
    image = models.ImageField(upload_to='items/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # single company -> global uniqueness is CORRECT and simpler
        unique_together = ('name', 'item_type')
        indexes = [models.Index(fields=['item_type', 'is_active']), models.Index(fields=['barcode'])]
        ordering = ['name']


class BusinessItem(models.Model):
    """Which business sells which item, at what price.

    This is how ONE catalog serves MANY businesses with no duplication —
    and how the same item can cost 150 at the spa and 130 in the kiosk.
    """
    business = models.ForeignKey('business.Business', on_delete=models.CASCADE, related_name='catalog_entries')
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

---


### 5.3 Inventory + stock ledger *(replaces `BranchInventory`)*

```python
class InventoryLevel(models.Model):
    """Stock per BRANCH — physical stock lives at an outlet."""
    branch = models.ForeignKey('Branch', on_delete=models.CASCADE, related_name='inventory_levels')
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='inventory_levels')
    stock_qty = models.IntegerField(default=0)
    reorder_point = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('branch', 'item')
        constraints = [
            models.CheckConstraint(check=models.Q(stock_qty__gte=0), name='inventory_non_negative'),
        ]


class StockMovement(models.Model):
    """Append-only stock ledger — the history BranchInventory never had."""
    REASONS = [
        ('SALE', 'Sale'), ('VOID', 'Void/Return'), ('RECEIVE', 'Stock received'),
        ('ADJUST', 'Manual adjustment'), ('TRANSFER_OUT', 'Transfer out'),
        ('TRANSFER_IN', 'Transfer in'), ('WASTE', 'Damage/Waste'),
    ]

    branch = models.ForeignKey('Branch', on_delete=models.PROTECT, related_name='stock_movements')
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='stock_movements')
    quantity_delta = models.IntegerField()                   # +receive / -sale
    reason = models.CharField(max_length=20, choices=REASONS)
    reference = models.CharField(max_length=64, blank=True)   # transaction number / transfer id
    balance_after = models.IntegerField()
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['item', 'created_at'])]
```

### 5.4 Sales line item (simplified)

```python
class TransactionItem(models.Model):
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='items')
    branch = models.ForeignKey('Branch', on_delete=models.PROTECT, related_name='transaction_items')
    item = models.ForeignKey('catalog.Item', on_delete=models.PROTECT, null=True, blank=True)
    item_type = models.CharField(max_length=10, choices=[('PRODUCT', 'Product'), ('SERVICE', 'Service')])
    description = models.CharField(max_length=255)     # snapshot: name at time of sale
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)   # snapshot: price at sale
    quantity = models.IntegerField(default=1)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
```

**Why `description` and `unit_price` are duplicated on purpose:** a receipt must reprint exactly what was sold even if the item is renamed or repriced later. Do **not** normalise this away — it is the standard POS snapshot pattern.

### 5.5 Before / after

| Before | After |
|--------|-------|
| 7 catalog tables | **1** `Item` (+ `Category`, `BusinessType`, `BusinessItem`) |
| 7 serializers / viewsets / routes | **2** of each |
| `TransactionItem`: 2 nullable FKs + `catalog_source` enum | **1** nullable FK (`item`) + price/name snapshot |
| New business kind = new model + view + url + perms + frontend page | **1 row in `BusinessType`** |
| Same item in 2 businesses = 2 duplicated rows | 1 `Item` + 2 `BusinessItem` price rows |
| Stock changes with no history | `StockMovement` ledger (who, when, why) |
| Stock can go negative | DB `CheckConstraint` prevents it |

---


## 6. Enforcement Layer (security + robustness)

### 6.1 Automatic business filtering — `backend/api/access/managers.py` *(new)*

```python
from contextvars import ContextVar
from django.core.exceptions import ValidationError
from django.db import models

_active_business = ContextVar('active_business', default=None)
_company_wide = ContextVar('company_wide', default=False)


def set_business_context(business, company_wide=False):
    _active_business.set(business)
    _company_wide.set(company_wide)


def get_active_business():
    return _active_business.get()


class BusinessQuerySet(models.QuerySet):
    def for_business(self, business):
        return self.filter(business=business)

    def all_businesses(self):
        """Explicit cross-business access — company-wide roles / reports only."""
        return self


class BusinessScopedManager(models.Manager):
    """Default manager: scopes every query to the active business."""

    def get_queryset(self):
        qs = BusinessQuerySet(self.model, using=self._db)
        if _company_wide.get():
            return qs                                  # OWNER / COMPANY_ADMIN / ACCOUNTANT
        business = get_active_business()
        if business is None:
            return qs.none()                           # fail closed
        return qs.filter(business=business)


class BusinessScopedModel(models.Model):
    """Inherit on every business-owned model."""
    business = models.ForeignKey('business.Business', on_delete=models.CASCADE, editable=False)

    objects = BusinessScopedManager()      # default, auto-filtered
    all_objects = models.Manager()         # reports, management commands, admin

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if self.business_id is None:
            business = get_active_business()
            if business is None:
                raise ValueError('No active business: cannot save business-owned row.')
            self.business = business
        return super().save(*args, **kwargs)

    def clean(self):
        """Reject references that belong to another business."""
        super().clean()
        for field in self._meta.fields:
            value = getattr(self, field.name, None)
            other = getattr(value, 'business_id', None)
            if other is not None and other != self.business_id:
                raise ValidationError({field.name: 'Cross-business reference is not allowed.'})
```

**Note:** branch-level models (`Transaction`, `DailySales`, `Attendance`, `InventoryLevel`, `StockMovement`) carry `business` **denormalised** from their branch so this manager works uniformly and reports stay fast.

### 6.2 Active business per request — `backend/api/access/middleware.py` *(new)*

```python
class BusinessMiddleware:
    """Resolve the active business once per request, then fail closed."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.business = None
        request.access = None
        request.company_wide = False
        request.allowed_branch_ids = []

        user = getattr(request, 'user', None)
        if user is not None and user.is_authenticated:
            grants = UserAccess.objects.filter(user=user, is_active=True).select_related('business')
            header = request.headers.get('X-Business')       # business switcher in the UI
            chosen = grants.filter(business__slug=header).first() if header else None
            if chosen is None:
                chosen = grants.filter(is_primary=True).first() or grants.first()
            if chosen:
                request.access = chosen
                request.business = chosen.business
                request.company_wide = chosen.is_company_wide
                request.allowed_branch_ids = chosen.branch_ids()

        set_business_context(request.business, request.company_wide)
        try:
            return self.get_response(request)
        finally:
            set_business_context(None, False)      # never leak context between requests
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
    'api.access.middleware.BusinessMiddleware',        # <-- new, after auth
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

---


### 6.3 Permissions *(extend the existing `permissions.py`)*

```python
class BusinessAccessPermission(BasePermission):
    """User must hold an active grant for a business."""

    def has_permission(self, request, view):
        return (getattr(request, 'access', None) is not None
                or bool(getattr(request, 'company_wide', False)))


class BranchScopePermission(BasePermission):
    """Narrows a business grant to specific branches when configured."""

    def has_object_permission(self, request, view, obj):
        allowed = getattr(request, 'allowed_branch_ids', []) or []
        if getattr(request, 'access', None) is None or not allowed:
            return True                       # company-wide, or all branches of the business
        branch_id = getattr(obj, 'branch_id', None)
        return branch_id is None or branch_id in allowed
```

The existing `ROLE_ACTIONS` matrix keeps its job — *"may a CASHIER create an Expense?"* — while these classes answer *"in which business / branch?"*. Combine:

```python
class RoleBasedPermission(BasePermission):
    def has_permission(self, request, view):
        return (BusinessAccessPermission().has_permission(request, view)
                and action_allowed(get_user_role(request.user), view))
```

Rename two role codes so the matrix matches `UserAccess.ROLE_CHOICES`:
`SUPERADMIN` → `OWNER` (company-wide), `BRANCH_ADMIN` → `BUSINESS_MANAGER` (business-wide, branch-limited).
`BRANCH_ADMIN_DENIED_ACTIONS` becomes **`BUSINESS_MANAGER_DENIED_ACTIONS`** and gains the company-level actions a business manager must never do:
`Business:create/update/destroy`, `BusinessType:*`, `UserAccess:create/update/destroy`, `Company:update`, `DashboardStats:business_comparison`.

### 6.4 Deleting the manual scoping

`branch_scoped_queryset()` — 13 hand-written call sites in `views.py` — disappears:

```python
# BEFORE — easy to forget the filter in one view
class ExpenseViewSet(AuditLogMixin, viewsets.ModelViewSet):
    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)

# AFTER — filtering is automatic; narrowing by branch is the only extra step
class ExpenseViewSet(AuditLogMixin, viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        qs = Expense.objects.select_related('branch')     # already business-scoped
        branch = self.request.query_params.get('branch')
        return qs.filter(branch_id=branch) if branch else qs
```

### 6.5 Checkout — the one place that must be bullet-proof

```python
# backend/api/sales/services.py  (new) — all money logic in one testable function
@db_transaction.atomic
def checkout(*, branch, cashier, items, customer=None, amount_paid=Decimal('0'),
             discount=Decimal('0'), reward_ids=(), idempotency_key=None):
    # 1. replay protection: same key -> return the original receipt
    if idempotency_key:
        existing = Transaction.all_objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing

    prepared, subtotal = [], Decimal('0')
    for line in items:
        entry = BusinessItem.objects.select_related('item').get(
            business=branch.business, item_id=line['item'], is_available=True,
        )
        price = entry.effective_price                      # business price override wins
        qty = int(line['quantity'])
        if qty < 1:
            raise ValidationError('Quantity must be at least 1.')

        if entry.item.tracks_stock:
            # atomic, race-free decrement; the CheckConstraint is the last line of defence
            updated = InventoryLevel.objects.filter(
                branch=branch, item=entry.item, stock_qty__gte=qty,
            ).update(stock_qty=F('stock_qty') - qty)
            if not updated:
                raise ValidationError(f'Insufficient stock for {entry.item.name}.')

        subtotal += price * qty
        prepared.append((entry.item, price, qty))

    # ... tier discount, reward redemption, totals, Transaction + items + StockMovement rows
    # ... DailySales upsert for (branch, today)
    return txn
```

Why this matters: `select_for_update()` on SQLite effectively serialises the whole database but gives no real safety under load; `F()` + a `WHERE stock_qty >= qty` guard is correct **and** fast on PostgreSQL.

---


## 7. Security & Robustness Checklist

| # | Control | Change from today |
|---|---------|-------------------|
| 7.1 | **PostgreSQL instead of SQLite** (`DATABASE_URL` from env) | Real row locks, real concurrency, `CHECK` constraints, backups |
| 7.2 | **Idempotent checkout** — `Idempotency-Key` header stored on `Transaction` (unique); a retry returns the original receipt instead of selling twice | Prevents double sales on flaky networks |
| 7.3 | **Atomic stock with `F()` + guard** (§6.5) plus `CheckConstraint(stock_qty >= 0)` | Stock can never go negative, even with parallel tills |
| 7.4 | **Money is `Decimal` everywhere**; currency on `Company`/`Business`; quantise to 2 dp at the boundary | Correct totals, per-business currency |
| 7.5 | **Immutable money rows** — `Transaction`, `TransactionItem`, `StockMovement`, `AuditLog` are never hard-deleted; voids change status / add `VOID` rows | A receipt can always be reprinted |
| 7.6 | **`on_delete=PROTECT`** on `Item`/`Branch` references from sales and stock rows | Retire catalog data with `is_active=False`, never by breaking history |
| 7.7 | **Audit log gains `business`, `request_id`, `user_agent`** (branch already there) | "Who did this, in which business, on which device" |
| 7.8 | **Throttling stays** — 10/min login, global anon/user limits; add a `checkout` throttle (~60/min) | Abuse and runaway clients contained |
| 7.9 | **Token hardening** — expiring/rotating token per device, invalidated on password change | Today's single long-lived token is a weak spot |
| 7.10 | **Soft delete + `is_active`** for catalog, customers and staff instead of DELETE | Historical reports stay truthful |
| 7.11 | **Observability** — JSON logs carrying `business_id`, `branch_id`, `user_id`, `request_id`; `/healthz` + `/readyz`; error tracking | Fast incident triage |
| 7.12 | **Backups** — nightly `pg_dump` + PITR + a monthly **restore drill** | Recoverability actually proven |
| 7.13 | **Secrets from env** (already done: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, CORS); `.env` never committed | Credential hygiene |
| 7.14 | **Business context always visible** — every list response includes `business`/`branch` ids and echoes the active business | Users always know which business they are viewing |

---


## 8. File-by-File Change List

### 8.1 NEW files

| Path | Purpose |
|------|---------|
| `backend/api/company/models.py` | `Company` singleton settings |
| `backend/api/business/models.py` | `BusinessType`, `Business` |
| `backend/api/business/serializers.py`, `views.py` | CRUD for businesses + types |
| `backend/api/access/models.py` | `UserAccess` |
| `backend/api/access/managers.py` | `BusinessScopedManager`, `BusinessScopedModel`, context var |
| `backend/api/access/middleware.py` | `BusinessMiddleware` (active business, fail closed) |
| `backend/api/access/permissions.py` | `BusinessAccessPermission`, `BranchScopePermission` |
| `backend/api/catalog/models.py` | `Category`, `Item`, `BusinessItem`, `InventoryLevel`, `StockMovement` |
| `backend/api/catalog/serializers.py` | `CategorySerializer`, `ItemSerializer`, `BusinessItemSerializer`, `StockMovementSerializer` |
| `backend/api/catalog/views.py` | `ItemViewSet`, `CategoryViewSet`, `BusinessItemViewSet`, `InventoryViewSet` |
| `backend/api/sales/services.py` | `checkout()`, `void_sale()`, `receive_stock()`, `adjust_stock()`, `transfer_stock()` |
| `backend/api/management/commands/bootstrap_company.py` | Creates `Company` + default `BusinessType` rows + first `OWNER` access |
| `backend/api/migrations/0008_business_and_access.py` | Additive: `Business`, `UserAccess`, `business` FKs, `Attendance` constraint fix |
| `backend/api/migrations/0009_unified_catalog.py` | Data migration: 7 catalogs → `Item` + `BusinessItem`; `BranchInventory` → `InventoryLevel` + opening `StockMovement` |
| `backend/api/tests/test_business_isolation.py` | Business/branch isolation + concurrency tests |

### 8.2 EDITED files

| Path | What changes |
|------|--------------|
| `backend/api/models.py` | `Branch` + `business`/`code`, delete `branch_type`; `Attendance` unique → `('user','branch','date')`; + `business` on `Transaction`, `TransactionItem`, `DailySales`, `Expense`, `RoomTable`, `CustomerFeedback`, `AuditLog`; `UserProfile` reduced to personal data. |
| `backend/api/serializers.py` | Delete 5 obsolete catalog serializers; add `business`/`branch` to payloads; `ItemSerializer` exposes per-business `effective_price` |
| `backend/api/views.py` | Remove `branch_scoped_queryset` (13 sites); checkout/void delegate to `sales/services.py`; `BranchCatalogViewSet` returns one flat list from `BusinessItem`; login returns `businesses[]` + `primary_business` |
| `backend/api/permissions.py` | Roles renamed to match `UserAccess`; `BUSINESS_MANAGER_DENIED_ACTIONS`; keep `ROLE_ACTIONS` |
| `backend/api/urls.py` | Collapse 7 catalog routes → `catalog/items/`, `catalog/categories/`; add `businesses/`, `business-types/`, `user-access/`, `inventory/`; keep old paths as **read-only shims** for one release |
| `backend/api/admin.py` | Register `Company`, `Business`, `BusinessType`, `UserAccess`, `Item`; group admin by business |
| `backend/core/settings.py` | PostgreSQL from `DATABASE_URL`; `BusinessMiddleware`; media organised per business; add `checkout` throttle |
| `backend/api/management/commands/create_demo_users.py` | Create users **plus `UserAccess` grants** (owner over all businesses, cashier at one branch, …) |
| `backend/api/tests.py` | Update to the new schema; keep the 17 existing tests green |

### 8.3 DELETED (Phase 5, after the shims are unused)

`VSSService` · `VRealProduct` · `BBProduct` · `PangananMenu` · `KBItem` · `AutoSpaService` · `Product` · `BranchInventory` → replaced by `catalog.Item` / `InventoryLevel` / `StockMovement`.

---


## 9. Phased Implementation Roadmap

```
Phase 0: Safety net (tests + snapshot)
   │
   ▼
Phase 1: Company + Business + UserAccess (additive)
   │
   ▼
Phase 2: Scoping Middleware + Managers + Permission rework
   │
   ▼
Phase 3: Unified Catalog (`Item`, `Category`, `BusinessItem`) + Data Migration
   │
   ▼
Phase 4: Sales & Inventory Ledger Cutover (`services.py`, `StockMovement`)
   │
   ▼
Phase 5: Cleanup & Deprecation (drop 7 legacy catalog tables)
```

### Phase 0 — Baseline & Safety Net
- Freeze current test suite (17 tests passing).
- Export full SQLite data snapshot via `dumpdata` or file copy.
- Add regression tests covering current sales flow and attendance before touching models.

### Phase 1 — Foundations (Additive, Zero Breaking Changes)
- Create `Company`, `BusinessType`, `Business` models.
- Create `UserAccess` model.
- Add nullable `business` FK to `Branch` (data migration backfills existing branches under default business).
- Add `code` to `Branch`.
- Update `Attendance` constraint from `('user', 'date')` to `('user', 'branch', 'date')`.
- All existing API endpoints remain 100% operational.

### Phase 2 — Access Scoping & Middleware
- Implement `BusinessScopedManager` and `BusinessScopedModel`.
- Add `BusinessMiddleware` to resolve active business per request.
- Update `permissions.py` with `BusinessAccessPermission` and `BranchScopePermission`.
- Refactor views to eliminate manual `branch_scoped_queryset()` calls.
- Add `test_business_isolation.py` ensuring users cannot read or write data outside their granted business/branch.

### Phase 3 — Unified Catalog & Migration
- Create `Category`, `Item`, `BusinessItem`, `InventoryLevel`, `StockMovement`.
- Write data migration `0009_unified_catalog.py`:
  - Reads each legacy table (`VSSService`, `PangananMenu`, etc.) and inserts into `Item` with appropriate `item_type` and category.
  - Links each item to its corresponding business via `BusinessItem`.
  - Migrates `BranchInventory` rows into `InventoryLevel` + records an opening balance `StockMovement`.
- Add backward-compatibility shims on old catalog URLs (read-only viewsets delegating to `Item`).

### Phase 4 — Sales Engine Cutover
- Implement atomic checkout service in `backend/api/sales/services.py`:
  - Replay protection via idempotency key.
  - Concurrency-safe stock deduction using `F()` expressions.
  - Audit logging and `StockMovement` creation in the same transaction.
- Update `TransactionItem` to reference unified `Item`.
- Switch UI/cashier endpoints to call unified checkout.

### Phase 5 — Deprecation & Cleanup
- Drop the 7 legacy catalog models and migrations.
- Remove legacy backward-compatibility URL shims.
- Run `makemigrations` and verify clean schema.
- Update documentation and OpenAPI schema (`schema.yml`).

---

## 10. Summary & Next Steps

This migration transforms the system from a rigid, duplicated catalog structure into an extensible multi-business engine tailored to a single company's real-world operations:

1. **One Catalog**: 7 duplicate tables collapsed into 1 unified `Item` table with per-business pricing overrides.
2. **Flexible Access**: `UserAccess` enables cross-branch staff, dedicated business managers, and company-wide owners.
3. **Data Safety**: Append-only stock ledger, idempotency keys, and DB constraints eliminate negative stock and race conditions.
4. **Clean Code**: Automatic query scoping replaces 13 redundant manual filters.

Ready to begin Phase 1? Run the migrations or create the new modules in `backend/api/business/` and `backend/api/company/`.

---
