from django.contrib import admin

from .models import (
    AuditLog, Attendance, Branch, ClientProfile, DailySales, Expense, RoomTable,
    Transaction, UserProfile,
)
from .company.models import Company
from .business.models import Business, BusinessType
from .access.models import DeviceToken, UserAccess
from .catalog.models import Category, Item, BusinessItem, InventoryLevel, StockMovement


class ScopedModelAdmin(admin.ModelAdmin):
    """Admin for a business-owned model: always read through ``all_objects``.

    The API scopes every read with ``BusinessScopedManager``, which fails closed
    inside a request — the Django admin is the *company operator's* console, so
    it must show every business (grouped with ``list_filter`` instead of hidden).
    """

    def get_queryset(self, request):
        return self.model.all_objects.get_queryset()


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'business_type', 'is_active')
    list_filter = ('business_type', 'is_active')
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name', 'slug')


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    """Singleton: the only row is pk=1 and it can never be added twice."""

    list_display = ('display_name', 'default_currency', 'default_tax_rate', 'updated_at')

    def has_add_permission(self, request):
        return not Company.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


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


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    """See and cut off individual device sessions (§7.9).

    Registering this is what makes "sign this till out" a support action
    instead of a database edit — and it is the only place an admin can find
    out *which* device holds a credential for a user.
    """

    list_display = ('user', 'device_name', 'created_at', 'last_used_at', 'expires_at', 'state')
    list_filter = ('created_at', 'expires_at')
    search_fields = ('user__username', 'device_name', 'user_agent')
    readonly_fields = ('key', 'password_fingerprint', 'created_at', 'last_used_at')

    @admin.display(description='state', boolean=False)
    def state(self, obj):
        if obj.is_revoked:
            return 'revoked'
        if obj.is_expired:
            return 'expired'
        return 'stale' if obj.is_stale else 'active'

    def has_add_permission(self, request):
        # Tokens are only ever minted by /api/auth/login/ so that they inherit
        # the password fingerprint; hand-creating one here would mint a
        # credential that immediately reads as stale.
        return False


admin.site.register(BusinessType)
admin.site.register(Category)


@admin.register(Branch)
class BranchAdmin(ScopedModelAdmin):
    list_display = ('name', 'code', 'business', 'opens_at', 'closes_at', 'is_active')
    list_filter = ('business', 'is_active')
    search_fields = ('name', 'code')


@admin.register(RoomTable)
class RoomTableAdmin(ScopedModelAdmin):
    list_display = ('name', 'branch', 'room_type', 'is_occupied', 'service_type', 'item')
    list_filter = ('business', 'room_type', 'is_occupied')
    search_fields = ('name', 'branch__name')


@admin.register(BusinessItem)
class BusinessItemAdmin(ScopedModelAdmin):
    list_display = ('item', 'business', 'effective_price', 'is_available', 'sort_order')
    list_filter = ('business', 'is_available')
    search_fields = ('item__name',)


@admin.register(InventoryLevel)
class InventoryLevelAdmin(admin.ModelAdmin):
    list_display = ('item', 'branch', 'stock_qty', 'reorder_point', 'updated_at')
    list_filter = ('branch',)
    search_fields = ('item__name', 'branch__name')


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


admin.site.register(ClientProfile)


@admin.register(Transaction)
class TransactionAdmin(ScopedModelAdmin):
    list_display = ('transaction_number', 'business', 'branch', 'total', 'status',
                    'transaction_type', 'created_at')
    list_filter = ('business', 'status', 'transaction_type')
    search_fields = ('transaction_number',)
    date_hierarchy = 'created_at'
    readonly_fields = ('transaction_number', 'created_at', 'updated_at')

    def has_add_permission(self, request):
        return False  # sales go through /api/transactions/checkout/

    def has_delete_permission(self, request, obj=None):
        return False  # §7.5: void a sale, never delete it


@admin.register(Expense)
class ExpenseAdmin(ScopedModelAdmin):
    list_display = ('description', 'amount', 'category', 'branch', 'business', 'expense_date')
    list_filter = ('business', 'category')
    search_fields = ('description',)


@admin.register(AuditLog)
class AuditLogAdmin(ScopedModelAdmin):
    list_display = ('created_at', 'user', 'business', 'action', 'model_name', 'request_id')
    list_filter = ('business', 'action')
    search_fields = ('description', 'object_id', 'request_id')
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DailySales)
class DailySalesAdmin(ScopedModelAdmin):
    list_display = ('date', 'branch', 'business', 'total_sales', 'total_void', 'transaction_count')
    list_filter = ('business',)
    date_hierarchy = 'date'


@admin.register(Attendance)
class AttendanceAdmin(ScopedModelAdmin):
    list_display = ('user', 'branch', 'date', 'status', 'time_in', 'time_out')
    list_filter = ('business', 'status')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'phone_number', 'created_at')
    search_fields = ('user__username', 'user__email')

    def role(self, obj):
        """Read-only view of the grants that replaced ``UserProfile.role`` (§4.4)."""
        return obj.role