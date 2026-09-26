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

router = DefaultRouter()

# ============================================================
# PRODUCT MANAGEMENT
# ============================================================
router.register(r'vss-services', VSSServiceViewSet)
router.register(r'vreal-products', VRealProductViewSet)
router.register(r'bb-products', BBProductViewSet)
router.register(r'panganan-menus', PangananMenuViewSet)
router.register(r'kb-items', KBItemViewSet)
router.register(r'auto-spa', AutoSpaServiceViewSet)
router.register(r'user-profiles', UserProfileViewSet)

# ============================================================
# INVENTORY MANAGEMENT
# ============================================================
router.register(r'branches', BranchViewSet)
router.register(r'products', ProductViewSet)
router.register(r'branch-inventory', BranchInventoryViewSet)

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