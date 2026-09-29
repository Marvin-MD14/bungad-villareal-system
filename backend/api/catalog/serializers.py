# backend/api/catalog/serializers.py

from rest_framework import serializers
from api.catalog.models import Category, Item, BusinessItem, InventoryLevel, StockMovement


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'kind', 'parent', 'sort_order', 'is_active']


class ItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = Item
        fields = [
            'id', 'item_type', 'category', 'category_name', 'name', 'sku', 'barcode',
            'description', 'cost_price', 'selling_price', 'is_taxable',
            'tracks_stock', 'min_stock', 'unit', 'duration', 'duration_unit',
            'requires_staff', 'requires_room', 'attributes', 'image', 'is_active',
            'created_at', 'updated_at'
        ]


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
