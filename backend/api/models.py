from django.db import models
from django.contrib.auth.models import User

# 1. OPERATION BRANCHES (Ilocos Sur at Ilocos Norte Separation)
class Branch(models.Model):
    name = models.CharField(max_length=100, unique=True) # "Ilocos Sur" o "Ilocos Norte"
    address = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

# 2. VREAL COSMETICS PRODUCT INVENTORY (Mula sa opisyal na PDF list)
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
    
    name = models.CharField(max_length=255, unique=True) # e.g., "DAY CREAM A 20ML" o "Regular Set A"
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    barcode = models.CharField(max_length=100, unique=True, blank=True, null=True) # Para sa instant barcode scanner mapping
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    def __str__(self):
        return self.name

# 3. PER-BRANCH STOCK INVENTORY (Para sa malinis na In/Out tracking)
class BranchInventory(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    stock_qty = models.IntegerField(default=0)

    class Meta:
        unique_together = ('branch', 'product')

    def __str__(self):
        return f"{self.branch.name} - {self.product.name} ({self.stock_qty})"

# 4. CLIENT PROFILING & LOYALTY REWARDS SYSTEM
class ClientProfile(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    loyalty_points = models.DecimalField(max_digits=10, decimal_places=2, default=0.00) # Dynamic calculation base sa PHP threshold

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

# 5. VILLAREAL ACTIVE ROOM/TABLE MANAGEMENT (Real-time tracking per branch)
class RoomTable(models.Model):
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE)
    name = models.CharField(max_length=100) # e.g., "Room 1", "Table A"
    is_occupied = models.BooleanField(default=False)
    start_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(default=0) # Itatak dito kung ilang minuto ang service duration
    assigned_staff = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.branch.name} - {self.name}"