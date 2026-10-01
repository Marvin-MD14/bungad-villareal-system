
import re

from rest_framework import serializers
from django.contrib.auth.models import User
from django.db import transaction
from .models import (
    Branch, ClientProfile, RoomTable,
    Transaction, TransactionItem, DailySales, UserProfile,
    Attendance, CustomerFeedback, Expense, AuditLog,
    CustomerReward, RewardClaim,
)
from .catalog.models import Item, Category, InventoryLevel
from .business.models import Business
from .company.models import Company
from .payments.serializers import PaymentSerializer
from .access.models import staff_count_for_branch
from .access.scoping import assert_branch_in_active_business


class UserProfileSerializer(serializers.ModelSerializer):
    """Personal data plus a read-only summary of the account's access grants.

    §4.4 removed ``role``/``branch`` from this model; ``role`` and ``access``
    below are derived from ``UserAccess`` so the UI can keep showing them.  The
    grants themselves are managed through ``/api/user-access/``.
    """

    username = serializers.CharField(source='user.username', read_only=True)
    # The SPA's users table shows an Active/Deactivated state; take it from the
    # account rather than inventing it client-side.  Writable so the table's
    # activate/deactivate toggle can persist; it writes through to the user.
    is_active = serializers.BooleanField(source='user.is_active', required=False)
    # The profile's own pk is not the account id.  The rooms table assigns staff
    # via `assigned_staff`, a FK to User, so the SPA needs this to be able to
    # book a room without guessing which id that is.
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    password = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(source='user.first_name', required=False)
    last_name = serializers.CharField(source='user.last_name', required=False)
    email = serializers.EmailField(source='user.email', required=False)
    role = serializers.CharField(required=False, allow_blank=True)
    # Legacy write-only pair accepted from the SPA: it now becomes a UserAccess
    # grant (§4.4) instead of columns on this model.
    branch = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    access = serializers.SerializerMethodField(read_only=True)
    # Legacy payload name kept: `services` now maps to the unified-catalog
    # `skills` M2M (Item ids — the same ids /catalog/items/ returns).
    services = serializers.PrimaryKeyRelatedField(
        queryset=Item.objects.all(), many=True, required=False, source='skills'
    )
    service_names = serializers.StringRelatedField(source='skills', many=True, read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id', 'user', 'user_id', 'username', 'is_active', 'password', 'first_name', 'last_name', 'email',
            'phone_number', 'avatar', 'role', 'branch', 'access',
            'services', 'service_names', 'created_at', 'updated_at',
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']

    # Roles the retired profile columns used to carry, mapped onto grants.
    # SUPERADMIN stays SUPERADMIN: it is the platform operator, distinct from
    # OWNER since the split. Mapping it to OWNER would silently downgrade the
    # account and strip it of the platform actions it exists to perform.
    LEGACY_ROLES = {
        'SUPERADMIN': 'SUPERADMIN',
        'Superadmin': 'SUPERADMIN',
        'Owner': 'OWNER',
        'OWNER': 'OWNER',
        'BRANCH_ADMIN': 'BUSINESS_MANAGER',
        'Branch Admin': 'BUSINESS_MANAGER',
        'BUSINESS_MANAGER': 'BUSINESS_MANAGER',
        'Business Manager': 'BUSINESS_MANAGER',
        'SUPERVISOR': 'SUPERVISOR',
        'Supervisor': 'SUPERVISOR',
        'COMPANY_ADMIN': 'COMPANY_ADMIN',
        'Company Admin': 'COMPANY_ADMIN',
        'ACCOUNTANT': 'ACCOUNTANT',
        'Accountant': 'ACCOUNTANT',
        'CASHIER': 'CASHIER',
        'Cashier': 'CASHIER',
        'STAFF': 'STAFF',
        'Staff': 'STAFF',
    }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        grant = (
            instance.user.access_grants.filter(is_active=True)
            .select_related('business')
            .order_by('is_primary', 'id')
            .first()
        )
        branch_ids = grant.branch_ids() if grant else []
        first_branch = Branch.all_objects.filter(pk=branch_ids[0]).first() if branch_ids else None
        data['branch'] = first_branch.pk if first_branch else None
        data['branch_name'] = first_branch.name if first_branch else 'Organization-wide'
        data['role_display'] = (data.get('role') or 'STAFF').replace('_', ' ').title()
        return data

    def _apply_grant(self, user, role, branch_id):
        """Turn the SPA's legacy ``role`` + ``branch`` pair into a grant (§4.4)."""
        if not role:
            return None
        from .access.models import UserAccess

        code = self.LEGACY_ROLES.get(role, role)
        branch = Branch.all_objects.filter(pk=branch_id).first() if branch_id else None

        if code in UserAccess.COMPANY_ROLES:
            business = None
            branch = None  # company roles must not carry a business (check constraint)
        else:
            business = branch.business if branch is not None else Business.objects.first()
            if business is None:
                raise serializers.ValidationError({'branch': 'Create a business first.'})
            if branch is None:
                raise serializers.ValidationError(
                    {'branch': 'Cashier and Staff accounts must be assigned to a branch.'}
                )

        grant, _ = UserAccess.objects.get_or_create(
            user=user, role=code, business=business,
            defaults={'is_primary': not user.access_grants.exists(), 'is_active': True},
        )
        if branch is not None:
            grant.branches.add(branch)
        if not grant.is_active:
            grant.is_active = True
            grant.save()
        return grant

    def get_access(self, obj):
        """Which role, in which business, limited to which branches."""
        return [
            {
                'id': grant.id,
                'role': grant.role,
                'business': grant.business_id,
                'business_name': grant.business.name if grant.business_id else None,
                'branch_ids': grant.branch_ids(),
                'is_primary': grant.is_primary,
                'is_active': grant.is_active,
            }
            for grant in obj.user.access_grants.select_related('business').all()
        ]

    def _derive_username(self, initial):
        """Pick a free username for the SPA's "add user" form.

        The users table only collects a name/email, so the account is created
        with a derived login and a random password rather than being rejected
        for a field the form never asked for.
        """
        base = (initial.get('username') or '').strip()
        if not base:
            name = (initial.get('name') or '').strip()
            base = re.sub(r'[^a-zA-Z0-9]+', '.', name).strip('.').lower()
        if not base:
            email = (initial.get('email') or '').strip()
            base = re.sub(r'[^a-zA-Z0-9]+', '.', email.split('@')[0]).strip('.').lower()
        if not base:
            base = 'user'
        candidate, suffix = base, 1
        while User.objects.filter(username=candidate).exists():
            suffix += 1
            candidate = f'{base}{suffix}'
        return candidate

    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        password = validated_data.pop('password', None)
        initial = self.initial_data
        username = (initial.get('username') or '').strip() or self._derive_username(initial)
        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError({'username': 'That username is already in use.'})
        if not password:
            password = User.objects.make_random_password()

        # The SPA posts a single `name`; split it so the table keeps showing
        # first/last (and initials) the way the API returns them.
        name = (initial.get('name') or '').strip()
        first_name = user_data.get('first_name') or initial.get('first_name') or ''
        last_name = user_data.get('last_name') or initial.get('last_name') or ''
        if not first_name and name:
            parts = name.split()
            first_name = parts[0]
            last_name = ' '.join(parts[1:])
        if not last_name and name:
            last_name = name

        role = validated_data.pop('role', None)
        branch_id = validated_data.pop('branch', None)

        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
                email=user_data.get('email', initial.get('email', '')),
            )
            services = validated_data.pop('skills', [])
            profile = UserProfile.objects.create(user=user, **validated_data)
            profile.skills.set(services)
            # §4.4: the role/branch the SPA posted becomes an access grant, so a
            # rolled-back request never leaves a user without (or with wrong) access.
            self._apply_grant(user, role, branch_id)
        return profile

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        password = validated_data.pop('password', None)
        services = validated_data.pop('skills', None)
        role = validated_data.pop('role', None)
        branch_id = validated_data.pop('branch', None)
        user = instance.user
        for field in ('first_name', 'last_name', 'email', 'is_active'):
            if field in user_data:
                setattr(user, field, user_data[field])
        if password:
            user.set_password(password)
        user.save()
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if services is not None:
            instance.skills.set(services)
        if role:
            self._apply_grant(user, role, branch_id)
        return instance



class BranchSerializer(serializers.ModelSerializer):
    total_staff = serializers.SerializerMethodField(read_only=True)
    total_rooms = serializers.SerializerMethodField(read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    # Legacy POS label — derived from the business, never written.
    branch_type = serializers.ReadOnlyField()
    branch_type_display = serializers.ReadOnlyField(source='get_branch_type_display')

    class Meta:
        model = Branch
        fields = [
            'id', 'business', 'business_name', 'name', 'code', 'branch_type',
            'branch_type_display', 'address', 'contact_number', 'email',
            'opens_at', 'closes_at',
            'is_active', 'created_at', 'updated_at', 'total_staff', 'total_rooms',
        ]
        # `business` may be omitted and inferred from the active grant inside
        # `validate()`.  The model's unique_together would otherwise make DRF
        # auto-attach a UniqueTogetherValidator whose `enforce_required_fields`
        # demands `business` in the *input* — rejecting the very payloads the
        # inference is meant to accept.  Uniqueness is enforced by the explicit,
        # business-scoped name-clash check in `validate()` (and, as a backstop,
        # by the DB constraint); the auto-validator is dropped here.
        validators = []
        # A business-scoped user creates inside their own business, so the
        # field may be omitted and inferred from the active grant.
        extra_kwargs = {'business': {'required': False, 'allow_null': True}}

    def validate_business(self, value):
        if value is None:
            return value
        request = self.context.get('request')
        active = getattr(request, 'business', None)
        if active is not None and value.pk != active.pk:
            raise serializers.ValidationError(
                'Outlets can only be created inside the active business.')
        return value

    def validate(self, attrs):
        instance = self.instance
        business = attrs.get('business')

        if instance is not None:
            # A branch is a permanent home: moving it between businesses would
            # strand every sale, expense and staff row that already points at it.
            if business is not None and business.pk != instance.business_id:
                raise serializers.ValidationError(
                    {'business': 'A branch cannot be moved to another business.'})
            attrs.pop('business', None)
            business = None
        elif business is None:
            request = self.context.get('request')
            business = getattr(request, 'business', None) or Business.objects.filter(
                is_active=True).order_by('id').first()
            if business is None:
                raise serializers.ValidationError({
                    'business': 'Create a business first, then add its outlets.'})
            attrs['business'] = business

        name = attrs.get('name') or (instance.name if instance else '')
        owner_id = business.pk if business is not None else instance.business_id
        clash = Branch.objects.filter(business_id=owner_id, name__iexact=name)
        if instance is not None:
            clash = clash.exclude(pk=instance.pk)
        if clash.exists():
            raise serializers.ValidationError(
                {'name': f'{name} already exists in {business.name if business else "this business"}.'})
        return attrs

    def get_total_staff(self, obj):
        # §4.4: staff membership is expressed by grants, not by a profile FK.
        return staff_count_for_branch(obj)

    def get_total_rooms(self, obj):
        return obj.rooms.count()





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
            'phone_number', 'email', 'birth_date', 'is_active', 'business',
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

    def _resolve_business(self, validated_data):
        """Work out which business owns this customer, and refuse spoofing.

        A business-scoped caller always gets *its* business, whatever the payload
        says.  A company-wide caller (OWNER / SUPERADMIN) has no active business,
        so it must name one explicitly — otherwise the customer would be
        orphaned and invisible to every scoped user.
        """
        from .access.context import ensure_business_context

        request = self.context.get('request')
        supplied = validated_data.pop('business', None)
        if request is not None:
            ensure_business_context(request)
        active = getattr(request, 'business', None) if request is not None else None

        if active is not None:
            return active
        if supplied is not None:
            return supplied
        raise serializers.ValidationError(
            {'business': 'Select a business: company-wide accounts must name the '
                         'business this customer belongs to.'}
        )

    def create(self, validated_data):
        validated_data['business'] = self._resolve_business(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # A customer never moves between businesses: the loyalty balance, rewards
        # and receipts behind it would silently change tenant.
        validated_data.pop('business', None)
        return super().update(instance, validated_data)

    def get_total_transactions(self, obj):
        return obj.transaction_set.count() if hasattr(obj, 'transaction_set') else 0

    def get_discount_rate(self, obj):
        return obj.get_discount_rate()

    def get_next_tier_info(self, obj):
        return obj.get_next_tier_info()

    def get_available_rewards_count(self, obj):
        return obj.rewards.filter(status='AVAILABLE').count()



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



class RoomTableSerializer(serializers.ModelSerializer):
    time_remaining = serializers.IntegerField(read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    assigned_staff_name = serializers.CharField(source='assigned_staff.username', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = RoomTable
        fields = [
            'id', 'branch', 'name', 'room_type', 'is_occupied', 'start_time',
            'duration_minutes', 'assigned_staff', 'customer_name', 'service_type',
            'item', 'item_name',
            'created_at', 'updated_at',
            'time_remaining', 'branch_name', 'assigned_staff_name',
        ]

    def validate_branch(self, branch):
        return assert_branch_in_active_business(branch, self.context.get('request'))









class TransactionItemSerializer(serializers.ModelSerializer):
    # Kept for receipt/UI compatibility: both report the unified item name.
    product_name = serializers.SerializerMethodField()
    service_name = serializers.SerializerMethodField()
    # §5.4: `unit_price` is the price snapshot written at sale time; `price`
    # stays as a read-only alias so existing receipts/tills keep rendering.
    price = serializers.DecimalField(
        source='unit_price', max_digits=10, decimal_places=2, read_only=True
    )
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = TransactionItem
        fields = [
            'id', 'transaction', 'branch', 'branch_name', 'item_type', 'catalog_source',
            'item', 'description', 'unit_price', 'price',
            'quantity', 'discount', 'total',
            'product_name', 'service_name',
        ]

    def get_product_name(self, obj):
        return obj.item.name if obj.item_id and obj.item_type == 'PRODUCT' else ''

    def get_service_name(self, obj):
        return obj.item.name if obj.item_id and obj.item_type == 'SERVICE' else ''



class TransactionSerializer(serializers.ModelSerializer):
    items = TransactionItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    staff_name = serializers.CharField(source='staff.username', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    rewards_applied_details = CustomerRewardSerializer(source='rewards_applied', many=True, read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'transaction_number', 'business', 'branch', 'customer', 'staff',
            'transaction_type', 'subtotal', 'discount', 'total',
            'amount_paid', 'change', 'status', 'notes', 'shift',
            'customer_tier_at_purchase', 'tier_discount_applied',
            'points_earned', 'rewards_applied', 'created_at', 'updated_at',
            'items', 'payments', 'customer_name', 'staff_name', 'branch_name',
            'rewards_applied_details',
        ]
        read_only_fields = [
            'transaction_number', 'business', 'created_at', 'updated_at',
            'points_earned',
        ]



class DailySalesSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = DailySales
        fields = [
            'id', 'branch', 'date', 'total_sales', 'total_expenses',
            'total_void', 'transaction_count', 'created_at', 'updated_at',
            'branch_name',
        ]



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

    def validate_branch(self, branch):
        return assert_branch_in_active_business(branch, self.context.get('request'))



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

    def validate_branch(self, branch):
        return assert_branch_in_active_business(branch, self.context.get('request'))



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

    def validate_branch(self, branch):
        return assert_branch_in_active_business(branch, self.context.get('request'))



class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'business', 'branch', 'action', 'model_name', 'object_id',
            # §7.7: "who did this, in which business, under which request, on
            # which device" is all queryable straight from the payload.
            'description', 'ip_address', 'request_id', 'user_agent', 'created_at',
            'user_name', 'branch_name',
        ]


# ============================================================
# COMPANY SERIALIZER (singleton settings, §4.1)
# ============================================================

class CompanySerializer(serializers.ModelSerializer):
    """The single company row — receipt footer, tax default, branding.

    §4.1 deliberately makes this a writable API instead of settings: the owner
    must be able to change the receipt footer without a deploy.
    """

    class Meta:
        model = Company
        fields = [
            'id', 'legal_name', 'display_name', 'logo', 'tax_id', 'address',
            'contact_number', 'email', 'default_currency', 'timezone',
            'default_tax_rate', 'receipt_footer', 'loyalty_enabled', 'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['id'] = 1  # always expose the singleton id, even before it exists
        return data