# backend/api/models.py

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

from .company.models import Company
from .business.models import BusinessType, Business
from .access.models import UserAccess
from .catalog.models import Category, Item, BusinessItem, InventoryLevel, StockMovement
from .access.managers import BusinessScopedModel, BusinessScopedQuerySetModel, BusinessStampMixin


# ============================================================
# BRANCH
# ============================================================

class Branch(BusinessScopedQuerySetModel):
    """An outlet (physical location) of exactly one parent **Business**.

    Naming (this tripped us up before): a **Business** is the top operating unit
    the Owner/superadmin creates (e.g. "Spa Biz"); a **Branch** is one *outlet*
    of it (e.g. "Main", "DSM-01").  They are NOT the same thing — Business is the
    parent and the isolation boundary, Branch is its outlet.  Every row a branch
    owns (sales, expenses, rooms, stock) is stamped with the branch's business,
    so a branch can never be shared across businesses.  The old ``branch_type``
    column is gone; the legacy POS label it used to carry is now *derived* from
    the parent business so older tills keep working.
    """
    LEGACY_TYPE_CHOICES = [
        ('VSS', 'VSS Services Branch'),
        ('VREAL', 'VReal Products Branch'),
        ('BB', 'BB Products Branch'),
        ('MIXED', 'Mixed (VSS + VReal + BB)'),
    ]
    LEGACY_LABELS = dict(LEGACY_TYPE_CHOICES)
    LEGACY_SLUGS = ('vss', 'vreal', 'bb')

    business = models.ForeignKey(
        'api.Business', on_delete=models.CASCADE, related_name='branches'
    )
    code = models.CharField(max_length=20, blank=True)
    name = models.CharField(max_length=100)
    address = models.TextField(blank=True, null=True)
    contact_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    opens_at = models.TimeField(null=True, blank=True)
    closes_at = models.TimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def branch_type(self):
        """Legacy catalog label, derived from the branch's business (read-only)."""
        business = getattr(self, 'business', None)
        if business is None:
            return 'MIXED'
        haystack = f'{business.slug or ""} {getattr(business.business_type, "code", "") or ""}'.lower()
        for code in self.LEGACY_SLUGS:
            if code in haystack:
                return code.upper()
        return 'MIXED'

    def get_branch_type_display(self):
        return self.LEGACY_LABELS.get(self.branch_type, 'Mixed (VSS + VReal + BB)')

    def __str__(self):
        business = getattr(self, 'business', None)
        return f"{self.name} ({business.name})" if business else self.name

    class Meta:
        ordering = ['business__name', 'name']
        unique_together = ('business', 'name')
        verbose_name = "Branch"
        verbose_name_plural = "Branches"


# ============================================================
# USER PROFILE
# ============================================================

class UserProfile(models.Model):
    """Personal data only.

    ``role`` and ``branch`` were removed (§4.4): what a user may do, and where,
    is decided by ``UserAccess`` grants so one account can be a cashier in one
    business and a manager in another.  Staff skills point at the unified
    catalog: ``services`` used to be an M2M to ``VSSService``, which is gone.
    """

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='staff/', blank=True, null=True)
    # NOTE: the API keeps accepting/returning a `services` payload key, mapped
    # onto `skills` (Item ids) for backwards compatibility with the frontend.
    skills = models.ManyToManyField(
        'api.Item',
        blank=True,
        related_name='skilled_staff',
        help_text='Services this staff member can perform (unified catalog Items)',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} — profile"

    @property
    def role(self):
        """Capability role, derived from the account's active/most-powerful grant.

        Read-only convenience for the UI; never a source of truth.  Use
        ``api.permissions.get_effective_role(request)`` for authorization.
        """
        grant = (
            self.user.access_grants.filter(is_active=True)
            .select_related('business')
            .order_by('is_primary', 'id')
            .first()
        )
        if grant is not None:
            return grant.role
        if self.user.is_superuser:
            return 'OWNER'
        return 'STAFF'

    class Meta:
        ordering = ['user__username']
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"


# ============================================================
# CLIENT PROFILE (with Loyalty & Tier System)
# ============================================================

class ClientProfile(models.Model):
    TIER_CHOICES = [
        ('BRONZE', 'Bronze'),
        ('SILVER', 'Silver'),
        ('GOLD', 'Gold'),
        ('PLATINUM', 'Platinum'),
    ]

    GENDER_CHOICES = [
        ('Male', 'Male'),
        ('Female', 'Female'),
    ]

    # Tier thresholds (adjust as needed)
    TIER_THRESHOLDS = {
        'BRONZE': 0,
        'SILVER': 1000,
        'GOLD': 5000,
        'PLATINUM': 10000,
    }

    TIER_DISCOUNTS = {
        'BRONZE': 0,
        'SILVER': 5,
        'GOLD': 10,
        'PLATINUM': 15,
    }

    # Personal Info
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    age = models.PositiveIntegerField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='Female')
    address = models.TextField(blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    birth_date = models.DateField(null=True, blank=True)

    # Loyalty Info
    loyalty_points = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_spent = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    loyalty_tier = models.CharField(max_length=20, choices=TIER_CHOICES, default='BRONZE')
    free_items_available = models.IntegerField(default=0)
    # §7.10: customers are retired with is_active=False, never deleted, so old
    # receipts keep resolving and the loyalty history stays truthful.
    is_active = models.BooleanField(default=True)

    # The tenant that owns this customer. A client (and therefore their loyalty
    # balance and rewards) belongs to exactly one business: without this the
    # customers table was shared by every tenant, and a cashier scoped to one
    # outlet could read — and check out against — another business's customers.
    # Nullable so the migration can land before the backfill assigns owners.
    business = models.ForeignKey(
        'api.Business', on_delete=models.CASCADE, null=True, blank=True,
        related_name='clients',
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    class Meta:
        ordering = ['last_name', 'first_name']
        indexes = [models.Index(fields=['phone_number'])]
        verbose_name = "Client Profile"
        verbose_name_plural = "Client Profiles"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def get_discount_rate(self):
        """Return the discount rate (%) based on tier."""
        return self.TIER_DISCOUNTS.get(self.loyalty_tier, 0)

    def get_next_tier_info(self):
        """Return info about the next tier and progress."""
        tiers = [
            ('BRONZE', 0, 999),
            ('SILVER', 1000, 4999),
            ('GOLD', 5000, 9999),
            ('PLATINUM', 10000, float('inf')),
        ]
        current_spent = float(self.total_spent)
        for i, (tier, min_spent, max_spent) in enumerate(tiers):
            if tier == self.loyalty_tier:
                if tier == 'PLATINUM':
                    return {
                        'next_tier': None,
                        'next_tier_threshold': None,
                        'remaining_to_next': 0,
                        'progress_percent': 100,
                    }
                next_tier = tiers[i + 1]
                remaining = next_tier[1] - current_spent
                range_size = next_tier[1] - min_spent
                progress = ((current_spent - min_spent) / range_size) * 100 if range_size > 0 else 0
                return {
                    'next_tier': next_tier[0],
                    'next_tier_threshold': next_tier[1],
                    'remaining_to_next': max(0, remaining),
                    'progress_percent': min(100, max(0, progress)),
                }
        return {
            'next_tier': None,
            'next_tier_threshold': None,
            'remaining_to_next': 0,
            'progress_percent': 100,
        }

    def recalculate_tier(self):
        """Recalculate and update the tier based on total_spent. Returns (old_tier, new_tier)."""
        spent = float(self.total_spent)
        if spent >= 10000:
            new_tier = 'PLATINUM'
        elif spent >= 5000:
            new_tier = 'GOLD'
        elif spent >= 1000:
            new_tier = 'SILVER'
        else:
            new_tier = 'BRONZE'

        old_tier = self.loyalty_tier
        self.loyalty_tier = new_tier
        return old_tier, new_tier


# ============================================================
# ROOM TABLE
# ============================================================

class RoomTable(BusinessScopedQuerySetModel):
    ROOM_TYPES = [
        ('PEDICURE', 'Pedicure & Manicure'),
        ('FOOT_SPA', 'Foot Spa'),
        ('MASSAGE', 'Massage Room'),
        ('VIP', 'VIP Room'),
    ]

    business = models.ForeignKey(
        'api.Business', on_delete=models.CASCADE, null=True, blank=True, related_name='rooms'
    )
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='rooms')
    name = models.CharField(max_length=100)
    room_type = models.CharField(max_length=50, choices=ROOM_TYPES, default='PEDICURE')
    is_occupied = models.BooleanField(default=False)
    start_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(default=0)
    assigned_staff = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_rooms')
    customer_name = models.CharField(max_length=255, blank=True, null=True)
    # §4.5: `service_type` free text -> optional unified-catalog Item FK.
    # The text column stays as a printable fallback/snapshot for legacy rows.
    service_type = models.CharField(max_length=255, blank=True, null=True)
    item = models.ForeignKey(
        'api.Item',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='room_bookings',
        help_text='Catalog service currently being performed in this room, if any',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['branch__name', 'name']
        verbose_name = "Room Table"
        verbose_name_plural = "Room Tables"

    def __str__(self):
        return f"{self.branch.name} - {self.name}"

    @property
    def time_remaining(self):
        if self.start_time and self.duration_minutes:
            elapsed = (timezone.now() - self.start_time).total_seconds() / 60
            return max(0, self.duration_minutes - elapsed)
        return 0


# ============================================================
# TIMESTAMP MIXIN
# ============================================================

class TimestampMixin(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# ============================================================
# LEGACY PER-CATALOG TABLES REMOVED (Phase 5)
# ------------------------------------------------------------
# Product, BranchInventory, VSSService, VRealProduct, BBProduct,
# PangananMenu, KBItem and AutoSpaService were collapsed into the
# unified catalog (api/catalog/models.py: Category, Item,
# BusinessItem, InventoryLevel, StockMovement) by migration 0009/0010.
# The old URLs live on as read-only shims over Item.
# ============================================================


# ============================================================
# TRANSACTION
# ============================================================

class Transaction(BusinessScopedQuerySetModel):
    TRANSACTION_TYPES = [
        ('SALE', 'Sale'),
        ('VOID', 'Void'),
        ('RETURN', 'Return'),
        ('HOLD', 'Hold'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PAID', 'Paid'),
        ('VOIDED', 'Voided'),
        ('HELD', 'Held'),
    ]

    business = models.ForeignKey(
        'api.Business', on_delete=models.CASCADE, null=True, blank=True, related_name='transactions'
    )
    idempotency_key = models.CharField(max_length=128, unique=True, null=True, blank=True)
    # §3.4 L4: receipts are unique *per business*, so two outlets of different
    # businesses can never collide on a counter-derived number.
    transaction_number = models.CharField(max_length=50)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT)
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, default='SALE')
    customer = models.ForeignKey(ClientProfile, on_delete=models.SET_NULL, null=True, blank=True)
    staff = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    change = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    notes = models.TextField(blank=True, null=True)
    # The till session that rang this sale up, when one was open. Payments made
    # against a sale inherit it, which is what makes shift reconciliation work.
    shift = models.ForeignKey(
        'api.CashierShift', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='transactions',
    )

    # Loyalty & Rewards fields
    customer_tier_at_purchase = models.CharField(max_length=20, blank=True, null=True)
    tier_discount_applied = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    points_earned = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    rewards_applied = models.ManyToManyField(
        'CustomerReward',
        blank=True,
        related_name='applied_in_transactions',
        help_text='Rewards claimed in this transaction'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.transaction_number} - {self.total}"

    class Meta:
        ordering = ['-created_at']
        # A receipt number only has to be unique inside the business that issued
        # it (§3.4 L4); the global `unique=True` was stricter than needed.
        unique_together = ('business', 'transaction_number')


# ============================================================
# TRANSACTION ITEM
# ============================================================

class TransactionItem(models.Model):
    ITEM_TYPE_CHOICES = [
        ('PRODUCT', 'Product'),
        ('SERVICE', 'Service'),
    ]
    CATALOG_SOURCE_CHOICES = [
        ('VSS', 'VSS Service'),
        ('VREAL', 'VReal Product'),
        ('BB', 'BB Product'),
        ('GENERIC', 'Generic Product'),
    ]

    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='items')
    # §5.4: the line carries its own branch so stock/ledger questions ("which
    # outlet sold this?") never need the parent transaction.
    branch = models.ForeignKey(
        Branch, on_delete=models.PROTECT, null=True, blank=True,
        related_name='transaction_items',
    )
    item = models.ForeignKey('api.Item', on_delete=models.PROTECT, null=True, blank=True, related_name='transaction_items')
    catalog_source = models.CharField(
        max_length=20,
        choices=CATALOG_SOURCE_CHOICES,
        default='GENERIC',
        help_text='Which legacy catalog the item came from (VSS/VREAL/BB) — derived, kept for receipts'
    )
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES)
    description = models.CharField(max_length=255)
    # Snapshot (deliberate duplication, §5.4): a receipt must reprint the price
    # that was actually charged even if the Item is repriced later.
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.IntegerField(default=1)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ['transaction_id', 'id']
        verbose_name = "Transaction Item"
        verbose_name_plural = "Transaction Items"

    def __str__(self):
        return f"{self.transaction.transaction_number} - {self.description}"


# ============================================================
# DAILY SALES
# ============================================================

class DailySales(BusinessScopedQuerySetModel):
    business = models.ForeignKey(
        'api.Business', on_delete=models.CASCADE, null=True, blank=True, related_name='daily_sales'
    )
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE)
    date = models.DateField()
    total_sales = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    total_expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    total_void = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    transaction_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('branch', 'date')
        ordering = ['-date']
        verbose_name = "Daily Sales"
        verbose_name_plural = "Daily Sales"


# ============================================================
# ATTENDANCE TRACKING
# ============================================================

class Attendance(BusinessScopedQuerySetModel):
    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('LATE', 'Late'),
        ('ABSENT', 'Absent'),
        ('HALF_DAY', 'Half Day'),
    ]

    business = models.ForeignKey(
        'api.Business', on_delete=models.CASCADE, null=True, blank=True, related_name='attendance_records'
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_records')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    time_in = models.DateTimeField(null=True, blank=True)
    time_out = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PRESENT')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'branch', 'date')
        ordering = ['-date']
        verbose_name = "Attendance"
        verbose_name_plural = "Attendance Records"

    def __str__(self):
        return f"{self.user.username} - {self.date} ({self.status})"

    @property
    def hours_worked(self):
        if self.time_in and self.time_out:
            delta = self.time_out - self.time_in
            return round(delta.total_seconds() / 3600, 2)
        return 0


# ============================================================
# CUSTOMER FEEDBACK
# ============================================================

class CustomerFeedback(BusinessScopedQuerySetModel):
    RATING_CHOICES = [(i, str(i)) for i in range(1, 6)]

    customer = models.ForeignKey(
        ClientProfile, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='feedbacks'
    )
    transaction = models.ForeignKey(
        'Transaction', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='feedbacks'
    )
    staff = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='feedbacks_received'
    )
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='feedbacks')
    business = models.ForeignKey(
        'api.Business', on_delete=models.CASCADE, null=True, blank=True, related_name='feedbacks'
    )
    rating = models.IntegerField(choices=RATING_CHOICES, default=5)
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Customer Feedback"
        verbose_name_plural = "Customer Feedbacks"

    def __str__(self):
        return f"{self.rating}★ - {self.staff.username if self.staff else 'N/A'}"


# ============================================================
# EXPENSE TRACKING
# ============================================================

class Expense(BusinessScopedQuerySetModel):
    CATEGORY_CHOICES = [
        ('SUPPLIES', 'Supplies'),
        ('UTILITIES', 'Utilities'),
        ('RENT', 'Rent'),
        ('SALARY', 'Salary'),
        ('MAINTENANCE', 'Maintenance'),
        ('OTHERS', 'Others'),
    ]

    business = models.ForeignKey(
        'api.Business', on_delete=models.CASCADE, null=True, blank=True, related_name='expenses'
    )
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='expenses')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    expense_date = models.DateField()
    recorded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='expenses_recorded'
    )
    receipt = models.FileField(upload_to='receipts/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-expense_date']
        verbose_name = "Expense"
        verbose_name_plural = "Expenses"

    def __str__(self):
        return f"{self.branch.name} - {self.description} (₱{self.amount})"


# ============================================================
# AUDIT LOG
# ============================================================

class AuditLog(BusinessScopedQuerySetModel):
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
        ('VOID', 'Void'),
        ('RESTOCK', 'Restock'),
    ]

    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs'
    )
    business = models.ForeignKey(
        'api.Business', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs'
    )
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    request_id = models.CharField(max_length=64, blank=True, null=True)
    user_agent = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"

    def __str__(self):
        return f"{self.user.username if self.user else 'System'} - {self.action} - {self.model_name}"


# ============================================================
# CUSTOMER REWARD (Loyalty Program)
# ============================================================

class CustomerReward(models.Model):
    REWARD_TYPES = [
        ('DISCOUNT', 'Discount'),
        ('FREE_ITEM', 'Free Item'),
        ('POINTS', 'Points'),
        ('TIER_UPGRADE', 'Tier Upgrade'),
    ]

    STATUS_CHOICES = [
        ('AVAILABLE', 'Available'),
        ('CLAIMED', 'Claimed'),
        ('EXPIRED', 'Expired'),
    ]

    customer = models.ForeignKey(
        ClientProfile,
        on_delete=models.CASCADE,
        related_name='rewards'
    )
    reward_type = models.CharField(max_length=20, choices=REWARD_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='AVAILABLE')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Discount amount or points value"
    )
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        help_text="Discount percentage (if applicable)"
    )
    earned_at = models.DateTimeField(auto_now_add=True)
    claimed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    transaction = models.ForeignKey(
        'Transaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rewards_generated',
        help_text='Transaction where this reward was earned'
    )
    claimed_in_transaction = models.ForeignKey(
        'Transaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rewards_claimed',
        help_text='Transaction where this reward was claimed'
    )

    class Meta:
        ordering = ['-earned_at']
        verbose_name = "Customer Reward"
        verbose_name_plural = "Customer Rewards"

    def __str__(self):
        return f"{self.customer.full_name} - {self.title} ({self.status})"


# ============================================================
# REWARD CLAIM (Audit Trail)
# ============================================================

class RewardClaim(models.Model):
    reward = models.ForeignKey(
        CustomerReward,
        on_delete=models.CASCADE,
        related_name='claims'
    )
    transaction = models.ForeignKey(
        'Transaction',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reward_claims'
    )
    claimed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reward_claims_made'
    )
    amount_applied = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    claimed_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-claimed_at']
        verbose_name = "Reward Claim"
        verbose_name_plural = "Reward Claims"

    def __str__(self):
        return f"{self.reward.customer.full_name} - {self.reward.title}"