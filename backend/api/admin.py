from django.contrib import admin

from .models import Branch, ClientProfile, RoomTable, UserProfile, Transaction, Expense
from .company.models import Company
from .business.models import Business, BusinessType
from .access.models import UserAccess
from .catalog.models import Category, Item, BusinessItem, InventoryLevel, StockMovement


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'business_type', 'is_active')
    list_filter = ('business_type', 'is_active')
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name', 'slug')


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'item_type', 'category', 'selling_price', 'tracks_stock', 'is_active')
    list_filter = ('item_type', 'is_active', 'tracks_stock')
    search_fields = ('name', 'barcode', 'sku')
    raw_id_fields = ('category',)


@admin.register(UserAccess)
class UserAccessAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'business', 'is_primary', 'is_active')
    list_filter = ('role', 'is_active')
    filter_horizontal = ('branches',)
    search_fields = ('user__username',)


admin.site.register(Company)
admin.site.register(BusinessType)
admin.site.register(Branch)
admin.site.register(ClientProfile)
admin.site.register(RoomTable)
admin.site.register(UserProfile)
admin.site.register(Category)
admin.site.register(BusinessItem)
admin.site.register(InventoryLevel)


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    """The stock ledger is append-only: rows are written by api/sales/services.py only."""

    list_display = ('created_at', 'branch', 'item', 'quantity_delta', 'reason',
                    'reference', 'balance_after', 'created_by')
    list_filter = ('reason', 'branch')
    search_fields = ('reference', 'item__name', 'branch__name')
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(Transaction)
admin.site.register(Expense)