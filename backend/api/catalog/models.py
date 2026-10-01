# backend/api/catalog/models.py

from django.db import models
from django.contrib.auth.models import User

from api.access.managers import BusinessScopedModel


class Category(models.Model):
    """Grouping inside the company catalog (Spa Services, Beverages, Soap ...)."""
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=10, choices=[('PRODUCT', 'Product'), ('SERVICE', 'Service')])
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = 'api'
        unique_together = ('name', 'kind')
        ordering = ['sort_order', 'name']
        verbose_name_plural = 'Categories'

    def __str__(self):
        return f"{self.name} ({self.kind})"


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
        app_label = 'api'
        unique_together = ('name', 'item_type')
        indexes = [
            models.Index(fields=['item_type', 'is_active']),
            models.Index(fields=['barcode']),
        ]
        ordering = ['name']

    def __str__(self):
        return f"{self.name} [{self.item_type}]"


class BusinessItem(BusinessScopedModel):
    """Which business sells which item, at what price.

    This is how ONE catalog serves MANY businesses with no duplication —
    and how the same item can cost 150 at the spa and 130 in the kiosk.
    """
    # Re-declared (same definition as before) so the FK keeps its related_name
    # and stays editable in the admin, while `objects`/`all_objects` come from
    # ``BusinessScopedModel``.
    business = models.ForeignKey(
        'api.Business', on_delete=models.CASCADE, related_name='catalog_entries'
    )
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='business_entries')
    price_override = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_available = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = 'api'
        unique_together = ('business', 'item')

    @property
    def effective_price(self):
        return self.price_override if self.price_override is not None else self.item.selling_price

    def __str__(self):
        return f"{self.business.name} - {self.item.name} ({self.effective_price})"


class InventoryLevel(models.Model):
    """Stock per BRANCH — physical stock lives at an outlet.

    ``branch``/``item`` are ``PROTECT`` (§7.6): a catalog item or outlet is
    retired with ``is_active=False``, never by breaking stock history.
    """
    branch = models.ForeignKey('api.Branch', on_delete=models.PROTECT, related_name='inventory_levels')
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='inventory_levels')
    stock_qty = models.IntegerField(default=0)
    reorder_point = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'api'
        unique_together = ('branch', 'item')
        constraints = [
            models.CheckConstraint(check=models.Q(stock_qty__gte=0), name='inventory_non_negative'),
        ]

    def __str__(self):
        return f"{self.branch.name} - {self.item.name}: {self.stock_qty}"


class StockMovement(models.Model):
    """Append-only stock ledger — the history BranchInventory never had."""
    REASONS = [
        ('SALE', 'Sale'),
        ('VOID', 'Void/Return'),
        ('RECEIVE', 'Stock received'),
        ('ADJUST', 'Manual adjustment'),
        ('TRANSFER_OUT', 'Transfer out'),
        ('TRANSFER_IN', 'Transfer in'),
        ('WASTE', 'Damage/Waste'),
    ]

    branch = models.ForeignKey('api.Branch', on_delete=models.PROTECT, related_name='stock_movements')
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='stock_movements')
    quantity_delta = models.IntegerField()  # +receive / -sale
    reason = models.CharField(max_length=20, choices=REASONS)
    reference = models.CharField(max_length=64, blank=True)  # transaction number / transfer id
    balance_after = models.IntegerField()
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'api'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['item', 'created_at'])]

    def __str__(self):
        return f"{self.branch.name} - {self.item.name} ({self.quantity_delta}) reason={self.reason}"
