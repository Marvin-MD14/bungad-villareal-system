# backend/api/serializers.py

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    VSSService, VRealProduct, BBProduct, PangananMenu, KBItem, AutoSpaService,
    Branch, Product, BranchInventory, ClientProfile, RoomTable,
    Transaction, TransactionItem, DailySales, UserProfile,
    Attendance, CustomerFeedback, Expense, AuditLog,
    CustomerReward, RewardClaim,
)


# ============================================================
# USER PROFILE SERIALIZER
# ============================================================

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


# ============================================================
# BRANCH SERIALIZER
# ============================================================

class BranchSerializer(serializers.ModelSerializer):
    total_staff = serializers.SerializerMethodField(read_only=True)
    total_rooms = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Branch
        fields = [
            'id', 'name', 'branch_type', 'address', 'contact_number', 'email',
            'is_active', 'created_at', 'updated_at', 'total_staff', 'total_rooms',
        ]

    def get_total_staff(self, obj):
        return obj.user_profiles.filter(user__is_active=True).count()

    def get_total_rooms(self, obj):
        return obj.rooms.count()


# ============================================================
# PRODUCT SERIALIZER
# ============================================================

class ProductSerializer(serializers.ModelSerializer):
    stock_quantity = serializers.IntegerField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'category', 'barcode', 'purchase_price', 'selling_price',
            'min_stock', 'is_active', 'created_at', 'updated_at',
            'stock_quantity', 'is_low_stock',
        ]


# ============================================================
# BRANCH INVENTORY SERIALIZER
# ============================================================

class BranchInventorySerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    is_low_stock = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BranchInventory
        fields = [
            'id', 'branch', 'product', 'stock_qty', 'last_updated',
            'branch_name', 'product_name', 'is_low_stock',
        ]

    def get_is_low_stock(self, obj):
        return obj.stock_qty <= obj.product.min_stock


# ============================================================
# CLIENT PROFILE SERIALIZER (with Loyalty & Tier Info)
# ============================================================

class ClientProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    total_transactions = serializers.SerializerMethodField(read_only=True)
    discount_rate = serializers.SerializerMethodField(read_only=True)
    next_tier_info = serializers.SerializerMethodField(read_only=True)
    available_rewards_count = serializers.SerializerMethodField(read_only=True)
    tier_display = serializers.CharField(source='get_loyalty_tier_display', read_only=True)

    class Meta:
        model = ClientProfile
        fields = [
            'id', 'first_name', 'last_name', 'age', 'gender', 'address',
            'phone_number', 'email', 'birth_date',
            'loyalty_points', 'total_spent', 'loyalty_tier', 'free_items_available',
            'created_at', 'updated_at',
            'full_name', 'tier_display', 'discount_rate', 'next_tier_info',
            'total_transactions', 'available_rewards_count',
        ]
        # Loyalty values are owned by checkout: never writable through the API.
        read_only_fields = [
            'loyalty_points', 'total_spent', 'loyalty_tier', 'free_items_available',
            'created_at', 'updated_at',
        ]

    def get_total_transactions(self, obj):
        return obj.transaction_set.count() if hasattr(obj, 'transaction_set') else 0

    def get_discount_rate(self, obj):
        return obj.get_discount_rate()

    def get_next_tier_info(self, obj):
        return obj.get_next_tier_info()

    def get_available_rewards_count(self, obj):
        return obj.rewards.filter(status='AVAILABLE').count()


# ============================================================
# CUSTOMER REWARD SERIALIZER
# ============================================================

class CustomerRewardSerializer(serializers.ModelSerializer):
    reward_type_display = serializers.CharField(source='get_reward_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)

    class Meta:
        model = CustomerReward
        fields = [
            'id', 'customer', 'reward_type', 'status', 'title', 'description',
            'value', 'discount_percent', 'earned_at', 'claimed_at', 'expires_at',
            'transaction', 'claimed_in_transaction',
            'reward_type_display', 'status_display', 'customer_name',
        ]


# ============================================================
# REWARD CLAIM SERIALIZER
# ============================================================

class RewardClaimSerializer(serializers.ModelSerializer):
    reward_title = serializers.CharField(source='reward.title', read_only=True)
    customer_name = serializers.CharField(source='reward.customer.full_name', read_only=True)
    claimed_by_name = serializers.CharField(source='claimed_by.username', read_only=True)

    class Meta:
        model = RewardClaim
        fields = [
            'id', 'reward', 'transaction', 'claimed_by', 'amount_applied',
            'claimed_at', 'notes',
            'reward_title', 'customer_name', 'claimed_by_name',
        ]


# ============================================================
# ROOM TABLE SERIALIZER
# ============================================================

class RoomTableSerializer(serializers.ModelSerializer):
    time_remaining = serializers.IntegerField(read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    assigned_staff_name = serializers.CharField(source='assigned_staff.username', read_only=True)

    class Meta:
        model = RoomTable
        fields = [
            'id', 'branch', 'name', 'room_type', 'is_occupied', 'start_time',
            'duration_minutes', 'assigned_staff', 'customer_name', 'service_type',
            'created_at', 'updated_at',
            'time_remaining', 'branch_name', 'assigned_staff_name',
        ]


# ============================================================
# VSS SERVICE SERIALIZER
# ============================================================

class VSSServiceSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = VSSService
        fields = [
            'id', 'category', 'description', 'price', 'is_active',
            'created_at', 'updated_at', 'category_display',
        ]


# ============================================================
# VREAL PRODUCT SERIALIZER
# ============================================================

class VRealProductSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = VRealProduct
        fields = [
            'id', 'category', 'product', 'price', 'size',
            'is_active', 'created_at', 'updated_at',
            'category_display',
        ]


# ============================================================
# BB PRODUCT SERIALIZER
# ============================================================

class BBProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = BBProduct
        fields = [
            'id', 'product_name', 'price', 'category',
            'is_active', 'created_at', 'updated_at',
        ]


# ============================================================
# PANGANAN MENU SERIALIZER
# ============================================================

class PangananMenuSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = PangananMenu
        fields = [
            'id', 'category', 'menu', 'price', 'is_active',
            'created_at', 'updated_at', 'category_display',
        ]


# ============================================================
# KB ITEM SERIALIZER
# ============================================================

class KBItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = KBItem
        fields = [
            'id', 'name', 'price', 'is_active',
            'created_at', 'updated_at',
        ]


# ============================================================
# AUTO SPA SERVICE SERIALIZER
# ============================================================

class AutoSpaServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutoSpaService
        fields = [
            'id', 'service', 'price', 'is_active',
            'created_at', 'updated_at',
        ]


# ============================================================
# TRANSACTION ITEM SERIALIZER
# ============================================================

class TransactionItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    service_name = serializers.CharField(source='service.description', read_only=True)

    class Meta:
        model = TransactionItem
        fields = [
            'id', 'transaction', 'item_type', 'catalog_source',
            'product', 'service', 'description', 'price',
            'quantity', 'discount', 'total',
            'product_name', 'service_name',
        ]


# ============================================================
# TRANSACTION SERIALIZER
# ============================================================

class TransactionSerializer(serializers.ModelSerializer):
    items = TransactionItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    staff_name = serializers.CharField(source='staff.username', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    rewards_applied_details = CustomerRewardSerializer(source='rewards_applied', many=True, read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'transaction_number', 'branch', 'customer', 'staff',
            'transaction_type', 'subtotal', 'discount', 'total',
            'amount_paid', 'change', 'status', 'notes',
            'customer_tier_at_purchase', 'tier_discount_applied',
            'points_earned', 'rewards_applied', 'created_at', 'updated_at',
            'items', 'customer_name', 'staff_name', 'branch_name',
            'rewards_applied_details',
        ]
        read_only_fields = [
            'transaction_number', 'created_at', 'updated_at',
            'points_earned',
        ]


# ============================================================
# DAILY SALES SERIALIZER
# ============================================================

class DailySalesSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = DailySales
        fields = [
            'id', 'branch', 'date', 'total_sales', 'total_expenses',
            'total_void', 'transaction_count', 'created_at', 'updated_at',
            'branch_name',
        ]


# ============================================================
# ATTENDANCE SERIALIZER
# ============================================================

class AttendanceSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.SerializerMethodField(read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    hours_worked = serializers.FloatField(read_only=True)

    class Meta:
        model = Attendance
        fields = [
            'id', 'user', 'branch', 'date', 'time_in', 'time_out',
            'status', 'notes', 'created_at',
            'user_name', 'full_name', 'branch_name', 'hours_worked',
        ]

    def get_full_name(self, obj):
        full = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full or obj.user.username


# ============================================================
# CUSTOMER FEEDBACK SERIALIZER
# ============================================================

class CustomerFeedbackSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    staff_name = serializers.CharField(source='staff.username', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = CustomerFeedback
        fields = [
            'id', 'customer', 'transaction', 'branch', 'staff',
            'rating', 'comment', 'created_at',
            'customer_name', 'staff_name', 'branch_name',
        ]


# ============================================================
# EXPENSE SERIALIZER
# ============================================================

class ExpenseSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Expense
        fields = [
            'id', 'branch', 'category', 'description', 'amount',
            'expense_date', 'receipt', 'recorded_by', 'created_at',
            'branch_name', 'recorded_by_name', 'category_display',
        ]
        read_only_fields = ['recorded_by']


# ============================================================
# AUDIT LOG SERIALIZER
# ============================================================

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'branch', 'action', 'model_name', 'object_id',
            'description', 'ip_address', 'created_at',
            'user_name', 'branch_name',
        ]