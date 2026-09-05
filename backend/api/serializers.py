# backend/api/serializers.py

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    VSSService, VRealProduct, BBProduct, PangananMenu, KBItem, AutoSpaService,
    Branch, Product, BranchInventory, ClientProfile, RoomTable,
    Transaction, TransactionItem, DailySales, UserProfile
)


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    password = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(source='user.first_name', required=False)
    last_name = serializers.CharField(source='user.last_name', required=False)
    email = serializers.EmailField(source='user.email', required=False)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    service_names = serializers.StringRelatedField(source='services', many=True, read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id', 'user', 'username', 'password', 'first_name', 'last_name', 'email',
            'role', 'role_display', 'branch', 'branch_name', 'services', 'service_names',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']

    def validate(self, attrs):
        role = attrs.get('role', self.instance.role if self.instance else None)
        branch = attrs.get('branch', self.instance.branch if self.instance else None)
        if role in {'BRANCH_ADMIN', 'CASHIER', 'STAFF'} and branch is None:
            raise serializers.ValidationError({
                'branch': 'Branch Admin, Cashier, and Staff accounts must be assigned to a branch.'
            })
        if role in {'OWNER', 'SUPERADMIN'} and branch is not None:
            raise serializers.ValidationError({
                'branch': 'Superadmin and Owner accounts are organization-wide and cannot be assigned to a branch.'
            })
        return attrs

    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        password = validated_data.pop('password', None)
        username = self.initial_data.get('username')
        if not username or not password:
            raise serializers.ValidationError({'username': 'Username and password are required.'})
        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError({'username': 'That username is already in use.'})

        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=user_data.get('first_name', self.initial_data.get('first_name', '')),
            last_name=user_data.get('last_name', self.initial_data.get('last_name', '')),
            email=user_data.get('email', self.initial_data.get('email', '')),
        )
        services = validated_data.pop('services', [])
        profile = UserProfile.objects.create(user=user, **validated_data)
        profile.services.set(services)
        return profile

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        password = validated_data.pop('password', None)
        services = validated_data.pop('services', None)
        user = instance.user
        for field in ('first_name', 'last_name', 'email'):
            if field in user_data:
                setattr(user, field, user_data[field])
        if password:
            user.set_password(password)
        user.save()
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if services is not None:
            instance.services.set(services)
        return instance

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