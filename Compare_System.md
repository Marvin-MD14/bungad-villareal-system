# MASTER PROMPT — PRODUCTION-READY MULTI-BUSINESS POS SYSTEM

You are a senior software architect specializing in Django, Django REST Framework, React, PostgreSQL/MySQL, POS systems, inventory systems, accounting workflows, multi-tenant SaaS architecture, RBAC, and transaction-safe business systems.

I am building a production-ready **multi-business Point of Sale (POS) platform** using:

* Frontend: React
* Backend: Python
* Framework: Django
* API: Django REST Framework (DRF)
* Database: PostgreSQL preferred, MySQL acceptable
* Authentication: Django authentication system + secure API authentication
* Architecture: REST API + modular Django applications
* Deployment target: production server
* Current development environment: localhost

Do NOT simplify the architecture unnecessarily.

I want you to treat the requirements below as the **authoritative system specification**.

Your task is to validate the architecture and then help implement it correctly.

---

# 1. SYSTEM OVERVIEW

The system is a multi-business POS platform.

There is:

* exactly ONE platform Owner
* ONE or more Superadmins
* MANY Businesses owned by the Owner
* MANY Branches per Business
* MANY employees/staff per Business and Branch

Supported business types:

1. SPA
2. RETAIL
3. SERVICE
4. RESTAURANT

The system must use a shared POS core while allowing business-type-specific modules.

Architecture:

```text
ONE POS PLATFORM
        |
        +----------------+
        |                |
    SUPERADMIN         OWNER
                         |
                MANY BUSINESSES
                         |
                   MANY BRANCHES
                         |
                    MANY STAFF
                         |
                 ROLE + PERMISSIONS
                         |
                  BUSINESS/BRANCH SCOPE
```

---

# 2. MOST IMPORTANT MULTI-TENANCY RULE

Business is the primary tenant boundary.

Branch is the operational boundary.

Example:

```text
OWNER
 |
 +-- Business A
 |      |
 |      +-- Branch 1
 |      +-- Branch 2
 |
 +-- Business B
        |
        +-- Branch 1
        +-- Branch 2
```

Data belonging to Business A must never be accessible to Business B.

Branch-level operational data must be restricted to authorized branches.

Do NOT rely only on frontend filtering.

All tenant and branch access rules must be enforced in Django/backend permissions and queryset filtering.

---

# 3. OWNER

There is exactly ONE Owner for the entire platform.

Owner can:

* create businesses
* manage businesses
* manage business settings
* view all businesses
* create/manage branches
* manage staff
* view reports
* manage platform-wide business configuration where authorized

Owner is different from a Business Admin.

Owner is the platform/business ownership level.

Use:

```text
OwnerProfile
    |
    +-- User
```

OwnerProfile should have a OneToOne relationship with Django User.

Do not allow multiple active platform owners.

---

# 4. SUPERADMIN

Superadmin is a platform-level administrative role.

Superadmin may:

* manage platform users
* manage system configuration
* manage business types
* manage available modules
* inspect businesses
* assist with administration
* manage permissions/roles where authorized
* view audit logs

Superadmin must not automatically become the business owner.

---

# 5. BUSINESS

Each Business belongs to the single Owner.

Business fields should include:

```text
id
owner_id
business_type_id
business_code
name
legal_name
description
tax_number
phone
email
address
city
province
postal_code
logo
currency
timezone
status
created_at
updated_at
```

Relationship:

```text
Owner 1 -> MANY Businesses
```

---

# 6. BUSINESS TYPES

Supported:

```text
SPA
RETAIL
SERVICE
RESTAURANT
```

Create a BusinessType model rather than hardcoding business types throughout the application.

Future business types should be possible.

---

# 7. BUSINESS MODULES

Use a module system.

Examples:

```text
POS
INVENTORY
PURCHASING
CUSTOMERS
LOYALTY
REWARDS
APPOINTMENTS
SERVICES
RESTAURANT_TABLES
KITCHEN
EXPENSES
REPORTS
DELIVERY
```

BusinessEnabledModule should determine which modules/features are enabled for a business.

However:

IMPORTANT:

Module availability is NOT authorization.

Actual access must still be controlled through:

```text
User
+
StaffMembership
+
Role
+
Permission
+
Business Scope
+
Branch Scope
```

---

# 8. BRANCH

A Business can have many Branches.

Branch fields:

```text
id
business_id
branch_code
name
phone
email
address
city
province
postal_code
status
created_at
updated_at
```

Relationship:

```text
Business 1 -> MANY Branches
```

IMPORTANT:

DO NOT create:

```text
Branch.manager_id
Branch.supervisor_id
```

Instead, branch managers are represented through StaffMembership.

A branch may have multiple managers.

Example:

```text
Branch 1
 |
 +-- Manager A
 +-- Manager B
 +-- Cashier A
 +-- Cashier B
 +-- Inventory Staff
```

---

# 9. STAFF MEMBERSHIP

A User may have multiple memberships.

Example:

```text
Maria
 |
 +-- Business A / Branch 1 / Branch Manager
 |
 +-- Business A / Branch 2 / Branch Manager
```

StaffMembership:

```text
id
user_id
business_id
branch_id nullable
role_id
employee_code
job_title
hire_date
status
created_at
updated_at
```

This table is critical for multi-business and multi-branch authorization.

---

# 10. ROLES

Roles should include:

```text
SUPERADMIN
OWNER
BUSINESS_ADMIN
BRANCH_MANAGER
CASHIER
INVENTORY_STAFF
PURCHASING_STAFF
ACCOUNTANT
SERVICE_STAFF
KITCHEN_STAFF
DELIVERY_STAFF
CUSTOM
```

Use a Role model.

Roles may be system roles or business-specific custom roles.

Role fields:

```text
id
business_id nullable
name
code
description
scope
is_system_role
```

---

# 11. PERMISSIONS

Use granular permissions.

Examples:

```text
sales.view
sales.create
sales.void

refund.create
refund.approve

discount.create
discount.approve

inventory.view
inventory.adjust
inventory.transfer

products.create
products.edit
products.delete

staff.create
staff.edit
staff.deactivate

reports.view
reports.export

loyalty.view
loyalty.adjust

rewards.redeem
```

Create:

```text
Permission
RolePermission
```

RolePermission should implement many-to-many relationships.

Authorization logic should conceptually be:

```text
WHO?
    ↓
USER
    ↓
WHICH MEMBERSHIP?
    ↓
WHICH ROLE?
    ↓
WHICH BUSINESS?
    ↓
WHICH BRANCH?
    ↓
WHICH PERMISSION?
```

---

# 12. AUTHENTICATION

Use Django's built-in User system.

User should contain:

```text
id
username
email
password
first_name
last_name
phone
is_active
is_staff
is_superuser
last_login
date_joined
created_at
updated_at
```

Do not create a separate custom authentication system unnecessarily.

If using a custom User model, implement it correctly from the beginning before migrations.

---

# 13. USER SESSION TRACKING

Create UserSession:

```text
id
user_id
session_key
ip_address
user_agent
login_at
last_activity
logout_at
status
```

Create LoginAttempt:

```text
id
username
ip_address
success
failure_reason
created_at
```

Use these for security monitoring and audit purposes.

---

# 14. BUSINESS SETTINGS

BusinessSettings:

```text
id
business_id UNIQUE
default_currency
timezone
default_tax_id
allow_negative_stock
require_customer_for_sale
created_at
updated_at
```

---

# 15. BRANCH SETTINGS

BranchSettings:

```text
id
branch_id UNIQUE
allow_negative_stock
auto_print_receipt
receipt_footer
default_register_id
created_at
updated_at
```

---

# 16. BRANCH OPERATING HOURS

BranchOperatingHours:

```text
id
branch_id
day_of_week
is_open
opening_time
closing_time
```

---

# 17. REGISTER

Each branch can have multiple POS registers.

Register:

```text
id
branch_id
register_code
name
terminal_identifier
status
created_at
updated_at
```

---

# 18. CASH DRAWER

CashDrawer:

```text
id
register_id UNIQUE
status
created_at
updated_at
```

---

# 19. CASHIER SHIFT

Cashiers should operate through shifts.

CashierShift:

```text
id
register_id
cashier_id
branch_id
opened_at
closed_at
opening_cash
expected_cash
actual_cash
cash_variance
status
opening_notes
closing_notes
approved_by
approved_at
created_at
updated_at
```

Workflow:

```text
Cashier Login
      ↓
Open Shift
      ↓
Sales
      ↓
Cash Movements
      ↓
Close Shift
      ↓
Count Cash
      ↓
Expected vs Actual
      ↓
Variance
      ↓
Supervisor Review
```

Use concurrency protection where appropriate.

---

# 20. CASH MOVEMENT

CashMovement:

```text
id
shift_id
movement_type
amount
reason
reference_type
reference_id
created_by
approved_by
created_at
```

Movement types:

```text
OPENING
CASH_IN
CASH_OUT
PETTY_CASH
SAFE_DROP
REFUND
ADJUSTMENT
CLOSING
```

---

# 21. CATALOG

Catalog is Business-level.

Categories:

```text
id
business_id
parent_id nullable
name
code
description
status
```

Categories should support nesting.

Example:

```text
Food
 |
 +-- Drinks
 |     +-- Coffee
 |     +-- Juice
 |
 +-- Meals
```

---

# 22. ITEM

Create a generic Item model.

Fields:

```text
id
business_id
category_id
item_type
sku
name
description
track_inventory
taxable
is_active
created_at
updated_at
```

Item types:

```text
PRODUCT
SERVICE
MENU_ITEM
PACKAGE
BUNDLE
```

---

# 23. ITEM VARIANTS

ItemVariant:

```text
id
item_id
sku
name
attributes JSON
cost_price
status
```

Example:

```text
T-Shirt
 |
 +-- Small / Red
 +-- Medium / Red
 +-- Large / Red
```

---

# 24. BARCODES

ItemBarcode:

```text
id
item_id
variant_id nullable
barcode
barcode_type
is_primary
status
```

---

# 25. RESTAURANT MODIFIERS

ModifierGroup:

```text
id
business_id
name
status
```

Modifier:

```text
id
modifier_group_id
name
price_adjustment
status
```

Examples:

```text
Size
 + Small
 + Medium
 + Large

Milk
 + Regular
 + Soy
 + Oat

Add-ons
 + Cheese
 + Bacon
```

---

# 26. PRICE LISTS

PriceList:

```text
id
business_id
name
code
price_type
valid_from
valid_to
status
```

Examples:

```text
REGULAR
VIP
WHOLESALE
PROMO
BRANCH_SPECIFIC
```

ItemPrice:

```text
id
price_list_id
item_id
variant_id nullable
selling_price
cost_price
effective_from
effective_to
created_at
```

IMPORTANT:

A completed sale must store the actual unit price used at the time of sale.

Do not depend on the current ItemPrice to reconstruct historical transactions.

---

# 27. TAX

Tax:

```text
id
business_id
name
rate
type
status
```

---

# 28. INVENTORY

Inventory is branch/location specific.

InventoryLocation:

```text
id
branch_id
name
location_type
status
```

Examples:

```text
Store Floor
Stock Room
Freezer
Warehouse
```

Inventory:

```text
id
branch_id
location_id
item_id
variant_id nullable
quantity
reserved_quantity
reorder_level
maximum_stock
created_at
updated_at
```

Unique logical combination:

```text
branch
+
location
+
item
+
variant
```

---

# 29. STOCK MOVEMENT

Every stock change must create a StockMovement.

StockMovement:

```text
id
inventory_id
movement_type
quantity
reference_type
reference_id
reason
created_by
created_at
```

Movement types:

```text
OPENING
PURCHASE
SALE
RETURN
TRANSFER_IN
TRANSFER_OUT
DAMAGE
ADJUSTMENT
STOCK_COUNT
```

Stock equation:

```text
Opening
+ Purchases
+ Transfers In
+ Returns
- Sales
- Transfers Out
- Damage
+/- Adjustments
=
Current Stock
```

Do not silently modify stock without an auditable movement.

---

# 30. STOCK COUNT

StockCount:

```text
id
branch_id
location_id
count_number
status
counted_by
approved_by
started_at
completed_at
```

StockCountItem:

```text
id
stock_count_id
item_id
variant_id
system_quantity
actual_quantity
variance
reason
```

---

# 31. STOCK TRANSFER

StockTransfer:

```text
id
business_id
source_branch_id
destination_branch_id
requested_by
approved_by
status
transfer_date
notes
```

StockTransferItem:

```text
id
transfer_id
item_id
variant_id
quantity
```

Transfers must create corresponding stock movements.

---

# 32. CUSTOMER

Customer is Business-level.

Customer:

```text
id
business_id
customer_code
first_name
last_name
phone
email
birth_date
gender
customer_group_id nullable
status
created_at
updated_at
```

A customer belongs to one Business.

Customers must not automatically be shared between unrelated Businesses.

---

# 33. CUSTOMER ADDRESS

CustomerAddress:

```text
id
customer_id
type
address_line
barangay
municipality
province
postal_code
is_default
```

Types:

```text
HOME
WORK
BILLING
SHIPPING
OTHER
```

---

# 34. CUSTOMER GROUP

CustomerGroup:

```text
id
business_id
name
description
discount_percentage
status
```

---

# 35. LOYALTY

Loyalty is Business-level.

LoyaltyProgram:

```text
id
business_id
name
description
points_per_amount
minimum_redeem_points
allow_branch_redemption
points_expiration_days
status
start_date
end_date
```

CustomerLoyaltyAccount:

```text
id
customer_id
loyalty_program_id
points_balance
lifetime_points
redeemed_points
status
joined_at
```

---

# 36. LOYALTY LEDGER

Do NOT rely only on points_balance.

Create LoyaltyTransaction:

```text
id
loyalty_account_id
transaction_type
points
reference_type
reference_id
description
created_by
created_at
```

Types:

```text
EARN
REDEEM
BONUS
ADJUSTMENT
EXPIRED
REVERSAL
```

The ledger is the source of truth.

Balance may be cached/calculated for performance.

---

# 37. REWARDS

Reward:

```text
id
loyalty_program_id
name
description
reward_type
points_required
monetary_value
item_id nullable
start_date
end_date
status
```

Reward types:

```text
DISCOUNT
FIXED_AMOUNT
FREE_PRODUCT
FREE_SERVICE
FREE_MENU_ITEM
FREE_UPGRADE
VOUCHER
CUSTOM
```

---

# 38. REWARD REDEMPTION

RewardRedemption:

```text
id
reward_id
customer_id
loyalty_account_id
sale_id nullable
branch_id
points_used
status
redeemed_by
redeemed_at
```

Workflow:

```text
Customer
 ↓
Loyalty Account
 ↓
Sale
 ↓
Earn Points
 ↓
Loyalty Transaction
 ↓
Balance
 ↓
Redeem Reward
 ↓
Reward Redemption
 ↓
Loyalty Transaction
```

Loyalty can be earned at Branch A and redeemed at Branch B when the Business allows cross-branch redemption.

---

# 39. SALES

Sale:

```text
id
business_id
branch_id
register_id
shift_id
cashier_id
customer_id nullable
receipt_number
order_number
status
subtotal
discount_amount
tax_amount
total_amount
created_at
completed_at
```

Statuses:

```text
DRAFT
PENDING
CONFIRMED
PAID
PROCESSING
COMPLETED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

---

# 40. SALE ITEMS

SaleItem:

```text
id
sale_id
item_id
variant_id nullable
quantity
unit_price
discount_amount
tax_amount
subtotal
total
```

SaleItemModifier:

```text
id
sale_item_id
modifier_id
quantity
price_adjustment
total
```

---

# 41. DISCOUNTS

Discount:

```text
id
business_id
name
code
discount_type
value
requires_approval
start_date
end_date
status
```

SaleDiscount:

```text
id
sale_id
discount_id
amount
applied_by
approved_by nullable
```

If a discount requires approval, approval must be recorded.

---

# 42. PAYMENTS

PaymentMethod:

```text
id
business_id
name
code
type
status
```

Examples:

```text
CASH
GCASH
MAYA
CARD
BANK_TRANSFER
ONLINE_PAYMENT
STORE_CREDIT
OTHER
```

Payment:

```text
id
sale_id
payment_method_id
amount
reference_number
status
paid_at
received_by
```

One Sale can have many Payments.

Therefore split payments must be supported.

Example:

```text
Sale = ₱1,000

Cash = ₱400
GCash = ₱600
```

---

# 43. PAYMENT TRANSACTION

PaymentTransaction:

```text
id
payment_id
provider
external_reference
provider_transaction_id
status
processed_at
metadata JSON
```

Use this for external payment providers.

---

# 44. RETURNS

Return:

```text
id
sale_id
business_id
branch_id
requested_by
approved_by
reason
status
refund_amount
created_at
approved_at
```

ReturnItem:

```text
id
return_id
sale_item_id
quantity
amount
reason
```

---

# 45. REFUNDS

Refund:

```text
id
return_id
payment_id nullable
amount
refund_method
reference_number
processed_by
processed_at
status
```

Workflow:

```text
Original Sale
 ↓
Return Request
 ↓
Select Items
 ↓
Reason
 ↓
Approval
 ↓
Refund
 ↓
Inventory Adjustment
 ↓
Loyalty Reversal if applicable
```

Completed financial records should not be hard-deleted.

Use status transitions such as:

```text
VOIDED
CANCELLED
REFUNDED
REVERSED
```

---

# 46. SUPPLIERS

Supplier:

```text
id
business_id
name
contact_person
phone
email
address
tax_number
status
```

---

# 47. PURCHASE ORDERS

PurchaseOrder:

```text
id
business_id
branch_id
supplier_id
created_by
status
order_date
expected_date
total_amount
```

PurchaseOrderItem:

```text
id
purchase_order_id
item_id
quantity
unit_cost
total
```

---

# 48. GOODS RECEIPT

GoodsReceipt:

```text
id
purchase_order_id
branch_id
received_by
status
received_at
```

GoodsReceiptItem:

```text
id
goods_receipt_id
item_id
variant_id
quantity
unit_cost
```

Receiving inventory must create StockMovement records.

---

# 49. SUPPLIER PAYMENT

SupplierPayment:

```text
id
supplier_id
purchase_order_id nullable
amount
payment_method
reference_number
paid_by
paid_at
status
```

Purchasing workflow:

```text
Purchase Request
 ↓
Approval
 ↓
Purchase Order
 ↓
Supplier
 ↓
Goods Receipt
 ↓
Stock Movement
 ↓
Inventory
 ↓
Supplier Payment
```

---

# 50. EXPENSES

ExpenseCategory:

```text
id
business_id
name
description
```

Expense:

```text
id
business_id
branch_id nullable
category_id
amount
description
expense_date
created_by
approved_by nullable
status
attachment_id nullable
created_at
```

---

# 51. GENERIC APPROVAL SYSTEM

Do not create separate approval frameworks unnecessarily.

Create:

ApprovalRequest:

```text
id
business_id
branch_id nullable
request_type
reference_type
reference_id
requested_by
status
created_at
```

ApprovalAction:

```text
id
approval_request_id
action
acted_by
comment
created_at
```

Supported request types:

```text
REFUND
DISCOUNT
STOCK_ADJUSTMENT
PURCHASE_ORDER
EXPENSE
CASH_ADJUSTMENT
PRICE_CHANGE
```

---

# 52. DOCUMENT SEQUENCES

DocumentSequence:

```text
id
business_id
branch_id nullable
document_type
prefix
year
current_number
```

Examples:

```text
REC-2026-000001
INV-2026-000001
PO-2026-000001
RET-2026-000001
REF-2026-000001
```

Sequence generation must be concurrency-safe.

Do not generate document numbers using unsafe "max + 1" logic.

---

# 53. SPA / SERVICE MODULE

ServiceBooking:

```text
id
business_id
branch_id
customer_id
booking_number
start_time
end_time
status
notes
created_by
```

ServiceBookingItem:

```text
id
booking_id
item_id
quantity
price
```

ServiceStaffAssignment:

```text
id
booking_item_id
staff_id
start_time
end_time
status
```

ServicePackage:

```text
id
business_id
name
description
price
validity_days
status
```

ServicePackageItem:

```text
id
package_id
item_id
quantity
```

---

# 54. SERVICE RESOURCES

ServiceResource:

```text
id
branch_id
name
resource_type
status
```

Examples:

```text
Massage Room 1
Massage Bed 3
Facial Room 2
Sauna Room
```

ResourceAssignment:

```text
id
booking_id
resource_id
start_time
end_time
```

Prevent double booking.

---

# 55. SPA/SERVICE WORKFLOW

```text
Customer
 ↓
Appointment / Walk-in
 ↓
Service Selection
 ↓
Staff Assignment
 ↓
Resource Assignment
 ↓
Service Performed
 ↓
Sale
 ↓
Payment
 ↓
Loyalty
```

---

# 56. RESTAURANT TABLE SECTIONS

TableSection:

```text
id
branch_id
name
status
```

---

# 57. RESTAURANT TABLES

RestaurantTable:

```text
id
branch_id
section_id
table_number
name
capacity
x_position
y_position
status
```

The x/y positions allow a graphical floor plan.

---

# 58. TABLE SESSION

TableSession:

```text
id
table_id
customer_id nullable
opened_at
closed_at
status
```

---

# 59. TABLE RESERVATION

TableReservation:

```text
id
branch_id
table_id nullable
customer_id nullable
reservation_number
reservation_date
start_time
end_time
guest_count
status
created_by
```

Prevent conflicting reservations where appropriate.

---

# 60. RESTAURANT ORDER

RestaurantOrder:

```text
id
business_id
branch_id
table_session_id nullable
customer_id nullable
order_number
order_type
status
created_by
created_at
completed_at
```

Order types:

```text
DINE_IN
TAKEOUT
DELIVERY
```

---

# 61. KITCHEN

KitchenOrder:

```text
id
restaurant_order_id
status
sent_at
ready_at
```

KitchenOrderItem:

```text
id
kitchen_order_id
sale_item/order_item reference
status
notes
```

KitchenOrderStatusHistory:

```text
id
kitchen_order_id
old_status
new_status
changed_by
changed_at
```

Example:

```text
NEW
 ↓
SENT
 ↓
PREPARING
 ↓
READY
 ↓
SERVED
```

---

# 62. DELIVERY

Support:

```text
DeliveryOrder
DeliveryAddress
DeliveryAssignment
DeliveryStatusHistory
```

Delivery should be a module rather than mandatory for all businesses.

---

# 63. NOTIFICATIONS

Notification:

```text
id
user_id
type
title
message
reference_type
reference_id
channel
is_read
created_at
read_at
```

Channels:

```text
IN_APP
EMAIL
SMS
PUSH
```

NotificationPreference:

```text
id
user_id
notification_type
channel
enabled
```

---

# 64. ATTACHMENTS

Attachment:

```text
id
business_id
branch_id nullable
uploaded_by
file
file_name
file_type
file_size
related_type
related_id
created_at
```

Use for:

* expense receipts
* supplier invoices
* refund documentation
* purchase documents
* business documents

---

# 65. AUDIT LOG

AuditLog:

```text
id
user_id
business_id nullable
branch_id nullable
action
module
table_name
record_id
old_values JSON
new_values JSON
ip_address
user_agent
created_at
```

Track important events such as:

```text
LOGIN
LOGOUT
USER_CREATED
USER_DEACTIVATED
ROLE_CHANGED

BUSINESS_CREATED
BRANCH_CREATED

PRODUCT_CREATED
PRODUCT_UPDATED
PRICE_CHANGED

SALE_CREATED
SALE_VOIDED

REFUND_REQUESTED
REFUND_APPROVED

DISCOUNT_APPROVED

STOCK_ADJUSTED
STOCK_TRANSFERRED

PURCHASE_APPROVED

LOYALTY_ADJUSTED
REWARD_REDEEMED
```

---

# 66. IDEMPOTENCY

Create:

IdempotencyKey:

```text
id
user_id
key
endpoint
request_hash
response_status
response_body JSON
created_at
expires_at
```

Use idempotency for critical POST operations:

```text
POST /sales
POST /payments
POST /refunds
POST /reward-redemptions
```

This prevents duplicate transactions from retries, mobile apps, network failures, or double-clicks.

---

# 67. TRANSACTION SAFETY

Critical operations must use:

```python
transaction.atomic()
```

Use row locking such as:

```python
select_for_update()
```

where necessary for:

* inventory
* loyalty balances
* cash shifts
* document sequences
* stock transfers
* payments
* refunds
* reward redemption

Never perform critical multi-table financial operations as independent writes.

Example:

```text
Create Sale
+
Create Sale Items
+
Deduct Inventory
+
Create Stock Movements
+
Create Payment
+
Update Loyalty
+
Create Audit Log
```

should be handled atomically where appropriate.

---

# 68. SOFT DELETION

Do not hard-delete important operational records.

For users, products, branches, discounts, etc., prefer:

```text
is_active
status
deactivated_at
```

Historical financial and inventory transactions should remain available.

---

# 69. FINANCIAL AND INVENTORY DATA

Financial and inventory records should be append-oriented/immutable wherever practical.

Do not simply overwrite historical transactions.

For example:

BAD:

```text
Sale total changed from ₱500 to ₱300
```

BETTER:

```text
Original Sale = ₱500
Return = ₱200
Refund = ₱200
```

Similarly:

```text
Original Loyalty Earn = +50
Reversal = -50
```

---

# 70. BUSINESS-SPECIFIC MODULES

## SPA

Use:

```text
Services
Service Packages
Appointments
Staff Assignments
Service Resources
Products
Inventory
Sales
Payments
Customers
Loyalty
Rewards
Expenses
Reports
```

## RETAIL

Use:

```text
Products
Categories
Variants
Barcodes
Inventory
Purchasing
Suppliers
Customers
Loyalty
Rewards
Discounts
Returns
Payments
Reports
```

## SERVICE

Use:

```text
Services
Service Packages
Appointments
Bookings
Staff Assignment
Resources
Customers
Loyalty
Rewards
Payments
Expenses
Reports
```

## RESTAURANT

Use:

```text
Menu
Categories
Modifiers
Tables
Floor Plan
Reservations
Table Sessions
Orders
Kitchen
Inventory
Purchasing
Customers
Loyalty
Rewards
Payments
Delivery
Reports
```

---

# 71. FINAL RELATIONSHIP STRUCTURE

The architecture should conceptually look like:

```text
USER
 |
 +-- OWNER PROFILE
 |
 +-- STAFF MEMBERSHIP
       |
       +-- BUSINESS
       +-- BRANCH
       +-- ROLE
              |
              +-- PERMISSIONS


OWNER
 |
 +-- BUSINESS
       |
       +-- BUSINESS TYPE
       +-- MODULES
       +-- SETTINGS
       +-- CATEGORIES
       |     |
       |     +-- ITEMS
       |           |
       |           +-- VARIANTS
       |           +-- BARCODES
       |           +-- MODIFIERS
       |
       +-- PRICE LISTS
       +-- TAXES
       +-- SUPPLIERS
       +-- CUSTOMERS
       +-- LOYALTY
       +-- DISCOUNTS
       +-- EXPENSES
       +-- APPROVALS
       +-- DOCUMENT SEQUENCES
       |
       +-- BRANCHES
             |
             +-- STAFF
             |
             +-- REGISTERS
             |     |
             |     +-- CASH DRAWER
             |           |
             |           +-- SHIFTS
             |                 |
             |                 +-- CASH MOVEMENTS
             |
             +-- INVENTORY LOCATIONS
             |     |
             |     +-- INVENTORY
             |           |
             |           +-- STOCK MOVEMENTS
             |
             +-- STOCK COUNTS
             |
             +-- STOCK TRANSFERS
             |
             +-- SALES
             |     |
             |     +-- SALE ITEMS
             |     +-- MODIFIERS
             |     +-- DISCOUNTS
             |     +-- PAYMENTS
             |     +-- RETURNS
             |     +-- REFUNDS
             |     +-- REWARD REDEMPTIONS
             |
             +-- SPA/SERVICE
             |
             +-- RESTAURANT
             |
             +-- REPORTING
```

---

# 72. REQUIRED DJANGO APP STRUCTURE

Use a modular Django architecture:

```text
backend/
│
├── config/
│
├── accounts/
├── authorization/
├── businesses/
├── branches/
├── catalog/
├── inventory/
├── customers/
├── loyalty/
├── sales/
├── payments/
├── purchasing/
├── expenses/
├── services/
├── restaurant/
├── approvals/
├── notifications/
├── documents/
├── audit/
└── reports/
```

Each app should have appropriate:

```text
models.py
serializers.py
views.py
urls.py
permissions.py
services.py
selectors.py
filters.py
admin.py
tests/
```

Do not put complex business logic directly inside API views.

Prefer service-layer functions/classes for transactional business operations.

---

# 73. API ARCHITECTURE

Use Django REST Framework.

API should be organized approximately as:

```text
/api/v1/
```

Examples:

```text
/api/v1/auth/
/api/v1/users/
/api/v1/businesses/
/api/v1/branches/
/api/v1/staff/
/api/v1/roles/
/api/v1/permissions/

/api/v1/categories/
/api/v1/items/
/api/v1/variants/
/api/v1/barcodes/
/api/v1/prices/

/api/v1/inventory/
/api/v1/stock-movements/
/api/v1/stock-counts/
/api/v1/stock-transfers/

/api/v1/customers/
/api/v1/loyalty/
/api/v1/rewards/

/api/v1/sales/
/api/v1/payments/
/api/v1/returns/
/api/v1/refunds/

/api/v1/suppliers/
/api/v1/purchase-orders/
/api/v1/goods-receipts/

/api/v1/expenses/
/api/v1/approvals/

/api/v1/services/
/api/v1/bookings/

/api/v1/restaurant/
/api/v1/tables/
/api/v1/reservations/
/api/v1/kitchen/
/api/v1/delivery/

/api/v1/reports/
/api/v1/audit/
```

---

# 74. REACT FRONTEND STRUCTURE

Use a modular React frontend.

Conceptually:

```text
src/
├── app/
├── auth/
├── components/
├── layouts/
├── pages/
│   ├── owner/
│   ├── superadmin/
│   ├── business/
│   ├── branch/
│   ├── cashier/
│   ├── inventory/
│   ├── purchasing/
│   ├── customers/
│   ├── loyalty/
│   ├── spa/
│   └── restaurant/
│
├── features/
│   ├── sales/
│   ├── inventory/
│   ├── payments/
│   ├── customers/
│   ├── loyalty/
│   ├── purchasing/
│   ├── services/
│   └── restaurant/
│
├── services/
├── hooks/
├── utils/
└── routes/
```

Frontend permissions should improve UX but MUST NOT be treated as the real security layer.

Backend authorization remains authoritative.

---

# 75. REQUIRED DASHBOARDS

## Owner Dashboard

Show:

```text
Businesses
Branches
Total Sales
Sales by Business
Sales by Branch
Customers
Inventory
Expenses
Profit-related metrics where data supports it
Loyalty
Top Products
Top Services
```

## Business Admin Dashboard

Show:

```text
Business Sales
Branch Comparison
Inventory
Customers
Loyalty
Purchasing
Expenses
Staff
Reports
```

## Branch Manager Dashboard

Show:

```text
Branch Sales
Cashier Performance
Current Shifts
Inventory
Low Stock
Expenses
Returns
Customers
Daily Summary
```

## Cashier Dashboard

Show:

```text
Current Shift
Register
Sales
Transactions
Payments
Returns where authorized
```

---

# 76. REPORTING PRINCIPLE

Reports should derive from transactional truth.

Do not duplicate data unnecessarily just to make reports easier.

Important reports:

```text
Sales Report
Daily Sales
Monthly Sales
Sales by Product
Sales by Category
Sales by Cashier
Sales by Branch
Payment Method Report
Inventory Report
Stock Movement Report
Low Stock Report
Purchasing Report
Supplier Report
Expense Report
Refund Report
Loyalty Report
Reward Redemption Report
Staff Performance
Restaurant Kitchen Performance
Service Performance
```

---

# 77. SECURITY REQUIREMENTS

The system must implement:

* secure password hashing
* HTTPS in production
* secure cookies/token handling
* CSRF protection where applicable
* CORS configuration
* rate limiting/throttling
* login attempt tracking
* permission checks
* tenant isolation
* branch isolation
* object-level authorization
* audit logging
* input validation
* serializer validation
* database constraints
* transaction atomicity
* idempotency
* secure file uploads
* restricted attachment access
* safe error messages
* no sensitive data leakage

Never trust:

```text
business_id
branch_id
user_id
role
permission
price
discount
tax
inventory quantity
```

provided by the client.

The backend must validate them.

---

# 78. DATABASE REQUIREMENTS

Prefer PostgreSQL for production.

Use:

* UUIDs where appropriate
* foreign keys
* unique constraints
* check constraints
* composite unique constraints
* indexes
* timestamps
* proper decimal fields for money
* timezone-aware DateTimeFields

Do NOT use floating point for monetary values.

Use:

```python
DecimalField
```

for:

* prices
* taxes
* discounts
* payments
* expenses
* refunds
* costs

---

# 79. MONEY

Use appropriate decimal precision.

Example:

```python
DecimalField(
    max_digits=14,
    decimal_places=2
)
```

Adjust according to actual requirements.

Never use:

```python
float
```

for money.

---

# 80. DATABASE CONSTRAINT EXAMPLES

Implement constraints such as:

```text
Business business_code UNIQUE
Branch (business, branch_code) UNIQUE
Register (branch, register_code) UNIQUE
Item (business, sku) UNIQUE where appropriate
Barcode UNIQUE
Inventory (branch, location, item, variant) UNIQUE
LoyaltyAccount (customer, loyalty_program) UNIQUE
BusinessSettings business UNIQUE
BranchSettings branch UNIQUE
CashDrawer register UNIQUE
```

Use appropriate conditional/partial unique constraints where supported.

---

# 81. CONCURRENCY

The application may have multiple cashiers/users operating simultaneously.

Protect against:

```text
double sales
double refunds
double stock deduction
overselling
duplicate payments
duplicate reward redemption
duplicate document numbers
cash race conditions
```

Use:

```python
transaction.atomic()
select_for_update()
```

and database constraints.

---

# 82. CRITICAL TRANSACTION EXAMPLE

A sale may involve:

```text
Sale
SaleItems
Inventory
StockMovement
Payments
Loyalty
RewardRedemption
CashMovement
AuditLog
```

The system must handle this consistently.

If inventory deduction fails, the transaction should not leave a partially completed sale.

Design the service layer accordingly.

---

# 83. ROLE/SCOPE EXAMPLES

Example:

```text
Owner
→ all businesses

Superadmin
→ platform administration

Business Admin
→ assigned business only

Branch Manager
→ assigned branch or branches

Cashier
→ assigned branch/register/shift

Inventory Staff
→ authorized inventory scope

Kitchen Staff
→ restaurant kitchen scope

Service Staff
→ assigned service operations

Delivery Staff
→ assigned delivery operations
```

Never assume that a role name alone determines access.

Actual authorization should be determined from:

```text
Role
+
Permission
+
Membership
+
Business
+
Branch
```

---

# 84. IMPORTANT BUSINESS RULES

Freeze these rules:

1. Exactly one platform Owner.
2. Owner can own many Businesses.
3. Business can have many Branches.
4. Branch can have multiple Branch Managers.
5. Never store a single manager FK directly on Branch.
6. Staff access uses StaffMembership.
7. Roles determine permissions.
8. Permissions determine allowed actions.
9. Business is the main tenant boundary.
10. Branch is the operational boundary.
11. Catalog belongs to Business.
12. Inventory belongs to Branch + Location.
13. Every stock change creates StockMovement.
14. Sales belong to Business + Branch + Register + Shift + Cashier.
15. Sale can have multiple Payments.
16. Loyalty is Business-level.
17. Loyalty uses a ledger.
18. Rewards belong to Loyalty Programs.
19. Refunds can reverse loyalty points.
20. Approval-sensitive actions require approval records.
21. Sensitive actions create AuditLogs.
22. Historical financial records are not hard deleted.
23. Inventory records are not silently overwritten.
24. Critical operations use transactions.
25. Concurrency-sensitive records use row locking.
26. Critical POST requests support idempotency.
27. Business type determines enabled modules.
28. Business type does not create separate authentication systems.
29. React is not the security boundary.
30. Django/DRF is the authoritative security boundary.

---

# 85. DEVELOPMENT PHASES

Implement in this order:

## Phase 1 — Authentication & Security

```text
User
OwnerProfile
StaffMembership
Role
Permission
RolePermission
UserSession
LoginAttempt
```

## Phase 2 — Business/Tenancy

```text
Business
BusinessType
BusinessModule
BusinessEnabledModule
BusinessSettings
Branch
BranchSettings
BranchOperatingHours
```

## Phase 3 — Catalog/Pricing

```text
Category
Item
ItemVariant
ItemBarcode
ModifierGroup
Modifier
PriceList
ItemPrice
Tax
```

## Phase 4 — Inventory

```text
InventoryLocation
Inventory
StockMovement
StockCount
StockCountItem
StockTransfer
StockTransferItem
```

## Phase 5 — POS/Cash

```text
Register
CashDrawer
CashierShift
CashMovement
Sale
SaleItem
SaleItemModifier
Discount
SaleDiscount
PaymentMethod
Payment
PaymentTransaction
```

## Phase 6 — Customers/Loyalty

```text
Customer
CustomerAddress
CustomerGroup
LoyaltyProgram
CustomerLoyaltyAccount
LoyaltyTransaction
Reward
RewardRedemption
```

## Phase 7 — Purchasing

```text
Supplier
PurchaseOrder
PurchaseOrderItem
GoodsReceipt
GoodsReceiptItem
SupplierPayment
```

## Phase 8 — Returns/Finance

```text
Return
ReturnItem
Refund
ExpenseCategory
Expense
ApprovalRequest
ApprovalAction
DocumentSequence
```

## Phase 9 — SPA/Services

```text
ServiceBooking
ServiceBookingItem
ServiceStaffAssignment
ServicePackage
ServicePackageItem
ServiceResource
ResourceAssignment
```

## Phase 10 — Restaurant

```text
TableSection
RestaurantTable
TableSession
TableReservation
RestaurantOrder
KitchenOrder
KitchenOrderItem
KitchenOrderStatusHistory
DeliveryOrder
DeliveryAddress
DeliveryAssignment
DeliveryStatusHistory
```

## Phase 11 — System

```text
Notification
NotificationPreference
Attachment
AuditLog
IdempotencyKey
```

## Phase 12 — Reporting

Implement reporting after transactional data models are stable.

---

# 86. WHAT I WANT YOU TO DO

First, analyze this entire specification.

Then verify:

1. Is the ERD logically correct?
2. Are there missing entities?
3. Are there redundant entities?
4. Are any relationships incorrect?
5. Are tenant boundaries correct?
6. Are branch boundaries correct?
7. Is the role/permission architecture secure?
8. Is the loyalty architecture correct?
9. Is the inventory architecture concurrency-safe?
10. Is the sales/payment architecture correct?
11. Are restaurant workflows correctly represented?
12. Are SPA/service workflows correctly represented?
13. Are purchasing workflows correctly represented?
14. Are refund/return workflows correct?
15. Are approvals sufficiently generic?
16. Is the audit architecture sufficient?
17. Is idempotency correctly placed?
18. Is the architecture suitable for 100+ simultaneous users?
19. Is the database structure suitable for production?
20. Is the Django app structure appropriate?
21. Is the DRF API architecture appropriate?
22. Is the React architecture appropriate?
23. Identify any potential security vulnerabilities.
24. Identify possible race conditions.
25. Identify possible data-integrity problems.
26. Identify possible scaling problems.
27. Identify anything that should be changed before implementation.

Do NOT simply say "looks good."

Be critical.

If something should be changed, explain:

```text
CURRENT DESIGN
↓
PROBLEM
↓
RECOMMENDED DESIGN
↓
REASON
```

---

# 87. IMPLEMENTATION REQUIREMENT

After validating the architecture, generate the production-ready Django implementation.

Start with:

```text
accounts/
authorization/
businesses/
branches/
catalog/
inventory/
customers/
loyalty/
sales/
payments/
purchasing/
expenses/
services/
restaurant/
approvals/
notifications/
documents/
audit/
reports/
```

For each app provide:

* models.py
* serializers.py
* views.py
* urls.py
* permissions.py
* services.py
* selectors.py where useful
* filters.py where useful
* admin.py
* tests

Use:

* Django ORM
* Django REST Framework
* PostgreSQL-compatible design
* UUIDs where appropriate
* DecimalField for money
* transaction.atomic()
* select_for_update()
* UniqueConstraint
* CheckConstraint
* indexes
* proper related_name
* appropriate on_delete
* model validation
* serializer validation

Avoid unnecessary abstraction.

Avoid putting business logic directly inside views.

---

# 88. API IMPLEMENTATION

For each major entity define:

```text
GET
POST
PUT/PATCH
DELETE where appropriate
```

But do NOT expose destructive operations if they violate the business rules.

Use actions/status changes for:

```text
void sale
approve refund
approve purchase
approve discount
close shift
complete stock count
approve stock adjustment
redeem reward
```

Do not simply expose raw database CRUD for sensitive operations.

---

# 89. SERVICE LAYER

Critical workflows should be implemented using service functions/classes.

Examples:

```text
create_sale()
complete_sale()
void_sale()
process_payment()
process_refund()
redeem_reward()
earn_loyalty_points()
adjust_inventory()
transfer_stock()
receive_purchase()
open_cashier_shift()
close_cashier_shift()
approve_expense()
approve_discount()
approve_refund()
```

These services should enforce business rules and transactions.

---

# 90. TESTING

Create tests for:

### Authentication

```text
valid login
invalid login
inactive user
permission denial
business isolation
branch isolation
```

### Sales

```text
create sale
multiple items
multiple payments
discount
tax
inventory deduction
loyalty earning
duplicate submission
concurrent sale
```

### Inventory

```text
purchase
sale
return
transfer
adjustment
stock count
concurrent stock deduction
```

### Loyalty

```text
earn points
redeem reward
insufficient points
duplicate redemption
refund reversal
cross-branch redemption
```

### Refunds

```text
request refund
approval
partial refund
full refund
inventory return
loyalty reversal
```

### Restaurant

```text
reserve table
open table session
create order
send to kitchen
update kitchen status
complete order
payment
```

### Services

```text
create booking
assign staff
assign resource
prevent double booking
complete service
payment
```

---

# 91. IMPORTANT OUTPUT FORMAT

When responding, organize the answer in this order:

```text
1. Architecture Validation
2. Problems Found
3. Recommended Changes
4. Final ERD
5. Django App Architecture
6. Django Models
7. Database Constraints
8. DRF Serializers
9. DRF ViewSets/API
10. Permission Architecture
11. Service Layer
12. Transaction Handling
13. React Architecture
14. API Endpoint Map
15. Security
16. Concurrency
17. Testing Strategy
18. Development Roadmap
19. Production Deployment Checklist
```

Do not skip important implementation details.

If the specification contains contradictions, identify them instead of silently choosing one.

If a design choice has multiple valid approaches, explain the trade-offs and select the architecture most appropriate for a production POS system.

The final implementation must remain consistent across:

```text
ERD
Django Models
Database Constraints
DRF Serializers
Permissions
Service Layer
API Endpoints
React Frontend
Tests
```

Do not design one layer differently from another.

The goal is a secure, scalable, maintainable, production-ready multi-business POS platform.
