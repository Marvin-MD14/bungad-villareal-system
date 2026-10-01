# Entity–Relationship Design — every connection, editable and self-checking

**What this file is:** the schema's *connection map* — which table points at which,
whether that pointer may be empty, and what happens to the pointing row when the
pointed-at row is deleted. This is the file to read **before** you change a
relation, and the file to change **when** you change one.

**Why it is not just a picture:** the fenced ```` ``erd ```` block near the bottom is a
registry of all 55 relationships generated from the live models, and it is verified:

```bash
python manage.py erd                 # what the models actually say
python manage.py erd --check         # CI gate: ERD.md vs the models, non-zero on drift
python manage.py erd --write         # regenerate the registry after an intended change
python manage.py erd --model Branch  # impact analysis before you touch a relation
python manage.py erd --summary       # delete-policy census + which models are tenants
python manage.py erd --mermaid       # a generated erDiagram that cannot lie
```

`--check` runs in GitHub Actions and in `api/tests/test_erd.py`. Add a foreign key
and forget to draw it, or flip `PROTECT` to `CASCADE` without a second thought, and
the build fails with the exact line that moved. That is the mechanism behind "if
something is wrong I can change it": **wrong is visible**, and §8 lists the things
that already look wrong.

**Reading the registry lines**

```
TransactionItem.branch -> Branch [fk PROTECT null=yes rn=transaction_items]
└─ child .field         └─ parent  └─ kind  └─ delete rule  └─ optional?  └─ reverse accessor
```

`kind` is `fk` (many→one), `o2o` (one→one) or `m2m` (many↔many, `through=` names the
join table). `self` marks a self-referential pointer. `unique` on an `fk` means the
column is effectively one-to-one.

---

## 1. The map at a glance

Five clusters, joined by exactly two kinds of edge: **tenancy** (everything points,
directly or through a parent, at `Business`) and **people** (everything that happened
points at a `User`).

```
        ┌─────────── TENANCY (the isolation boundary) ───────────┐
        │  BusinessType ──< Business                              │
        └──────────────────────────────┬─────────────────────────┘
                        tenant edges  │        │ derived tenant
        ┌─────────────────────────────▼────────┴─────────────────┐
        │  Branch  (the outlet — exactly one Business, never two) │
        └──┬──────┬───────┬────────┬─────────┬─────────┬─────────┘
           │      │       │        │         │         │
      Inventory Room Daily  Expense Attend  Feedback  Transaction ──< TransactionItem
      Level     Table Sales                                │
           │      │                                       │ customer
        Item <────┘                          ClientProfile (tenant FK, 0017)
           │                                       │
     Category (company-wide)                  CustomerReward ──< RewardClaim

        ┌──────────── PEOPLE (who did it) ───────────────────────┐
        │ User ──< UserAccess >── Business(nullable) + Branch ticks│
        │     ───|| UserProfile    ──< DeviceToken (self-rotating)│
        │     ──< AuditLog · StockMovement.created_by · RoomTable │
        └─────────────────────────────────────────────────────────┘
```

`Company` hangs over all of it as a singleton (`pk=1`, `delete()` raises) and has no
foreign keys of its own — see §7.

---

## 2. Cluster A — tenancy and access

The part of the schema that decides *whose data a row is*. Change anything here and
you are changing isolation, so `api.E001` and the isolation tests are watching.

```mermaid
erDiagram
    BusinessType {
        slug code UK "e.g. spa, restaurant"
        string name
        string default_unit
        bool tracks_stock
        bool is_active
    }
    Business {
        string name UK "the tenant"
        slug slug UK "the X-Business header"
        fk business_type_id "PROTECT to BusinessType"
        string currency "blank = Company default"
        decimal tax_rate "null = Company default"
        bool loyalty_enabled
        bool is_active "retire here, never delete"
    }
    Branch {
        fk business_id "CASCADE - but sales PROTECT it"
        string code
        string name "unique with business"
        bool is_active
    }
    User {
        string username "django.contrib.auth"
        bool is_superuser
    }
    UserAccess {
        string role "8 values, keys of ROLE_ACTIONS"
        fk business_id "NULL = company-wide grant"
        bool is_primary "landing business after login"
        bool is_active
    }
    DeviceToken {
        string key UK "64 hex, 12h lifetime"
        string password_fingerprint "pins token to the password hash"
        datetime expires_at
        datetime revoked_at
    }
    UserProfile {
        string phone_number
        string avatar
    }

    BusinessType ||--o{ Business : "business_type PROTECT"
    Business ||--o{ Branch : "business CASCADE"
    User ||--o{ UserAccess : "user CASCADE"
    Business |o--o{ UserAccess : "business CASCADE nullable = company-wide"
    UserAccess }o--o{ Branch : "branches M2M empty = whole business"
    User ||--o{ DeviceToken : "user CASCADE"
    DeviceToken |o--o{ DeviceToken : "rotated_from SET_NULL self"
    User ||--|| UserProfile : "user CASCADE one-to-one"
    UserProfile }o--o{ Item : "skills M2M services this person can perform"
```

**What each edge is buying**

| Edge | Why it exists | What the policy means in practice |
|---|---|---|
| `Business.business_type → PROTECT` | A type is a template; deleting it must not erase businesses | Retire a type with `is_active=False`; the DB refuses the delete |
| `Branch.business → CASCADE` | An outlet is nothing without its business | Deleting a Business removes its outlets — and every sale behind them. Retire with `is_active` instead |
| `UserAccess.business → CASCADE, nullable` | **NULL *is* the design**: a company-wide grant carries no tenant | Deleting a business silently revokes staff access to it — usually right, but silent |
| `UserAccess.branches → M2M` | Ticks narrow a grant to specific outlets; empty = whole business | Read via the unscoped through rows (`branch_ids()`), or the scoped manager reports zero ticks |
| `DeviceToken.rotated_from → SET_NULL self` | Rotation must be attributable but must never chain-delete | A rotated-away key stays as a dead end; a password change kills every outstanding key through `password_fingerprint` |
| `UserProfile.user → O2O CASCADE` | Personal data only, deliberately tenant-less | Role and outlets come from grants, so one account can be a cashier in one business and a manager in another |

`User.groups` and `User.user_permissions` (Django's own M2Ms) appear in the registry
but not in the drawing: authorization here reads `UserAccess`, never Django groups.

---

## 3. Cluster B — catalog and stock

One catalog serves every business. The join table `BusinessItem` is what makes "many
businesses, one item, different prices" possible without duplicating the item, and
`StockMovement` is the ledger `InventoryLevel`'s number can always be rebuilt from.

```mermaid
erDiagram
    Category {
        string name "unique with kind"
        string kind "PRODUCT or SERVICE"
        fk parent_id "self, CASCADE"
        int sort_order
    }
    Item {
        string name "unique with item_type - COMPANY-WIDE"
        string item_type "PRODUCT or SERVICE"
        string sku
        string barcode UK
        decimal cost_price
        decimal selling_price "overridable per business"
        bool tracks_stock
        bool requires_room
        json attributes
    }
    BusinessItem {
        fk business_id "CASCADE"
        fk item_id "CASCADE"
        decimal price_override "null = use Item.selling_price"
        bool is_available
    }
    InventoryLevel {
        fk branch_id "PROTECT"
        fk item_id "PROTECT"
        int stock_qty "CHECK >= 0"
        int reorder_point
    }
    StockMovement {
        fk branch_id "PROTECT"
        fk item_id "PROTECT"
        int quantity_delta "plus receive, minus sale"
        string reason "SALE VOID RECEIVE ADJUST TRANSFER_IN TRANSFER_OUT WASTE"
        int balance_after
        fk created_by_id "PROTECT, nullable"
    }

    Category ||--o{ Item : "category PROTECT"
    Category |o--o{ Category : "parent CASCADE self"
    Item ||--o{ BusinessItem : "item CASCADE"
    Business ||--o{ BusinessItem : "business CASCADE"
    Item ||--o| InventoryLevel : "item PROTECT"
    Branch ||--o| InventoryLevel : "branch PROTECT"
    Item ||--o{ StockMovement : "item PROTECT"
    Branch ||--o{ StockMovement : "branch PROTECT"
    User ||--o{ StockMovement : "created_by PROTECT nullable"
```

Two edges carry all the weight here:

- **`BusinessItem` is the only tenant-bearing edge in the catalog.** `Category` and
  `Item` are company-wide on purpose, so they carry no `business` FK and are *not*
  auto-scoped — a leak there is a pricing mistake, not a tenant breach. The moment
  you add a `business` FK to `Item`, `ScopedQuerysetMixin` and `api.E001` start
  applying to it (see §9).
- **`InventoryLevel` is a cache; `StockMovement` is the truth.** `(branch, item)` is
  unique with a `CHECK (stock_qty >= 0)` constraint, and every writer appends a
  movement with `balance_after`. If those two ever disagree, the ledger wins — and
  `manage.py erd --model StockMovement` shows you the four `PROTECT`s that make it
  permanent.

---

## 4. Cluster C — the sale

The write path every other cluster exists to feed. Note the two deliberate
*duplications*: `TransactionItem.branch` and `TransactionItem.unit_price`.

```mermaid
erDiagram
    Transaction {
        fk branch_id "PROTECT"
        fk business_id "CASCADE, nullable - stamped from the branch"
        string transaction_number "unique with business"
        string idempotency_key UK "replay guard, nullable"
        string transaction_type "SALE VOID RETURN HOLD"
        string status "PENDING PAID VOIDED HELD"
        decimal subtotal
        decimal discount
        decimal total
        decimal amount_paid
        string customer_tier_at_purchase "snapshot"
    }
    TransactionItem {
        fk transaction_id "CASCADE"
        fk branch_id "PROTECT, nullable - added in phase 5.4"
        fk item_id "PROTECT, nullable - price snapshot below"
        decimal unit_price "snapshot, never re-read"
        int quantity
        decimal total
    }
    ClientProfile {
        fk business_id "CASCADE, nullable - the tenant FK (0017)"
        string first_name
        string phone_number "indexed"
        decimal loyalty_points
        decimal total_spent
        string loyalty_tier "BRONZE SILVER GOLD PLATINUM"
    }
    DailySales {
        fk branch_id "CASCADE"
        fk business_id "CASCADE, nullable"
        date date "unique with branch"
        decimal total_sales
        decimal total_expenses
        decimal total_void
        int transaction_count
    }

    Branch ||--o{ Transaction : "branch PROTECT"
    Business |o--o{ Transaction : "business CASCADE nullable"
    ClientProfile |o--o{ Transaction : "customer SET_NULL nullable"
    User |o--o{ Transaction : "staff SET_NULL nullable"
    Transaction ||--o{ TransactionItem : "transaction CASCADE"
    Branch |o--o{ TransactionItem : "branch PROTECT nullable"
    Item |o--o{ TransactionItem : "item PROTECT nullable"
    Transaction }o--o{ CustomerReward : "rewards_applied M2M"
    Branch ||--o{ DailySales : "branch CASCADE"
    Business |o--o{ DailySales : "business CASCADE nullable"
```

**The snapshot rule.** `unit_price` and `description` are copied onto the line at
checkout instead of read through `item`. That is intentional duplication: a receipt
reprinted next year must show what was *charged*, not today's price. The same idea
explains `Transaction.customer_tier_at_purchase`. If you ever "clean up" these
columns, you are choosing to make historical receipts wrong — flag it before doing it.

**Nullable `business` on tenant tables** (`Transaction`, `DailySales`, `Expense`,
`Attendance`, `RoomTable`, `CustomerFeedback`, `AuditLog`) is a migration artifact:
the column had to be nullable before the backfill could fill it. New writes are
stamped by `BusinessStampMixin` / `_resolve_business`, so a NULL means either an old
row or a write that bypassed the serializer. `manage.py erd` lists them; a
`SELECT count(*) WHERE business_id IS NULL` per table is the audit.

---

## 5. Cluster D — loyalty

The one cluster whose tenant is **derived, never stored**: `CustomerReward` has no
`business` FK. Isolation is reached through `customer__business`, which is why its
viewset declares `business_lookup = 'customer__business'` — change the chain and that
string must change with it.

```mermaid
erDiagram
    ClientProfile ||--o{ CustomerReward : "customer CASCADE"
    Transaction |o--o{ CustomerReward : "transaction SET_NULL where it was earned"
    Transaction |o--o{ CustomerReward : "claimed_in_transaction SET_NULL"
    CustomerReward ||--o{ RewardClaim : "reward CASCADE"
    Transaction |o--o{ RewardClaim : "transaction SET_NULL"
    User |o--o{ RewardClaim : "claimed_by SET_NULL"
    Transaction }o--o{ CustomerReward : "rewards_applied M2M"

    CustomerReward {
        fk customer_id "CASCADE - the tenant chain starts here"
        string reward_type "DISCOUNT FREE_ITEM POINTS TIER_UPGRADE"
        string status "AVAILABLE CLAIMED EXPIRED"
        decimal value
        decimal discount_percent
        datetime expires_at
    }
    RewardClaim {
        fk reward_id "CASCADE"
        fk transaction_id "SET_NULL"
        fk claimed_by_id "SET_NULL who pressed the button"
        decimal amount_applied
    }
```

**Three ways to reach the same fact, on purpose.** "Which transaction redeemed this
reward?" is answered by `CustomerReward.claimed_in_transaction` (the current claim),
`RewardClaim.transaction` (the audit trail), and `Transaction.rewards_applied` (the
M2M the receipt prints). They are redundant by design: the M2M is a convenience for
the receipt, `RewardClaim` is the record that must survive an edit to the other two.
If only one survives, it should be `RewardClaim`.

**Deleting a customer deletes their rewards** (`customer CASCADE`), which also keeps
`RewardClaim` from orphaning. But a *sale* that redeemed them only drops its
`rewards_applied` rows — the receipt survives. That asymmetry (bookkeeping outlives
the person) is worth knowing before you write a cleanup job.

---

## 6. Cluster E — people, operations, audit

Everything that records *a human doing a thing*. `User` is Django's, and the edges
into it are the ones most likely to surprise you during a staff offboarding.

```mermaid
erDiagram
    User ||--o{ Attendance : "user CASCADE"
    Branch ||--o{ Attendance : "branch CASCADE"
    Business |o--o{ Attendance : "business CASCADE nullable"
    Branch ||--o{ RoomTable : "branch CASCADE"
    User |o--o{ RoomTable : "assigned_staff SET_NULL"
    Item |o--o{ RoomTable : "item PROTECT the service in progress"
    Branch ||--o{ Expense : "branch CASCADE"
    User |o--o{ Expense : "recorded_by SET_NULL"
    Branch ||--o{ CustomerFeedback : "branch CASCADE"
    ClientProfile |o--o{ CustomerFeedback : "customer SET_NULL"
    Transaction |o--o{ CustomerFeedback : "transaction SET_NULL"
    User |o--o{ CustomerFeedback : "staff SET_NULL who received it"
    User |o--o{ AuditLog : "user SET_NULL"
    Branch |o--o{ AuditLog : "branch SET_NULL"
    Business |o--o{ AuditLog : "business SET_NULL"

    Attendance {
        date date "unique with user and branch"
        datetime time_in
        datetime time_out
        string status "PRESENT LATE ABSENT HALF_DAY"
    }
    RoomTable {
        string name
        string room_type "PEDICURE FOOT_SPA MASSAGE VIP"
        bool is_occupied
        int duration_minutes
    }
    Expense {
        string category "SUPPLIES UTILITIES RENT SALARY MAINTENANCE OTHERS"
        decimal amount
        date expense_date
        file receipt
    }
    CustomerFeedback {
        int rating "1 to 5"
        text comment
    }
    AuditLog {
        fk user_id "SET_NULL - survives the user"
        string action "CREATE UPDATE DELETE LOGIN LOGOUT VOID RESTOCK"
        string model_name
        string object_id "not a FK - deliberately untyped"
        string ip_address
        string request_id "ties to the structured log line"
    }
```

`AuditLog` is the only model where **every** pointer is `SET_NULL`. That is the whole
point: an audit trail that disappears when a user, branch, or business is removed is
not evidence. It is also why retiring rows with `is_active=False` is the right tool
and deleting them is not.

---

## 7. The connections that are not foreign keys

Three kinds of link the diagrams above cannot draw, all of which behave like
relations and can break like them:

| Connection | Where | Why it matters |
|---|---|---|
| `Company` singleton (`pk=1`, `delete()` raises) | `api/company/models.py` | No FK points at it, so the map looks empty — yet `default_currency`, `default_tax_rate` and `loyalty_enabled` are read at *display* time by `BusinessSerializer`, so editing them silently re-labels every receipt in every business |
| `unique_together` pairs | `Branch(business,name)` · `BusinessItem(business,item)` · `InventoryLevel(branch,item)` · `DailySales(branch,date)` · `Attendance(user,branch,date)` · `Transaction(business,transaction_number)` · `UserAccess(user,role,business)` · `Category(name,kind)` · `Item(name,item_type)` | Real constraints the boxes hide. Several are **tenant-scoped uniqueness** — that is what lets the same product name exist in two businesses while `Item(name,item_type)` still forbids it inside the single catalog |
| The derived-tenant chain | `StockMovement`, `CustomerReward`, `RewardClaim`, `TransactionItem`, `UserProfile`, `DeviceToken` carry no `business` FK | Their isolation comes from a parent, and `ScopedQuerysetMixin.business_lookup` is the one line that states each chain (`customer__business`, `reward__customer__business`, `branch__business`). Add a `business` FK to any of them and you have chosen denormalisation: it must then be stamped, backfilled, and guarded by `api.E001` |

`StockMovement.reference` (a `transaction_number` or transfer id as free text) is a
deliberate **non**-FK: the ledger must keep its record even if the row it mentions is
gone. Nothing enforces it — and converting it into a real FK would turn an
append-only ledger into a child table that can be cascade-deleted.

---

## 8. Things that look wrong — the review list

Every finding below is **read off the live registry**, not from memory, and each one
names the smallest change that resolves it. They are ordered by consequence, not by
effort. None of them are bugs today; they are places where two neighbouring edges
disagree about what deletion means, which is exactly the kind of thing to decide
deliberately while the table is small.

### 8.1 High consequence

| # | Finding | The two edges that disagree | Smallest fix |
|---|---|---|---|
| 1 | **Deleting a `Branch` destroys some history and is blocked by the rest.** `manage.py erd --model Branch` lists **11 inbound edges**: 4 `PROTECT` (`Transaction`, `TransactionItem`, `InventoryLevel`, `StockMovement`), 5 `CASCADE` (`Attendance`, `CustomerFeedback`, `DailySales`, `Expense`, `RoomTable`), 1 `SET_NULL` (`AuditLog`) and 1 M2M (`UserAccess.branches`). So a branch with sales refuses the delete — and once those sales are gone, the attendance and expense records vanish with it | `Branch` is retired with `is_active=False`, never deleted; five edges say otherwise | Make the five `CASCADE`s `PROTECT`. An `on_delete` change is metadata-only in PostgreSQL (SQLite rebuilds the table) and touches no data |
| 2 | **Deleting a `Business` erases money.** `Transaction.business`, `DailySales.business`, `Expense.business` … are all `CASCADE`, and `Business` has 11 inbound edges | The tenant boundary is the one row you should never be able to delete, yet nothing stops it | `on_delete=PROTECT` on `Transaction`/`DailySales`/`Expense`/`ClientProfile` at minimum, so "close a business" becomes `is_active=False` + a considered archive job |
| 3 | **`Attendance.user` is `CASCADE`** — firing someone deletes their time records, while `Expense.recorded_by`, `AuditLog.user` and `RoomTable.assigned_staff` all survive the same deletion | Payroll evidence is treated as disposable; the receipt for a ₱200 expense is not | `SET_NULL` plus a `staff_name` snapshot at write time (the same pattern `TransactionItem.unit_price` already uses), or `PROTECT` if staff rows are retired instead |

### 8.2 Silent-failure edges

| # | Finding | Symptom you would actually see | Smallest fix |
|---|---|---|---|
| 4 | **`AuditLog.business` is nullable and the viewset filters `business=<active>`.** Login/logout rows written before the business context resolves carry `NULL` and therefore match *no* scoped queryset | Staff logins never appear in the audit tab, and nobody can explain why | Stamp the business at log time when the request has one, or add an explicit company-wide audit action for `OWNER`/`COMPANY_ADMIN` that reads `all_objects` |
| 5 | **`ClientProfile.business` is nullable** (left nullable by migration `0017` after the backfill). A row with `business=NULL` matches neither business's scoped read (`customer__business` is NULL) but exists in `all_objects` | A customer that exists in the database and in the admin, invisible to both tenants | Audit for `business_id IS NULL`, backfill, then make the column non-null — the API already refuses ambiguous creates with 400 |
| 6 | **`TransactionItem.item` and `.branch` are nullable** although every checkout path fills them | A line with no `item` cannot be reversed on void: stock is not restored and nobody is told | `SELECT count(*) FROM … WHERE item_id IS NULL` first; if zero, make both non-null |

### 8.3 Design decisions worth re-confirming

| # | Decision as built | Question it raises | If the answer is "no" |
|---|---|---|---|
| 7 | `Item` is **company-wide**: `unique_together('name','item_type')`, `barcode` globally unique, no `business` FK | Should two businesses ever own *separate* items with the same name, or always share one item and price it apart through `BusinessItem`? | That is "add a tenant FK" — §9.3, the largest change on this page |
| 8 | `StockMovement.created_by` is `PROTECT` | Should any human ever block deleting an account? Today a demo user who ran one restock makes that user undeletable forever | `SET_NULL` + name snapshot, or accept it and state it: *users are retired, never deleted* |
| 9 | `BusinessItem.item` is `CASCADE` while `InventoryLevel.item` is `PROTECT` | Is removing an item from a catalog a normal act, or should items only ever be retired? | Document `is_active=False` as the only retire path and make the pricing link `PROTECT` too |
| 10 | **Five edges have no explicit `related_name`**, so Django generated the defaults: `Transaction.branch`, `Transaction.customer`, `Transaction.staff` (all three reverse to `transaction_set`), `DailySales.branch` (`dailysales_set`) and `StockMovement.created_by` (`stockmovement_set`) — visible in the registry as the lines ending `_set]` | Harmless at runtime, but those edges are invisible to a `related_name` grep, which is exactly how you find the call sites before a change — and three different parents answering to `transaction_set` reads like a bug when it is not | Add explicit names (`hosted_transactions`, `transactions`, `staff_transactions`, `branch_daily_sales`, `audited_movements`). A rename moves no data; it does change every reverse accessor and `__` filter, so grep the old name first |
| 11 | Loyalty's tenant is derived over **three hops** (`RewardClaim → reward → customer → business`) with no index on that chain | Is per-request loyalty filtering fast enough at 100k rewards? | Add an index on `CustomerReward(customer)`, or stamp a `business` FK and keep the chain as a check |

**How to work this list:** pick a row, run `manage.py erd --model <Model>` to see the
blast radius, make the model change, then follow §9. Rows 1–3 are one commit each;
row 7 is a plan.

---

## 9. How to change a connection

Six steps, whatever the change. The order is not ceremonial: step 5 is what tells you
whether you changed a *deletion rule* (invisible until it fires) or a *tenant edge*
(visible to every request immediately).

### 9.1 The runbook

| Step | Command / action | What it protects you from |
|---|---|---|
| 1. Ask the blast radius | `python manage.py erd --model <Model>` | Changing an edge you did not know existed. Inbound lines are the ones that decide whether this is a migration or an outage |
| 2. Change the model | `api/models.py` (or `catalog/`, `access/`, `business/`), with a comment saying **why** this policy and not the other one | A future reader flipping it back. Every `on_delete` here is a decision someone should be able to argue with |
| 3. Move the data | `python manage.py makemigrations` then `migrate`. For a **new** non-null FK add a `RunPython` backfill in the same migration; for an `on_delete` change Django rewrites the constraint | SQLite rebuilds tables on constraint changes — back up (`python manage.py dumpdata api -o backup.json`) first |
| 4. Check the scoping consequences | `python manage.py check` | `api.E001`: a model that grows a `business` FK is auto-enrolled in tenant scoping, so every viewset over it now needs `ScopedQuerysetMixin` (or an `ALLOWED_UNSCOPED` entry with a reason) |
| 5. Prove isolation still holds | `python manage.py test api` — specifically `test_business_isolation.py` and `test_write_scoping.py` | A tenant edge that reads scoped but writes unscoped. Add a test that asserts a *second* business's rows are invisible or unwritable |
| 6. Redraw the map | `python manage.py erd --write`, then `--check`, then update the diagrams and §8 by hand | The diagram drifting from the schema. The registry regenerates itself; **the rationale in the tables above is yours to keep honest** |

### 9.2 What each kind of change costs

| Change | Data moved? | Also touch |
|---|---|---|
| `on_delete` only (`CASCADE` ⇄ `PROTECT` ⇄ `SET_NULL`) | No (`SET_NULL` requires the column be `null=True`) | §8 rationale, the diagram label, and any delete you currently rely on |
| `null=True` → `null=False` | Only if NULLs exist — count them first | Backfill in the same migration; `BusinessStampMixin` must be able to resolve a business for every writer |
| New FK to an existing table | Yes, backfill | Serializers (writable by default — see the `read_only_fields` pattern that stopped the 500s), `related_name`, admin `list_filter` |
| Remove a column / relation | Drops data — dump it first | `erd --write` will *remove* its line, which is the change review needs to see |
| Rename `related_name` | No | Every reverse accessor and `*_id` filter in views/serializers/tests — grep the old name |

### 9.3 Adding a tenant FK to a company-wide table (`Item`, `Category`)

The biggest change on the board, so it gets its own steps:

1. Add the FK **nullable**, no unique changes yet, and migrate.
2. Backfill from an existing chain (for `Item`, through `BusinessItem.business`; items
   used by nobody need a decision — a default business or `is_active=False`).
3. Re-point uniqueness: `unique_together('name','item_type')` becomes
   `UniqueConstraint(fields=('business','name','item_type'), name=…)`, and
   `barcode` becomes unique **per business** (or stays global on purpose).
4. Stamp it on write: the viewset's `perform_create` (the pattern that fixed
   `InventoryLevelSerializer` and `BusinessItemSerializer`), never a serializer default.
5. Make it non-null only after step 2's count of NULLs is zero, in a separate migration.
6. `manage.py check` for `api.E001`, add an isolation test, `erd --write`, update
   §3's diagram, and delete the sentence in this file that says the catalog is
   company-wide — that sentence is a claim about the schema, and it is now false.

---

## 10. Machine-readable relationship registry

Generated from the models by `python manage.py erd --write` and verified by
`--check` in CI and in `api/tests/test_erd.py`. Do not hand-edit this block: edit the
diagrams and rationale above, and let this stay true.

## Machine-readable relationship registry

```erd
# generated by `manage.py erd --write` — do not hand-edit this block;
# edit the diagrams above and verify with `manage.py erd --check`.
Attendance.branch -> Branch [fk CASCADE null=no rn=attendance_records]
Attendance.business -> Business [fk CASCADE null=yes rn=attendance_records]
Attendance.user -> User [fk CASCADE null=no rn=attendance_records]
AuditLog.branch -> Branch [fk SET_NULL null=yes rn=audit_logs]
AuditLog.business -> Business [fk SET_NULL null=yes rn=audit_logs]
AuditLog.user -> User [fk SET_NULL null=yes rn=audit_logs]
Branch.business -> Business [fk CASCADE null=no rn=branches]
Business.business_type -> BusinessType [fk PROTECT null=no rn=businesses]
Business.owner -> User [fk SET_NULL null=yes rn=owned_businesses]
BusinessItem.business -> Business [fk CASCADE null=no rn=catalog_entries]
BusinessItem.item -> Item [fk CASCADE null=no rn=business_entries]
CashierShift.branch -> Branch [fk PROTECT null=no rn=cashier_shifts]
CashierShift.business -> Business [fk CASCADE null=no rn=cashiershift_set]
CashierShift.staff -> User [fk PROTECT null=no rn=cashier_shifts]
Category.parent -> Category [fk CASCADE null=yes rn=children self]
ClientProfile.business -> Business [fk CASCADE null=yes rn=clients]
CustomerFeedback.branch -> Branch [fk CASCADE null=no rn=feedbacks]
CustomerFeedback.business -> Business [fk CASCADE null=yes rn=feedbacks]
CustomerFeedback.customer -> ClientProfile [fk SET_NULL null=yes rn=feedbacks]
CustomerFeedback.staff -> User [fk SET_NULL null=yes rn=feedbacks_received]
CustomerFeedback.transaction -> Transaction [fk SET_NULL null=yes rn=feedbacks]
CustomerReward.claimed_in_transaction -> Transaction [fk SET_NULL null=yes rn=rewards_claimed]
CustomerReward.customer -> ClientProfile [fk CASCADE null=no rn=rewards]
CustomerReward.transaction -> Transaction [fk SET_NULL null=yes rn=rewards_generated]
DailySales.branch -> Branch [fk CASCADE null=no rn=dailysales_set]
DailySales.business -> Business [fk CASCADE null=yes rn=daily_sales]
DeviceToken.rotated_from -> DeviceToken [fk SET_NULL null=yes rn=successors self]
DeviceToken.user -> User [fk CASCADE null=no rn=device_tokens]
DocumentSequence.business -> Business [fk CASCADE null=no rn=document_sequences]
Expense.branch -> Branch [fk CASCADE null=no rn=expenses]
Expense.business -> Business [fk CASCADE null=yes rn=expenses]
Expense.recorded_by -> User [fk SET_NULL null=yes rn=expenses_recorded]
InventoryLevel.branch -> Branch [fk PROTECT null=no rn=inventory_levels]
InventoryLevel.item -> Item [fk PROTECT null=no rn=inventory_levels]
Item.category -> Category [fk PROTECT null=no rn=items]
LoyaltyProgram.business -> Business [fk CASCADE null=no rn=loyaltyprogram_set]
LoyaltyTransaction.branch -> Branch [fk PROTECT null=yes rn=loyalty_entries]
LoyaltyTransaction.business -> Business [fk CASCADE null=no rn=loyalty_transactions]
LoyaltyTransaction.created_by -> User [fk SET_NULL null=yes rn=loyalty_entries]
LoyaltyTransaction.customer -> ClientProfile [fk CASCADE null=no rn=loyalty_entries]
LoyaltyTransaction.transaction -> Transaction [fk SET_NULL null=yes rn=loyalty_entries]
Payment.business -> Business [fk CASCADE null=no rn=payment_set]
Payment.method -> PaymentMethod [fk PROTECT null=no rn=payments]
Payment.shift -> CashierShift [fk SET_NULL null=yes rn=payments]
Payment.transaction -> Transaction [fk CASCADE null=no rn=payments]
PaymentMethod.business -> Business [fk CASCADE null=no rn=paymentmethod_set]
RewardClaim.claimed_by -> User [fk SET_NULL null=yes rn=reward_claims_made]
RewardClaim.reward -> CustomerReward [fk CASCADE null=no rn=claims]
RewardClaim.transaction -> Transaction [fk SET_NULL null=yes rn=reward_claims]
RoomTable.assigned_staff -> User [fk SET_NULL null=yes rn=assigned_rooms]
RoomTable.branch -> Branch [fk CASCADE null=no rn=rooms]
RoomTable.business -> Business [fk CASCADE null=yes rn=rooms]
RoomTable.item -> Item [fk PROTECT null=yes rn=room_bookings]
StockMovement.branch -> Branch [fk PROTECT null=no rn=stock_movements]
StockMovement.created_by -> User [fk PROTECT null=yes rn=stockmovement_set]
StockMovement.item -> Item [fk PROTECT null=no rn=stock_movements]
Transaction.branch -> Branch [fk PROTECT null=no rn=transaction_set]
Transaction.business -> Business [fk CASCADE null=yes rn=transactions]
Transaction.customer -> ClientProfile [fk SET_NULL null=yes rn=transaction_set]
Transaction.rewards_applied -> CustomerReward [m2m rn=applied_in_transactions through=Transaction_rewards_applied]
Transaction.shift -> CashierShift [fk SET_NULL null=yes rn=transactions]
Transaction.staff -> User [fk SET_NULL null=yes rn=transaction_set]
TransactionItem.branch -> Branch [fk PROTECT null=yes rn=transaction_items]
TransactionItem.item -> Item [fk PROTECT null=yes rn=transaction_items]
TransactionItem.transaction -> Transaction [fk CASCADE null=no rn=items]
User.groups -> Group [m2m rn=user_set through=User_groups]
User.user_permissions -> Permission [m2m rn=user_set through=User_user_permissions]
UserAccess.branches -> Branch [m2m rn=access_grants through=UserAccess_branches]
UserAccess.business -> Business [fk CASCADE null=yes rn=access_grants]
UserAccess.user -> User [fk CASCADE null=no rn=access_grants]
UserProfile.skills -> Item [m2m rn=skilled_staff through=UserProfile_skills]
UserProfile.user -> User [o2o CASCADE null=no rn=profile]
```

