# backend/api/catalog/views.py

from rest_framework import status, viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Prefetch, Q
from api.catalog.models import Category, Item, BusinessItem, InventoryLevel, StockMovement
from api.catalog.serializers import (
    CategorySerializer, ItemSerializer, BusinessItemSerializer,
    InventoryLevelSerializer, StockMovementSerializer,
    AvailabilityMatrixSerializer
)
from rest_framework.exceptions import ValidationError as DRFValidationError
from api.permissions import RoleBasedPermission
from api.access.scoping import ScopedQuerysetMixin, auto_scope
from api.models import Branch
from api.sales.services import receive_stock, transfer_stock


class CategoryViewSet(ScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [RoleBasedPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['sort_order', 'name']


class ItemViewSet(ScopedQuerysetMixin, viewsets.ModelViewSet):
    """The unified catalog.

    Items are company-level master data (§3.2), but a *business* must only see
    the items it actually sells, so the queryset is narrowed to the active
    business's ``BusinessItem`` links — automatically, via ``auto_scope`` on the
    ``business`` column of ``BusinessItem``.
    """

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
        # A company-wide grant keeps the whole catalog; every other grant only
        # sees items its business has linked (or, with `?all=1`, an explicit
        # cross-business view used by the seed screens).
        business = getattr(self.request, 'business', None)
        include_all = self.request.query_params.get('all') in ('1', 'true', 'yes')
        if business is not None and not include_all:
            qs = qs.filter(business_entries__business=business)
        return qs.distinct()


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

    @action(detail=False, methods=['post'])
    def batch(self, request):
        """Create or update multiple BusinessItem records in bulk.

        Request body:
        {
            "business_id": number,
            "items": [
                {"item_id": number, "is_available": boolean, "price_override": number|null}
            ]
        }

        Response:
        {
            "created": number,
            "updated": number,
            "business_items": [BusinessItem...]
        }
        """
        from api.catalog.serializers import BusinessItemBatchSerializer
        from api.business.models import Business

        serializer = BusinessItemBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        business_id = serializer.validated_data['business_id']
        items_data = serializer.validated_data['items']

        # Validate business exists
        try:
            business = Business.objects.get(pk=business_id)
        except Business.DoesNotExist:
            return Response(
                {'detail': f'Business with id {business_id} does not exist.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_count = 0
        updated_count = 0
        business_items = []

        for item_data in items_data:
            item_id = item_data['item_id']
            is_available = item_data['is_available']
            price_override = item_data.get('price_override')

            # Try to get existing BusinessItem (upsert logic)
            business_item, was_created = BusinessItem.objects.update_or_create(
                business_id=business_id,
                item_id=item_id,
                defaults={
                    'is_available': is_available,
                    'price_override': price_override
                }
            )

            if was_created:
                created_count += 1
            else:
                updated_count += 1

            business_items.append(business_item)

        # Serialize the results
        result_serializer = BusinessItemSerializer(business_items, many=True)
        return Response(
            {
                'created': created_count,
                'updated': updated_count,
                'business_items': result_serializer.data
            },
            status=status.HTTP_201_CREATED
        )


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

    @action(detail=True, methods=['post'])
    def transfer(self, request, pk=None):
        """Send stock from this level's branch to another branch of the same business.

        Writes a matching ``TRANSFER_OUT`` / ``TRANSFER_IN`` pair, so the ledger
        always balances; the destination must be a branch the caller can see.
        """
        level = self.get_object()
        try:
            quantity = int(request.data.get('quantity', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'Quantity must be a whole number.'}, status=status.HTTP_400_BAD_REQUEST)
        if quantity <= 0:
            return Response({'detail': 'Quantity must be positive.'}, status=status.HTTP_400_BAD_REQUEST)

        to_branch_id = request.data.get('to_branch')
        if not to_branch_id:
            return Response({'detail': 'to_branch is required.'}, status=status.HTTP_400_BAD_REQUEST)
        # auto_scope keeps a business-scoped caller inside their own business and
        # a branch-restricted grant inside its allowed branches.
        to_branch = auto_scope(
            Branch.objects.filter(is_active=True), request, branch_lookup='pk'
        ).filter(pk=to_branch_id).first()
        if to_branch is None:
            return Response({'detail': 'Destination branch does not exist or is not accessible.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            destination = transfer_stock(
                from_branch=level.branch,
                to_branch=to_branch,
                item=level.item,
                quantity=quantity,
                reference=str(request.data.get('reference', '')),
                user=request.user,
            )
        except DRFValidationError as exc:
            return Response({'detail': str(exc.detail)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(destination).data, status=status.HTTP_200_OK)


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


class AvailabilityMatrixViewSet(viewsets.ViewSet):
    """Availability matrix view showing items against businesses.

    Returns a matrix where:
    - Rows are catalog items
    - Columns are accessible businesses
    - Cells show availability status and effective pricing

    Query params:
        - category: Filter items by category ID
        - search: Search items by name or SKU
        - business: Filter to show availability for a specific business only
    """
    permission_classes = [RoleBasedPermission]

    def list(self, request):
        from api.access.context import ensure_business_context
        from api.business.models import Business
        from api.access.models import UserAccess

        ensure_business_context(request)

        # Get query parameters
        category_id = request.query_params.get('category')
        search_term = request.query_params.get('search', '').strip()
        business_filter = request.query_params.get('business')

        # Determine accessible businesses for the user
        user = request.user
        if getattr(user, 'is_superuser', False):
            # Superuser sees all active businesses
            businesses = Business.objects.filter(is_active=True).order_by('name')
        elif getattr(request, 'company_wide', False):
            # Company-wide roles see all active businesses
            businesses = Business.objects.filter(is_active=True).order_by('name')
        else:
            # Business-scoped users see only their assigned business
            active_business = getattr(request, 'business', None)
            if active_business is None:
                return Response({'items': [], 'businesses': []})
            businesses = Business.objects.filter(pk=active_business.pk, is_active=True)

        # Apply specific business filter if provided and accessible
        if business_filter:
            businesses = businesses.filter(pk=business_filter)

        business_ids = list(businesses.values_list('pk', flat=True))

        if not business_ids:
            return Response({'items': [], 'businesses': []})

        # Build items queryset with optimization
        items_qs = Item.objects.filter(is_active=True).select_related('category')

        # Apply filters
        if category_id:
            items_qs = items_qs.filter(category_id=category_id)

        if search_term:
            items_qs = items_qs.filter(
                Q(name__icontains=search_term) | Q(sku__icontains=search_term)
            )

        # Order by name for consistent display
        items_qs = items_qs.order_by('name')

        # Prefetch BusinessItems for all relevant businesses in one query
        business_items = BusinessItem.objects.filter(
            business_id__in=business_ids
        ).select_related('business')

        # Build a lookup: (item_id, business_id) -> BusinessItem
        bi_lookup = {}
        for bi in business_items:
            bi_lookup[(bi.item_id, bi.business_id)] = bi

        # Get all item IDs we need to check
        item_ids = list(items_qs.values_list('pk', flat=True))

        # Build the response structure
        items_data = []
        for item in items_qs:
            business_availability = []
            for business in businesses:
                bi = bi_lookup.get((item.pk, business.pk))
                if bi:
                    effective_price = bi.price_override if bi.price_override is not None else item.selling_price
                    business_availability.append({
                        'business_id': business.pk,
                        'business_name': business.name,
                        'is_available': bi.is_available,
                        'effective_price': effective_price,
                        'price_override': bi.price_override,
                        'business_item_id': bi.pk,
                    })
                else:
                    # No BusinessItem exists - item not available for this business
                    business_availability.append({
                        'business_id': business.pk,
                        'business_name': business.name,
                        'is_available': False,
                        'effective_price': item.selling_price,
                        'price_override': None,
                        'business_item_id': None,
                    })

            items_data.append({
                'id': item.pk,
                'name': item.name,
                'sku': item.sku or '',
                'item_type': item.item_type,
                'category_id': item.category_id,
                'category_name': item.category.name if item.category else '',
                'selling_price': item.selling_price,
                'business_availability': business_availability,
            })

        businesses_data = [
            {'id': b.pk, 'name': b.name, 'slug': b.slug}
            for b in businesses
        ]

        serializer = AvailabilityMatrixSerializer({
            'items': items_data,
            'businesses': businesses_data,
        })
        return Response(serializer.data)

