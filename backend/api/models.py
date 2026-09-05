# backend/api/models.py

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class Branch(models.Model):
    name = models.CharField(max_length=100, unique=True)
    address = models.TextField(blank=True, null=True)
    contact_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "Branch"
        verbose_name_plural = "Branches"


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


class ClientProfile(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    loyalty_points = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_spent = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    birth_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


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


class TimestampMixin(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        abstract = True


# ============ VSS SERVICES ============
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


# ============ VREAL PRODUCTS ============
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


# ============ PANGANAN MENU (KEEP BUT CAN BE REMOVED) ============
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


class KBItem(TimestampMixin):
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name = "KB Item"
        verbose_name_plural = "KB Items"


class AutoSpaService(TimestampMixin):
    service = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.service
    
    class Meta:
        verbose_name = "Auto Spa Service"
        verbose_name_plural = "Auto Spa Services"


# ============ TRANSACTION MODELS ============
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.transaction_number} - {self.total}"
    
    class Meta:
        ordering = ['-created_at']


class TransactionItem(models.Model):
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    service = models.ForeignKey(VSSService, on_delete=models.SET_NULL, null=True, blank=True)
    item_type = models.CharField(max_length=20, choices=[('PRODUCT', 'Product'), ('SERVICE', 'Service')])
    description = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.IntegerField(default=1)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    
    def __str__(self):
        return f"{self.transaction.transaction_number} - {self.description}"


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