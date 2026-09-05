# backend/api/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()

# Product Management
router.register(r'vss-services', VSSServiceViewSet)
router.register(r'vreal-products', VRealProductViewSet)
router.register(r'bb-products', BBProductViewSet)
router.register(r'panganan-menus', PangananMenuViewSet)
router.register(r'kb-items', KBItemViewSet)
router.register(r'auto-spa', AutoSpaServiceViewSet)
router.register(r'user-profiles', UserProfileViewSet)

# Inventory Management
router.register(r'branches', BranchViewSet)
router.register(r'products', ProductViewSet)
router.register(r'branch-inventory', BranchInventoryViewSet)

# Client Management
router.register(r'clients', ClientProfileViewSet)

# Room Management
router.register(r'rooms', RoomTableViewSet)

# Transaction Management
router.register(r'transactions', TransactionViewSet)

# Dashboard Stats
router.register(r'dashboard', DashboardStatsViewSet, basename='dashboard')

urlpatterns = [
    path('auth/login/', login_view, name='auth-login'),
    path('', include(router.urls)),
]