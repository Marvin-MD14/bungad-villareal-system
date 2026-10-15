# backend/api/catalog/serializers.py

from rest_framework import serializers
from api.catalog.models import Category, Item, BusinessItem, InventoryLevel, StockMovement


class BusinessAvailabilitySerializer(serializers.Serializer):
    """Availability and pricing for a single Item-Business pair in the matrix."""
    business_id = serializers.IntegerField()
    business_name = serializers.CharField()
    is_available = serializers.BooleanField()
    effective_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    price_override = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    business_item_id = serializers.IntegerField(allow_null=True)


class MatrixItemSerializer(serializers.Serializer):
    """An Item with its availability across all accessible businesses."""
    id = serializers.IntegerField()
    name = serializers.CharField()
    sku = serializers.CharField()
    item_type = serializers.CharField()
    category_id = serializers.IntegerField()
    category_name = serializers.CharField()
    selling_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    business_availability = BusinessAvailabilitySerializer(many=True)


class MatrixBusinessSerializer(serializers.Serializer):
    """A Business for the matrix column headers."""
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField()


class AvailabilityMatrixSerializer(serializers.Serializer):
    """Response format for the availability matrix endpoint."""
    items = MatrixItemSerializer(many=True)
    businesses = MatrixBusinessSerializer(many=True)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'kind', 'parent', 'sort_order', 'is_active']


class ItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    # §8.2: expose what the *active business* actually charges for this item —
    # the per-business price override of BusinessItem, else the catalog price.
    effective_price = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            'id', 'item_type', 'category', 'category_name', 'name', 'sku', 'barcode',
            'description', 'cost_price', 'selling_price', 'effective_price',
            'is_taxable',
            'tracks_stock', 'min_stock', 'unit', 'duration', 'duration_unit',
            'requires_staff', 'requires_room', 'attributes', 'image', 'is_active',
            'created_at', 'updated_at'
        ]

    def get_effective_price(self, obj):
        business = getattr(self.context.get('request'), 'business', None)
        if business is None:
            return obj.selling_price
        entry = obj.business_entries.filter(business=business).first()
        if entry is None:
            return obj.selling_price
        return entry.price_override if entry.price_override is not None else obj.selling_price


class BusinessItemSerializer(serializers.ModelSerializer):
    item = ItemSerializer(read_only=True)
    item_id = serializers.PrimaryKeyRelatedField(
        queryset=Item.objects.all(), source='item', write_only=True
    )
    effective_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = BusinessItem
        fields = [
            'id', 'business', 'item', 'item_id', 'price_override',
            'effective_price', 'is_available', 'sort_order'
        ]


class BusinessItemBatchItemSerializer(serializers.Serializer):
    """Serializer for a single item in the batch request."""
    item_id = serializers.IntegerField()
    is_available = serializers.BooleanField(default=True)
    price_override = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, default=None
    )


class BusinessItemBatchSerializer(serializers.Serializer):
    """Serializer for the batch create/update request."""
    business_id = serializers.IntegerField()
    items = BusinessItemBatchItemSerializer(many=True)


class InventoryLevelSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = InventoryLevel
        fields = ['id', 'branch', 'branch_name', 'item', 'item_name', 'stock_qty', 'reorder_point', 'updated_at']


class StockMovementSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            'id', 'branch', 'branch_name', 'item', 'item_name',
            'quantity_delta', 'reason', 'reference', 'balance_after',
            'created_by', 'created_at'
        ]
