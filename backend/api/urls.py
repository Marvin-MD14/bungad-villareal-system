# backend/api/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from .views import (
    # Auth
    login_view, logout_view,
    # ViewSets
    VSSServiceViewSet,
    VRealProductViewSet,
    BBProductViewSet,
    PangananMenuViewSet,
    KBItemViewSet,
    AutoSpaServiceViewSet,
    UserProfileViewSet,
    BranchViewSet,
    ProductViewSet,
    BranchInventoryViewSet,
    ClientProfileViewSet,
    RoomTableViewSet,
    TransactionViewSet,
    DashboardStatsViewSet,
    AttendanceViewSet,
    CustomerFeedbackViewSet,
    ExpenseViewSet,
    AuditLogViewSet,
    BranchCatalogViewSet,
    DailySalesViewSet,
    # Loyalty & Rewards
    CustomerRewardViewSet,
    RewardClaimViewSet,
    CustomerTierViewSet,
    CustomerDetectionViewSet,
    NotificationViewSet,
)
# Unified catalog, business, and access viewsets live in their own domain modules
from api.catalog.views import (  # noqa: E402
    ItemViewSet,
    CategoryViewSet,
    BusinessItemViewSet,
    InventoryLevelViewSet,
    StockMovementViewSet,
)
from api.business.views import BusinessViewSet, BusinessTypeViewSet  # noqa: E402
from api.access.views import UserAccessViewSet  # noqa: E402

router = DefaultRouter()

# ============================================================
# PRODUCT MANAGEMENT
# ============================================================
router.register(r'vss-services', VSSServiceViewSet, basename='vss-services')
router.register(r'vreal-products', VRealProductViewSet, basename='vreal-products')
router.register(r'bb-products', BBProductViewSet, basename='bb-products')
router.register(r'panganan-menus', PangananMenuViewSet, basename='panganan-menus')
router.register(r'kb-items', KBItemViewSet, basename='kb-items')
router.register(r'auto-spa', AutoSpaServiceViewSet, basename='auto-spa')
router.register(r'user-profiles', UserProfileViewSet)

# ============================================================
# INVENTORY MANAGEMENT
# ============================================================
router.register(r'branches', BranchViewSet)
router.register(r'products', ProductViewSet, basename='products')
router.register(r'branch-inventory', BranchInventoryViewSet, basename='branch-inventory')

# ============================================================
# CLIENT MANAGEMENT
# ============================================================
router.register(r'clients', ClientProfileViewSet)

# ============================================================
# ROOM MANAGEMENT
# ============================================================
router.register(r'rooms', RoomTableViewSet)

# ============================================================
# TRANSACTION MANAGEMENT
# ============================================================
router.register(r'transactions', TransactionViewSet)

# ============================================================
# SALES REPORTING (per-branch daily ledger, read-only)
# ============================================================
router.register(r'daily-sales', DailySalesViewSet)

# ============================================================
# ATTENDANCE MANAGEMENT
# ============================================================
router.register(r'attendance', AttendanceViewSet)

# ============================================================
# CUSTOMER FEEDBACK
# ============================================================
router.register(r'feedback', CustomerFeedbackViewSet)

# ============================================================
# EXPENSE MANAGEMENT
# ============================================================
router.register(r'expenses', ExpenseViewSet)

# ============================================================
# AUDIT LOGS
# ============================================================
router.register(r'audit-logs', AuditLogViewSet)

# ============================================================
# BRANCH CATALOG (Para sa POS)
# ============================================================
router.register(r'branch-catalog', BranchCatalogViewSet, basename='branch-catalog')

# ============================================================
# UNIFIED CATALOG (Phase 3) — replaces the 7 legacy catalogs
# ============================================================
router.register(r'catalog/items', ItemViewSet)
router.register(r'catalog/categories', CategoryViewSet)
router.register(r'catalog/business-items', BusinessItemViewSet, basename='business-items')
router.register(r'catalog/inventory', InventoryLevelViewSet, basename='inventory')
router.register(r'catalog/stock-movements', StockMovementViewSet, basename='stock-movements')

# ============================================================
# BUSINESSES & ACCESS (Phase 2)
# ============================================================
router.register(r'businesses', BusinessViewSet)
router.register(r'business-types', BusinessTypeViewSet)
router.register(r'user-access', UserAccessViewSet, basename='user-access')

# ============================================================
# CUSTOMER LOYALTY & REWARDS
# ============================================================
router.register(r'customer-rewards', CustomerRewardViewSet)
router.register(r'reward-claims', RewardClaimViewSet)
router.register(r'customer-tier', CustomerTierViewSet, basename='customer-tier')

# ============================================================
# CUSTOMER DETECTION & NOTIFICATIONS
# ============================================================
router.register(r'customer-detection', CustomerDetectionViewSet, basename='customer-detection')
router.register(r'notifications', NotificationViewSet, basename='notifications')

# ============================================================
# DASHBOARD STATS
# ============================================================
router.register(r'dashboard', DashboardStatsViewSet, basename='dashboard')

# ============================================================
# URL PATTERNS
# ============================================================
urlpatterns = [
    # OpenAPI Schema & Interactive Documentation
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Authentication
    path('auth/login/', login_view, name='auth-login'),
    path('auth/logout/', logout_view, name='auth-logout'),

    # Router URLs
    path('', include(router.urls)),
]