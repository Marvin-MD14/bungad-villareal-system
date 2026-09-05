# backend/api/serializers.py

from rest_framework import serializers
from .models import (
    VSSService, VRealProduct, BBProduct, PangananMenu, KBItem, AutoSpaService,
    Branch, Product, BranchInventory, ClientProfile, RoomTable,
    Transaction, TransactionItem, DailySales
)

class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    stock_quantity = serializers.IntegerField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Product
        fields = '__all__'


class BranchInventorySerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = BranchInventory
        fields = '__all__'


class ClientProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = ClientProfile
        fields = '__all__'


class RoomTableSerializer(serializers.ModelSerializer):
    time_remaining = serializers.IntegerField(read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    assigned_staff_name = serializers.CharField(source='assigned_staff.username', read_only=True)
    
    class Meta:
        model = RoomTable
        fields = '__all__'


# ============ VSS SERVICES SERIALIZER ============
class VSSServiceSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    class Meta:
        model = VSSService
        fields = '__all__'


# ============ VREAL PRODUCTS SERIALIZER ============
class VRealProductSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    class Meta:
        model = VRealProduct
        fields = '__all__'


class BBProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = BBProduct
        fields = '__all__'


class PangananMenuSerializer(serializers.ModelSerializer):
    class Meta:
        model = PangananMenu
        fields = '__all__'


class KBItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = KBItem
        fields = '__all__'


class AutoSpaServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutoSpaService
        fields = '__all__'


class TransactionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionItem
        fields = '__all__'


class TransactionSerializer(serializers.ModelSerializer):
    items = TransactionItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    staff_name = serializers.CharField(source='staff.username', read_only=True)
    
    class Meta:
        model = Transaction
        fields = '__all__'


class DailySalesSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailySales
        fields = '__all__'