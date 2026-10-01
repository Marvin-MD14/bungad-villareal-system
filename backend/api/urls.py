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
    login_view, logout_view, rotate_token_view, capabilities_view,
    # ViewSets
    UserProfileViewSet,
    BranchViewSet,
    ClientProfileViewSet,
    RoomTableViewSet,
    TransactionViewSet,
    DashboardStatsViewSet,
    AttendanceViewSet,
    CustomerFeedbackViewSet,
    ExpenseViewSet,
    AuditLogViewSet,
    BranchCatalogViewSet,
    CompanyViewSet,
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
from api.payments.views import (  # noqa: E402
    CashierShiftViewSet, PaymentMethodViewSet, PaymentViewSet,
)
from api.loyalty.views import (  # noqa: E402
    LoyaltyProgramViewSet, LoyaltyTransactionViewSet,
)

router = DefaultRouter()

# ============================================================
# PRODUCT MANAGEMENT
# ------------------------------------------------------------
# The seven per-catalog routes (vss-services, vreal-products, bb-products,
# panganan-menus, kb-items, auto-spa) and /products/, /branch-inventory/ were
# retired in Phase 5: everything they exposed now lives under /catalog/*.
# ============================================================
router.register(r'user-profiles', UserProfileViewSet)

# ============================================================
# INVENTORY MANAGEMENT
# ============================================================
router.register(r'branches', BranchViewSet)

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

# Company singleton settings (§4.1): receipt footer / tax default / branding.
router.register(r'company', CompanyViewSet, basename='company')

# ============================================================
# CUSTOMER LOYALTY & REWARDS
# ============================================================
router.register(r'customer-rewards', CustomerRewardViewSet)
router.register(r'reward-claims', RewardClaimViewSet)
router.register(r'customer-tier', CustomerTierViewSet, basename='customer-tier')

# ============================================================
# PAYMENTS & CASHIER SHIFTS (priority modules)
# ============================================================
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-methods')
router.register(r'payments', PaymentViewSet, basename='payments')
router.register(r'cashier-shifts', CashierShiftViewSet, basename='cashier-shifts')

# ============================================================
# LOYALTY PROGRAM CONFIG + POINTS LEDGER
# ============================================================
router.register(r'loyalty-programs', LoyaltyProgramViewSet, basename='loyalty-programs')
router.register(r'loyalty-ledger', LoyaltyTransactionViewSet, basename='loyalty-ledger')

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
    path('auth/rotate-token/', rotate_token_view, name='auth-rotate-token'),
    path('auth/capabilities/', capabilities_view, name='auth-capabilities'),

    # Router URLs
    path('', include(router.urls)),
]