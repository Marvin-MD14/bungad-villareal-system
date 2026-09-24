# backend/api/models.py

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


# ============================================================
# BRANCH
# ============================================================

class Branch(models.Model):
    BRANCH_TYPE_CHOICES = [
        ('VSS', 'VSS Services Branch'),
        ('VREAL', 'VReal Products Branch'),
        ('BB', 'BB Products Branch'),
        ('MIXED', 'Mixed (VSS + VReal + BB)'),
    ]

    name = models.CharField(max_length=100, unique=True)
    branch_type = models.CharField(
        max_length=20,
        choices=BRANCH_TYPE_CHOICES,
        default='VSS',
        help_text='Determines which catalog this branch offers in POS'
    )
    address = models.TextField(blank=True, null=True)
    contact_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.get_branch_type_display()})"

    class Meta:
        verbose_name = "Branch"
        verbose_name_plural = "Branches"


# ============================================================
# USER PROFILE
# ============================================================

class UserProfile(models.Model):
    ROLE_CHOICES = [
        ('SUPERADMIN', 'Superadmin'),
        ('OWNER', 'Owner'),
        ('BRANCH_ADMIN', 'Branch Admin'),
        ('CASHIER', 'Cashier'),
        ('STAFF', 'Staff'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='STAFF')
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='user_profiles',
    )
    services = models.ManyToManyField(
        'VSSService',
        blank=True,
        related_name='staff_profiles',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        branch_name = self.branch.name if self.branch else 'All branches'
        return f"{self.user.username} - {self.get_role_display()} ({branch_name})"


# ============================================================
# PRODUCT (Generic - for inventory tracking)
# ============================================================

class Product(models.Model):
    CATEGORY_CHOICES = [
        ('DAY_CREAM', 'Realnew Day Cream'),
        ('NIGHT_CREAM', 'Night Cream'),
        ('NUTRIFIRM', 'Nutrifirm Gel'),
        ('TONER', 'Realnew Toner'),
        ('SOAP', 'Soap'),
        ('SUNBLOCK', 'Sunblock/Sunscreen'),
        ('MOISTURIZER', 'Moisturizer/Cream'),
        ('SERUM', 'Serum'),
        ('LOTION', 'Body Lotion'),
        ('SET', 'Product Set'),
        ('OTHERS', 'Other Cosmetics'),
    ]

    name = models.CharField(max_length=255, unique=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    barcode = models.CharField(max_length=100, unique=True, blank=True, null=True)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    min_stock = models.IntegerField(default=5)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    @property
    def stock_quantity(self):
        return self.branchinventory_set.aggregate(
            total=models.Sum('stock_qty')
        )['total'] or 0

    @property
    def is_low_stock(self):
        return self.stock_quantity <= self.min_stock


# ============================================================
# BRANCH INVENTORY
# ============================================================

class BranchInventory(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='inventory_items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='branch_inventories')
    stock_qty = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('branch', 'product')
        verbose_name = "Branch Inventory"
        verbose_name_plural = "Branch Inventories"

    def __str__(self):
        return f"{self.branch.name} - {self.product.name} ({self.stock_qty})"


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

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

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

class RoomTable(models.Model):
    ROOM_TYPES = [
        ('PEDICURE', 'Pedicure & Manicure'),
        ('FOOT_SPA', 'Foot Spa'),
        ('MASSAGE', 'Massage Room'),
        ('VIP', 'VIP Room'),
    ]

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='rooms')
    name = models.CharField(max_length=100)
    room_type = models.CharField(max_length=50, choices=ROOM_TYPES, default='PEDICURE')
    is_occupied = models.BooleanField(default=False)
    start_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(default=0)
    assigned_staff = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_rooms')
    customer_name = models.CharField(max_length=255, blank=True, null=True)
    service_type = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
# VSS SERVICES
# ============================================================

class VSSService(TimestampMixin):
    CATEGORY_CHOICES = [
        ('RADIO_FREQUENCY', 'Radio Frequency'),
        ('SALON_SERVICES', 'Salon Services'),
        ('HAND_FOOT_TREATMENT', 'Hand and Foot Treatment'),
        ('FACIAL_TREATMENT', 'Facial Treatment'),
        ('LASER_TREATMENT', 'Laser Treatment'),
        ('BLEACHING_WHITENING', 'Instant Bleaching and Skin Whitening'),
        ('HIFU_ULTERA', 'HIFU - Ultera'),
        ('PICO_WAY', 'Pico Way'),
        ('EYELASH_EXTENSIONS', 'Eyelash Extensions'),
        ('GLYCOLIC_PEELING', 'Glycolic Peeling'),
        ('SKIN_GROWTH_REMOVAL', 'Skin Growth Removal'),
        ('WAXING', 'Waxing'),
        ('MASSAGE', 'Massage'),
        ('MICRODERMABRASION', 'Microdermabrasion'),
        ('BODY_SCRUB', 'Body Scrub'),
        ('AESTHETIC_TATTOO', 'Aesthetic Tattoo/Semi Permanent Tattoo'),
        ('PROMO_PRICE', 'Promo Price'),
        ('PERMANENT_HAIR_REMOVAL', 'Permanent Hair Removal'),
        ('OTHER_SERVICES', 'Other Services'),
    ]

    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, blank=True, null=True)
    description = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.description

    class Meta:
        verbose_name = "VSS Service"
        verbose_name_plural = "VSS Services"
        ordering = ['category', 'description']


# ============================================================
# VREAL PRODUCTS
# ============================================================

class VRealProduct(TimestampMixin):
    CATEGORY_CHOICES = [
        ('SOAP', 'Soap'),
        ('FS_WASH', 'F/S Wash'),
        ('TONER', 'Toner'),
        ('NIGHT_CREAM', 'Night Cream'),
        ('MOISTURIZER', 'Moisturizer'),
        ('SUNBLOCK', 'Sunblock'),
        ('SERUM', 'Serum'),
        ('SET', 'Set'),
        ('GLUTA', 'Glutathione'),
        ('HAIR_CARE', 'Hair Care'),
        ('LOTION', 'Lotion'),
        ('OTHERS', 'Others'),
        ('SALON_PRODUCTS', 'Salon Products'),
    ]

    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, blank=True, null=True)
    product = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    size = models.CharField(max_length=50, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.product

    class Meta:
        verbose_name = "VReal Product"
        verbose_name_plural = "VReal Products"
        ordering = ['category', 'product']


# ============================================================
# BB PRODUCTS
# ============================================================

class BBProduct(TimestampMixin):
    product_name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.product_name

    class Meta:
        verbose_name = "BB Product"
        verbose_name_plural = "BB Products"
        ordering = ['product_name']


# ============================================================
# PANGANAN MENU
# ============================================================

class PangananMenu(TimestampMixin):
    CATEGORY_CHOICES = [
        ('BURGER', 'Burgers'),
        ('SILOG', 'Silog Meals'),
        ('SIZZLING', 'Sizzling'),
        ('WINGS', 'Chicken Wings'),
        ('BOWL', 'Rice Bowls'),
        ('VEGETABLE', 'Vegetable'),
        ('MERIENDA', 'Merienda'),
        ('BEVERAGE', 'Beverages'),
        ('OTHERS', 'Others'),
    ]

    menu = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='OTHERS')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.menu

    class Meta:
        verbose_name = "Panganan Menu"
        verbose_name_plural = "Panganan Menus"
        ordering = ['category', 'menu']


# ============================================================
# KB ITEM
# ============================================================

class KBItem(TimestampMixin):
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "KB Item"
        verbose_name_plural = "KB Items"


# ============================================================
# AUTO SPA SERVICE
# ============================================================

class AutoSpaService(TimestampMixin):
    service = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.service

    class Meta:
        verbose_name = "Auto Spa Service"
        verbose_name_plural = "Auto Spa Services"


# ============================================================
# TRANSACTION
# ============================================================

class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ('SALE', 'Sale'),
        ('VOID', 'Void'),
        ('RETURN', 'Return'),
        ('HOLD', 'Hold'),
    ]

    transaction_number = models.CharField(max_length=50, unique=True)
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE)
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, default='SALE')
    customer = models.ForeignKey(ClientProfile, on_delete=models.SET_NULL, null=True, blank=True)
    staff = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    change = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, default='PENDING')
    notes = models.TextField(blank=True, null=True)

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
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    service = models.ForeignKey(VSSService, on_delete=models.SET_NULL, null=True, blank=True)
    catalog_source = models.CharField(
        max_length=20,
        choices=CATALOG_SOURCE_CHOICES,
        default='GENERIC',
        help_text='Which catalog the item came from (VSS/VREAL/BB)'
    )
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES)
    description = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.IntegerField(default=1)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.transaction.transaction_number} - {self.description}"


# ============================================================
# DAILY SALES
# ============================================================

class DailySales(models.Model):
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


# ============================================================
# ATTENDANCE TRACKING
# ============================================================

class Attendance(models.Model):
    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('LATE', 'Late'),
        ('ABSENT', 'Absent'),
        ('HALF_DAY', 'Half Day'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_records')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    time_in = models.DateTimeField(null=True, blank=True)
    time_out = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PRESENT')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'date')
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

class CustomerFeedback(models.Model):
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

class Expense(models.Model):
    CATEGORY_CHOICES = [
        ('SUPPLIES', 'Supplies'),
        ('UTILITIES', 'Utilities'),
        ('RENT', 'Rent'),
        ('SALARY', 'Salary'),
        ('MAINTENANCE', 'Maintenance'),
        ('OTHERS', 'Others'),
    ]

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

class AuditLog(models.Model):
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
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
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