# backend/api/catalog/views.py

from rest_framework import status, viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from api.catalog.models import Category, Item, BusinessItem, InventoryLevel, StockMovement
from api.catalog.serializers import (
    CategorySerializer, ItemSerializer, BusinessItemSerializer,
    InventoryLevelSerializer, StockMovementSerializer
)
from api.permissions import RoleBasedPermission
from api.access.scoping import ScopedQuerysetMixin
from api.sales.services import receive_stock


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [RoleBasedPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['sort_order', 'name']


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related('category').all()
    serializer_class = ItemSerializer
    permission_classes = [RoleBasedPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'barcode', 'sku', 'description']
    ordering_fields = ['name', 'selling_price', 'created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        item_type = self.request.query_params.get('item_type')
        if item_type:
            qs = qs.filter(item_type=item_type.upper())
        category_id = self.request.query_params.get('category')
        if category_id:
            qs = qs.filter(category_id=category_id)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))
        return qs


class BusinessItemViewSet(ScopedQuerysetMixin, viewsets.ModelViewSet):
    """Which items the active business sells (per-business price overrides)."""

    queryset = BusinessItem.objects.select_related('item', 'business').all()
    serializer_class = BusinessItemSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        qs = super().get_queryset().order_by('business__name', 'sort_order', 'item__name')
        business_id = self.request.query_params.get('business')
        if business_id:
            qs = qs.filter(business_id=business_id)
        elif getattr(self.request, 'business', None):
            qs = qs.filter(business=self.request.business)
        return qs


class InventoryLevelViewSet(ScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Stock per branch. Writes go through the ledgered ``restock`` action."""

    queryset = InventoryLevel.objects.select_related('branch', 'item').all()
    serializer_class = InventoryLevelSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        branch_id = self.request.query_params.get('branch')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    @action(detail=True, methods=['post'])
    def restock(self, request, pk=None):
        """Receive stock — atomic, writes an opening ``StockMovement``."""
        level = self.get_object()
        try:
            quantity = int(request.data.get('quantity', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'Quantity must be a whole number.'}, status=status.HTTP_400_BAD_REQUEST)
        if quantity <= 0:
            return Response({'detail': 'Quantity must be positive.'}, status=status.HTTP_400_BAD_REQUEST)
        receive_stock(
            branch=level.branch,
            item=level.item,
            quantity=quantity,
            reference=str(request.data.get('reference', '')),
            user=request.user,
        )
        level.refresh_from_db()
        return Response(self.get_serializer(level).data, status=status.HTTP_200_OK)


class StockMovementViewSet(ScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.select_related('branch', 'item', 'created_by').all()
    serializer_class = StockMovementSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        branch_id = self.request.query_params.get('branch')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

