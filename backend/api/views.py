# backend/api/views.py

import logging

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction as db_transaction
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

from rest_framework import serializers as drf_serializers
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema

from .models import (
    Attendance, AuditLog, Branch,
    ClientProfile, CustomerFeedback, CustomerReward, DailySales, Expense,
    RewardClaim, RoomTable, Transaction,
    UserProfile,
)
from .catalog.models import BusinessItem, Category, InventoryLevel, Item
from .business.models import Business
from .sales.services import checkout as sales_checkout, receive_stock, void_sale
from .access.models import UserAccess
from .access.scoping import ScopedQuerysetMixin, auto_scope
from .permissions import RoleBasedPermission
from .serializers import (
    AttendanceSerializer, AuditLogSerializer, AutoSpaServiceSerializer,
    BBProductSerializer, BranchInventorySerializer,
    BranchSerializer, ClientProfileSerializer, CustomerFeedbackSerializer,
    CustomerRewardSerializer, DailySalesSerializer, ExpenseSerializer,
    KBItemSerializer, PangananMenuSerializer, ProductSerializer,
    RewardClaimSerializer, RoomTableSerializer, TransactionSerializer,
    UserProfileSerializer, VRealProductSerializer, VSSServiceSerializer,
)

logger = logging.getLogger(__name__)


# ============================================================
# HELPER FUNCTIONS
# ============================================================
# NOTE: manual branch_scoped_queryset() is gone — scoping is now automatic
# via api.access.scoping.ScopedQuerysetMixin / auto_scope(), driven by the
# UserAccess grant resolved once per request by BusinessMiddleware.

def build_tier_payload(customer):
    """Single source of truth for the customer loyalty payload.

    Used by /clients/{id}/tier_info/, /customer-tier/by-customer/{id}/,
    /customer-detection/detect/ and /notifications/customer_alerts/ so all
    four endpoints always agree on shape and permissions.
    """
    return {
        'customer_id': customer.id,
        'customer_name': customer.full_name,
        'loyalty_tier': customer.loyalty_tier,
        'tier_display': customer.get_loyalty_tier_display(),
        'discount_rate': customer.get_discount_rate(),
        'total_spent': customer.total_spent,
        'loyalty_points': customer.loyalty_points,
        'free_items_available': customer.free_items_available,
        'next_tier_info': customer.get_next_tier_info(),
        'available_rewards': CustomerRewardSerializer(
            customer.rewards.filter(status='AVAILABLE'), many=True
        ).data,
    }


def get_user_branch(user):
    """Safely return the branch of a user."""
    profile = getattr(user, 'profile', None)
    return profile.branch if profile else None


def get_client_ip(request):
    """Extract client IP address from request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


# ============================================================
# AUDIT LOG MIXIN - Auto-log CRUD operations
# ============================================================

class AuditLogMixin:
    """Automatically log CREATE, UPDATE, DELETE actions to AuditLog model."""

    def _log_action(self, action, instance, description=''):
        try:
            AuditLog.objects.create(
                user=self.request.user if self.request.user.is_authenticated else None,
                branch=get_user_branch(self.request.user),
                business=getattr(self.request, 'business', None),
                action=action,
                model_name=self.__class__.__name__.replace('ViewSet', ''),
                object_id=str(getattr(instance, 'id', '')),
                description=description or f"{action} on {self.__class__.__name__}",
                ip_address=get_client_ip(self.request),
            )
        except Exception:  # noqa: BLE001 - auditing must never break the request
            logger.exception('Failed to write audit log for %s on %s', action, instance)

    def perform_create(self, serializer):
        instance = serializer.save()
        self._log_action('CREATE', instance)
        return instance

    def perform_update(self, serializer):
        instance = serializer.save()
        self._log_action('UPDATE', instance)
        return instance

    def perform_destroy(self, instance):
        self._log_action('DELETE', instance)
        instance.delete()


# ============================================================
# AUTHENTICATION
# ============================================================

class LoginThrottle(AnonRateThrottle):
    rate = '10/minute'


# ============================================================
# OPENAPI SCHEMA HELPERS FOR AUTH ENDPOINTS
# ============================================================

class LoginRequestSerializer(drf_serializers.Serializer):
    username = drf_serializers.CharField(help_text='Login username.')
    password = drf_serializers.CharField(write_only=True, help_text='Login password.')


class AuthUserSerializer(drf_serializers.Serializer):
    id = drf_serializers.IntegerField()
    username = drf_serializers.CharField()
    role = drf_serializers.CharField()
    role_code = drf_serializers.CharField()
    branch = drf_serializers.DictField(allow_null=True)
    services = drf_serializers.ListField(child=drf_serializers.CharField())
    is_staff = drf_serializers.BooleanField()
    is_superuser = drf_serializers.BooleanField()


class BusinessChoiceSerializer(drf_serializers.Serializer):
    id = drf_serializers.IntegerField()
    name = drf_serializers.CharField()
    slug = drf_serializers.CharField()
    type = drf_serializers.CharField(allow_null=True)
    type_name = drf_serializers.CharField(allow_null=True)


class LoginResponseSerializer(drf_serializers.Serializer):
    token = drf_serializers.CharField()
    user = AuthUserSerializer()
    businesses = BusinessChoiceSerializer(many=True)
    primary_business = drf_serializers.DictField(allow_null=True)


class LogoutResponseSerializer(drf_serializers.Serializer):
    detail = drf_serializers.CharField()


_ERROR_RESPONSES = {
    400: OpenApiResponse(description='Missing username or password.'),
    401: OpenApiResponse(description='Invalid credentials.'),
    429: OpenApiResponse(description='Too many login attempts. Try again later.'),
}


@extend_schema(
    request=LoginRequestSerializer,
    responses={
        200: LoginResponseSerializer,
        **_ERROR_RESPONSES,
    },
    auth=[{'TokenAuth': []}],
    summary='Authenticate and obtain an API token',
    description=(
        'Verifies username/password and returns a DRF token plus profile data. '
        'Rate limited to 10 requests per minute.'
    ),
    tags=['Auth'],
)
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_view(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    if not username or not password:
        return Response(
            {'detail': 'Username and password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(username=username, password=password)
    if user is None or not user.is_active:
        return Response(
            {'detail': 'Invalid username or password.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    token, _ = Token.objects.get_or_create(user=user)

    try:
        AuditLog.objects.create(
            user=user,
            branch=get_user_branch(user),
            action='LOGIN',
            model_name='User',
            object_id=str(user.id),
            description=f"User {user.username} logged in",
            ip_address=get_client_ip(request),
        )
    except Exception:  # noqa: BLE001 - auditing must never break login
        logger.exception('Failed to write LOGIN audit log for %s', user.username)

    if hasattr(user, 'profile'):
        profile = user.profile
        role = profile.get_role_display()
        branch = profile.branch
        services = list(profile.skills.values_list('name', flat=True))
    else:
        role = user.groups.values_list('name', flat=True).first()
        if not role:
            role = 'Superadmin' if user.is_superuser else 'Owner' if user.is_staff else 'Staff'
        branch = None
        services = []

    # Businesses this account may open (business switcher in the UI).
    grants = UserAccess.objects.filter(user=user, is_active=True).select_related('business')
    company_grant = grants.filter(business__isnull=True).first()
    if user.is_superuser or company_grant is not None:
        businesses_qs = Business.objects.filter(is_active=True)
        primary_grant = grants.filter(is_primary=True).select_related('business').first()
        primary_business = primary_grant.business if primary_grant and primary_grant.business else businesses_qs.first()
    else:
        granted_ids = [g.business_id for g in grants if g.business_id]
        businesses_qs = Business.objects.filter(id__in=granted_ids, is_active=True)
        primary_grant = grants.filter(is_primary=True, business__isnull=False).first()
        primary_business = primary_grant.business if primary_grant else businesses_qs.first()

    businesses = [
        {
            'id': b.id,
            'name': b.name,
            'slug': b.slug,
            'type': b.business_type.code if b.business_type_id else None,
            'type_name': b.business_type.name if b.business_type_id else None,
        }
        for b in businesses_qs.select_related('business_type')
    ]

    return Response({
        'token': token.key,
        'user': {
            'id': user.id,
            'username': user.username,
            'role': role,
            'role_code': profile.role if hasattr(user, 'profile') else role.upper().replace(' ', '_'),
            'branch': {'id': branch.id, 'name': branch.name} if branch else None,
            'services': services,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
        },
        'businesses': businesses,
        'primary_business': (
            {
                'id': primary_business.id,
                'name': primary_business.name,
                'slug': primary_business.slug,
            }
            if primary_business else None
        ),
    })


@extend_schema(
    request=None,
    responses={200: LogoutResponseSerializer},
    auth=[{'TokenAuth': []}],
    summary='Revoke the current API token',
    description='Deletes the caller\'s token and writes a LOGOUT audit entry.',
    tags=['Auth'],
)
@api_view(['POST'])
def logout_view(request):
    """Logout the current user and log the action."""
    try:
        AuditLog.objects.create(
            user=request.user,
            branch=get_user_branch(request.user),
            action='LOGOUT',
            model_name='User',
            object_id=str(request.user.id),
            description=f"User {request.user.username} logged out",
            ip_address=get_client_ip(request),
        )
        request.user.auth_token.delete()
    except Exception:  # noqa: BLE001 - auditing must never break logout
        logger.exception('Failed to complete logout for %s', request.user)
    return Response({'detail': 'Logged out successfully.'})


# ============================================================
# LEGACY CATALOG VIEWSHIMS (read-only, backed by the unified catalog)
# ------------------------------------------------------------
# These keep the old class names, URLs, actions and payload shapes so
# ROLE_ACTIONS and the current frontend keep working unchanged, while
# every row is now served from ``Item`` / ``BusinessItem``.
# ============================================================

def business_catalog_queryset(slug, item_type=None):
    """Active items a business sells, via its ``BusinessItem`` link."""
    qs = Item.objects.select_related('category').filter(
        business_entries__business__slug=slug,
        business_entries__is_available=True,
        is_active=True,
    )
    if item_type:
        qs = qs.filter(item_type=item_type)
    return qs


# ============================================================
# VSS SERVICES VIEWSET
# ============================================================

class VSSServiceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = business_catalog_queryset('vss', 'SERVICE').order_by('category__name', 'name')
    serializer_class = VSSServiceSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['post'])
    def preview(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        categories = self.get_queryset().values_list('category__name', flat=True).distinct()
        return Response([c for c in categories if c])

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        total = qs.count()
        categories = qs.values('category_id').distinct().count()
        total_price = qs.aggregate(total=Sum('selling_price'))['total'] or 0
        return Response({
            'total_services': total,
            'total_categories': categories,
            'total_price': total_price,
        })


# ============================================================
# VREAL PRODUCTS VIEWSET
# ============================================================

class VRealProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = business_catalog_queryset('vreal', 'PRODUCT').order_by('category__name', 'name')
    serializer_class = VRealProductSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['post'])
    def preview(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        categories = self.get_queryset().values_list('category__name', flat=True).distinct()
        return Response([c for c in categories if c])

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        total = qs.count()
        categories = qs.values('category_id').distinct().count()
        total_price = qs.aggregate(total=Sum('selling_price'))['total'] or 0
        return Response({
            'total_products': total,
            'total_categories': categories,
            'total_price': total_price,
        })


# ============================================================
# BB PRODUCTS VIEWSET
# ============================================================

class BBProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = business_catalog_queryset('bb', 'PRODUCT').order_by('-updated_at')
    serializer_class = BBProductSerializer
    permission_classes = [RoleBasedPermission]


# ============================================================
# PANGANAN MENU VIEWSET
# ============================================================

class PangananMenuViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = business_catalog_queryset('panganan', 'PRODUCT').order_by('-updated_at')
    serializer_class = PangananMenuSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['get'])
    def categories(self, request):
        categories = self.get_queryset().values_list('category__name', flat=True).distinct()
        return Response([c for c in categories if c])


# ============================================================
# KB ITEM VIEWSET
# ============================================================

class KBItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = business_catalog_queryset('kb', 'PRODUCT').order_by('name')
    serializer_class = KBItemSerializer
    permission_classes = [RoleBasedPermission]


# ============================================================
# AUTO SPA SERVICE VIEWSET
# ============================================================

class AutoSpaServiceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = business_catalog_queryset('autospa', 'SERVICE').order_by('name')
    serializer_class = AutoSpaServiceSerializer
    permission_classes = [RoleBasedPermission]


# ============================================================
# USER PROFILE VIEWSET
# ============================================================

class UserProfileViewSet(ScopedQuerysetMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = UserProfile.objects.select_related('user', 'branch').prefetch_related('skills').all()
    serializer_class = UserProfileSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Return the current user's profile."""
        if hasattr(request.user, 'profile'):
            serializer = self.get_serializer(request.user.profile)
            return Response(serializer.data)
        return Response({'detail': 'No profile found.'}, status=status.HTTP_404_NOT_FOUND)


# ============================================================
# BRANCH VIEWSET
# ============================================================

class BranchViewSet(ScopedQuerysetMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = Branch.objects.filter(is_active=True)
    serializer_class = BranchSerializer
    permission_classes = [RoleBasedPermission]
    branch_lookup = 'pk'  # a Branch row *is* the branch

    @action(detail=True, methods=['get'])
    def staffing(self, request, pk=None):
        branch = self.get_object()
        role_counts = {
            role: UserProfile.objects.filter(branch=branch, role=role, user__is_active=True).count()
            for role in ('BRANCH_ADMIN', 'CASHIER', 'STAFF')
        }
        return Response({
            'branch': branch.name,
            'roles': role_counts,
            'missing_roles': [role for role, count in role_counts.items() if count == 0],
            'ready': all(count > 0 for count in role_counts.values()),
        })

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Return summary stats for a specific branch."""
        branch = self.get_object()
        today = timezone.localdate()
        month_ago = today - timedelta(days=30)

        transactions = Transaction.objects.filter(branch=branch, transaction_type='SALE')
        today_sales = transactions.filter(created_at__date=today).aggregate(total=Sum('total'))['total'] or 0
        month_sales = transactions.filter(created_at__date__gte=month_ago).aggregate(total=Sum('total'))['total'] or 0

        expenses = Expense.objects.filter(branch=branch)
        month_expenses = expenses.filter(expense_date__gte=month_ago).aggregate(total=Sum('amount'))['total'] or 0

        return Response({
            'branch_id': branch.id,
            'branch_name': branch.name,
            'today_sales': today_sales,
            'month_sales': month_sales,
            'month_expenses': month_expenses,
            'net_profit': float(month_sales) - float(month_expenses),
            'total_staff': UserProfile.objects.filter(branch=branch, user__is_active=True).count(),
            'total_rooms': RoomTable.objects.filter(branch=branch).count(),
            'occupied_rooms': RoomTable.objects.filter(branch=branch, is_occupied=True).count(),
        })


# ============================================================
# PRODUCT VIEWSET
# ============================================================

class ProductViewSet(ScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only /products/ shim over ``Item(item_type='PRODUCT')``."""

    queryset = Item.objects.select_related('category').filter(item_type='PRODUCT', is_active=True)
    serializer_class = ProductSerializer
    permission_classes = [RoleBasedPermission]
    branch_lookup = 'inventory_levels__branch_id'  # products are stocked per branch

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        serializer = self.get_serializer(self.get_low_stock_items(), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        category = request.query_params.get('category')
        if category:
            products = self.get_queryset().filter(
                Q(category_id=category) | Q(category__name__iexact=category)
            )
            serializer = self.get_serializer(products, many=True)
            return Response(serializer.data)
        return Response([])

    def get_low_stock_items(self):
        """Products whose stock (across the caller's scope) is at/below min_stock."""
        stock_by_item = {}
        for level in auto_scope(InventoryLevel.objects.all(), self.request):
            stock_by_item[level.item_id] = stock_by_item.get(level.item_id, 0) + level.stock_qty
        return [p for p in self.get_queryset() if stock_by_item.get(p.id, 0) <= p.min_stock]


# ============================================================
# BRANCH INVENTORY VIEWSET (read-only shim over InventoryLevel)
# ============================================================

class BranchInventoryViewSet(ScopedQuerysetMixin, AuditLogMixin, viewsets.ReadOnlyModelViewSet):
    queryset = InventoryLevel.objects.select_related('branch', 'item').all()
    serializer_class = BranchInventorySerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['get'])
    def by_branch(self, request):
        branch_id = request.query_params.get('branch_id')
        if branch_id:
            # Scoped through self.get_queryset() so a branch user cannot read
            # another branch's inventory by changing the query string.
            inventory = self.get_queryset().filter(branch_id=branch_id)
            serializer = self.get_serializer(inventory, many=True)
            return Response(serializer.data)
        return Response([])

    @action(detail=True, methods=['post'])
    def restock(self, request, pk=None):
        """Add stock to a branch inventory item (ledgered ``StockMovement``)."""
        inventory = self.get_object()
        try:
            quantity = int(request.data.get('quantity', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'Quantity must be a whole number.'}, status=status.HTTP_400_BAD_REQUEST)
        if quantity <= 0:
            return Response({'detail': 'Quantity must be positive.'}, status=status.HTTP_400_BAD_REQUEST)
        receive_stock(
            branch=inventory.branch,
            item=inventory.item,
            quantity=quantity,
            reference=str(request.data.get('reference', '')),
            user=request.user,
        )
        inventory.refresh_from_db()
        self._log_action(
            'RESTOCK',
            inventory,
            f"Restocked {inventory.item.name} at {inventory.branch.name} by {quantity}",
        )
        return Response(self.get_serializer(inventory).data)


# ============================================================
# CLIENT PROFILE VIEWSET (with Customer Detection & Rewards)
# ============================================================

class ClientProfileViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = ClientProfile.objects.all()
    serializer_class = ClientProfileSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        """Clients are organization-wide.

        ClientProfile has no branch ownership - a customer can transact at any
        branch - so the branch scope for customer data lives on Transaction,
        CustomerFeedback and CustomerReward. ``search``/``find_by_phone`` use
        this same queryset so lookup endpoints cannot disagree with the list.
        """
        return super().get_queryset()

    def perform_create(self, serializer):
        instance = serializer.save()
        self._log_action('CREATE', instance, f"Created customer: {instance.full_name}")
        return instance

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '')
        clients = self.get_queryset().filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(phone_number__icontains=query) |
            Q(email__icontains=query)
        )
        serializer = self.get_serializer(clients, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def find_by_phone(self, request):
        """Find customer by phone number for auto-detection."""
        phone = request.query_params.get('phone', '').strip()
        if not phone:
            return Response({'detail': 'Phone number is required.'}, status=400)
        customers = self.get_queryset().filter(phone_number=phone)
        if not customers.exists():
            return Response({'detail': 'Customer not found.'}, status=404)
        if customers.count() == 1:
            serializer = self.get_serializer(customers.first())
            return Response(serializer.data)
        serializer = self.get_serializer(customers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        client = self.get_object()
        transactions = auto_scope(
            Transaction.objects.filter(customer=client), request
        )
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def feedback(self, request, pk=None):
        client = self.get_object()
        feedback = auto_scope(
            CustomerFeedback.objects.filter(customer=client), request
        )
        serializer = CustomerFeedbackSerializer(feedback, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def rewards(self, request, pk=None):
        """Return all rewards for a customer."""
        client = self.get_object()
        rewards = CustomerReward.objects.filter(customer=client)
        serializer = CustomerRewardSerializer(rewards, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def tier_info(self, request, pk=None):
        """Return full tier info for a customer.

        Shares ``build_tier_payload`` with /customer-tier/by-customer/<id>/ so
        the two routes can never drift apart again.
        """
        return Response(build_tier_payload(self.get_object()))


# ============================================================
# ROOM TABLE VIEWSET
# ============================================================

class RoomTableViewSet(ScopedQuerysetMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = RoomTable.objects.all()
    serializer_class = RoomTableSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['get'])
    def available(self, request):
        rooms = self.get_queryset().filter(is_occupied=False)
        serializer = self.get_serializer(rooms, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def occupied(self, request):
        rooms = self.get_queryset().filter(is_occupied=True)
        serializer = self.get_serializer(rooms, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        room = self.get_object()
        if room.is_occupied:
            return Response({'detail': 'Room is already occupied.'}, status=status.HTTP_400_BAD_REQUEST)

        room.is_occupied = True
        room.start_time = timezone.now()
        room.duration_minutes = request.data.get('duration_minutes', 30)
        room.customer_name = request.data.get('customer_name', '')
        room.service_type = request.data.get('service_type', '')
        room.assigned_staff_id = request.data.get('assigned_staff')
        room.save()

        serializer = self.get_serializer(room)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def check_out(self, request, pk=None):
        room = self.get_object()
        room.is_occupied = False
        room.start_time = None
        room.duration_minutes = 0
        room.customer_name = ''
        room.service_type = ''
        room.assigned_staff = None
        room.save()

        serializer = self.get_serializer(room)
        return Response(serializer.data)


# ============================================================
# TRANSACTION VIEWSET (with Loyalty & Rewards)
# ============================================================

class TransactionViewSet(ScopedQuerysetMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [RoleBasedPermission]

    def create(self, request, *args, **kwargs):
        """Block raw transaction creation: sales must go through checkout.

        POST /transactions/ would bypass stock validation, tier discounts and
        loyalty accrual, so only /transactions/checkout/ may create a sale.
        """
        return Response(
            {'detail': 'Use /transactions/checkout/ to record a sale.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=False, methods=['post'])
    def checkout(self, request):
        """Record a sale through the unified sales service (atomic + idempotent)."""
        branch_id = request.data.get('branch')
        items = request.data.get('items', [])
        customer_id = request.data.get('customer')
        discount = Decimal(str(request.data.get('discount', '0')))
        amount_paid = Decimal(str(request.data.get('amount_paid', '0')))
        reward_ids = request.data.get('reward_ids', [])
        apply_tier_discount = request.data.get('apply_tier_discount', True)
        customer_name_walkin = request.data.get('customer_name', '')

        if not branch_id or not items:
            return Response({'detail': 'A branch and at least one item are required.'}, status=400)
        if discount < 0 or amount_paid < 0:
            return Response({'detail': 'Discount and payment cannot be negative.'}, status=400)

        try:
            branch = Branch.objects.get(pk=branch_id, is_active=True)
            customer = ClientProfile.objects.get(pk=customer_id) if customer_id else None
        except (Branch.DoesNotExist, ClientProfile.DoesNotExist):
            return Response({'detail': 'The selected branch or customer does not exist.'}, status=400)

        # Walk-in with name - create customer profile for tracking
        if not customer and customer_name_walkin:
            parts = customer_name_walkin.strip().split(' ', 1)
            customer = ClientProfile.objects.create(
                first_name=parts[0],
                last_name=parts[1] if len(parts) > 1 else 'Walk-in',
                loyalty_tier='BRONZE',
            )

        profile = getattr(request.user, 'profile', None)
        if profile and profile.role in {'BRANCH_ADMIN', 'CASHIER', 'STAFF'} and profile.branch_id != branch.id:
            return Response({'detail': 'You can only transact for your assigned branch.'}, status=403)

        # Normalise line items: legacy keys `product` / `service` and the new
        # `item` key all carry a unified catalog Item id.
        prepared_items = []
        for submitted_item in items:
            item_type = str(submitted_item.get('item_type', '')).upper()
            quantity = int(submitted_item.get('quantity', 0) or 0)
            item_id = (
                submitted_item.get('item')
                or submitted_item.get('item_id')
                or submitted_item.get('product')
                or submitted_item.get('service')
            )
            if quantity < 1 or item_type not in {'PRODUCT', 'SERVICE'} or not item_id:
                return Response(
                    {'detail': 'Each item needs a valid type, id and quantity.'},
                    status=400,
                )
            prepared_items.append({'item': item_id, 'quantity': quantity})

        try:
            transaction_record = sales_checkout(
                branch=branch,
                cashier=request.user,
                items=prepared_items,
                customer=customer,
                amount_paid=amount_paid,
                discount=discount,
                reward_ids=reward_ids,
                apply_tier_discount=apply_tier_discount,
                idempotency_key=(
                    request.headers.get('Idempotency-Key')
                    or request.data.get('idempotency_key')
                    or None
                ),
                notes=str(request.data.get('notes', '')),
            )
        except DRFValidationError as error:
            detail = error.detail
            if isinstance(detail, list) and detail:
                detail = detail[0]
            return Response({'detail': str(detail)}, status=400)
        except (TypeError, ValueError) as error:
            return Response({'detail': str(error)}, status=400)

        return Response(self.get_serializer(transaction_record).data, status=201)

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        """Void a transaction and restore stock (delegates to the sales service)."""
        transaction = self.get_object()
        reason = request.data.get('reason', '')

        try:
            void_sale(transaction=transaction, staff=request.user, reason=reason)
        except DRFValidationError as error:
            detail = error.detail
            if isinstance(detail, list) and detail:
                detail = detail[0]
            return Response({'detail': str(detail)}, status=400)
        except Exception as error:  # noqa: BLE001 - surface ledger errors to the till
            return Response({'detail': str(error)}, status=400)

        self._log_action(
            'VOID',
            transaction,
            f"Voided {transaction.transaction_number}"
            + (f" - {reason}" if reason else ''),
        )
        return Response(self.get_serializer(transaction).data)

    @action(detail=False, methods=['get'])
    def today(self, request):
        today = timezone.localdate()
        transactions = self.get_queryset().filter(created_at__date=today)
        serializer = self.get_serializer(transactions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        today = timezone.localdate()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        qs = self.get_queryset().filter(transaction_type='SALE')

        today_sales = qs.filter(created_at__date=today).aggregate(
            total=Sum('total'),
            count=Count('id')
        )
        week_sales = qs.filter(created_at__date__gte=week_ago).aggregate(total=Sum('total'))
        month_sales = qs.filter(created_at__date__gte=month_ago).aggregate(total=Sum('total'))

        return Response({
            'today': {
                'total': today_sales['total'] or 0,
                'count': today_sales['count'] or 0
            },
            'weekly': week_sales['total'] or 0,
            'monthly': month_sales['total'] or 0
        })


# ============================================================
# CUSTOMER REWARD VIEWSET
# ============================================================

class CustomerRewardViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = CustomerReward.objects.all()
    serializer_class = CustomerRewardSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        customer_id = self.request.query_params.get('customer_id')
        status_filter = self.request.query_params.get('status')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'])
    def claim(self, request, pk=None):
        """Claim a reward."""
        reward = self.get_object()
        if reward.status != 'AVAILABLE':
            return Response(
                {'detail': f'Reward is not available (status: {reward.status}).'},
                status=400,
            )

        transaction_id = request.data.get('transaction_id')
        notes = request.data.get('notes', '')

        try:
            with db_transaction.atomic():
                reward.status = 'CLAIMED'
                reward.claimed_at = timezone.now()
                if transaction_id:
                    reward.claimed_in_transaction_id = transaction_id
                reward.save()

                RewardClaim.objects.create(
                    reward=reward,
                    transaction_id=transaction_id if transaction_id else None,
                    claimed_by=request.user,
                    amount_applied=reward.value,
                    notes=notes,
                )
        except Exception as error:
            return Response({'detail': str(error)}, status=400)

        return Response(self.get_serializer(reward).data)

    @action(detail=False, methods=['get'])
    def by_customer(self, request):
        customer_id = request.query_params.get('customer_id')
        if not customer_id:
            return Response({'detail': 'customer_id is required.'}, status=400)
        rewards = self.get_queryset().filter(customer_id=customer_id)
        serializer = self.get_serializer(rewards, many=True)
        return Response(serializer.data)


# ============================================================
# REWARD CLAIM VIEWSET
# ============================================================

class RewardClaimViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RewardClaim.objects.all()
    serializer_class = RewardClaimSerializer
    permission_classes = [RoleBasedPermission]


# ============================================================
# CUSTOMER TIER VIEWSET
# ============================================================

class CustomerTierViewSet(viewsets.ViewSet):
    permission_classes = [RoleBasedPermission]

    @extend_schema(
        responses={200: drf_serializers.DictField()},
        parameters=[
            OpenApiParameter(name='customer_id', type=int, location='path', required=True),
        ],
        summary='Loyalty tier for a customer',
        tags=['Customer Detection'],
    )
    @action(detail=False, methods=['get'], url_path='by-customer/(?P<customer_id>[^/.]+)')
    def by_customer(self, request, customer_id=None):
        try:
            customer = ClientProfile.objects.get(pk=customer_id)
        except ClientProfile.DoesNotExist:
            return Response({'detail': 'Customer not found.'}, status=404)

        return Response(build_tier_payload(customer))


# ============================================================
# ATTENDANCE VIEWSET
# ============================================================

class AttendanceViewSet(ScopedQuerysetMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['get'])
    def today(self, request):
        today = timezone.localdate()
        records = self.get_queryset().filter(date=today)
        serializer = self.get_serializer(records, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_records(self, request):
        records = self.get_queryset().filter(user=request.user).order_by('-date')[:30]
        serializer = self.get_serializer(records, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def check_in(self, request):
        today = timezone.localdate()
        branch = get_user_branch(request.user)
        if not branch:
            return Response({'detail': 'You are not assigned to a branch.'}, status=400)

        attendance, created = Attendance.objects.get_or_create(
            user=request.user,
            date=today,
            defaults={
                'branch': branch,
                'time_in': timezone.now(),
                'status': 'PRESENT',
            }
        )
        if not created and attendance.time_in:
            return Response({'detail': 'Already checked in today.'}, status=400)

        return Response(self.get_serializer(attendance).data)

    @action(detail=False, methods=['post'])
    def check_out(self, request):
        today = timezone.localdate()
        try:
            attendance = Attendance.objects.get(user=request.user, date=today)
            attendance.time_out = timezone.now()
            attendance.save()
            return Response(self.get_serializer(attendance).data)
        except Attendance.DoesNotExist:
            return Response({'detail': 'No check-in record found.'}, status=400)


# ============================================================
# CUSTOMER FEEDBACK VIEWSET
# ============================================================

class CustomerFeedbackViewSet(ScopedQuerysetMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = CustomerFeedback.objects.all()
    serializer_class = CustomerFeedbackSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        avg_rating = qs.aggregate(avg=Avg('rating'))['avg'] or 0
        total = qs.count()
        distribution = {f'{i}_star': qs.filter(rating=i).count() for i in range(1, 6)}
        return Response({
            'average_rating': round(avg_rating, 2),
            'total_feedbacks': total,
            'distribution': distribution,
        })


# ============================================================
# EXPENSE VIEWSET
# ============================================================

class ExpenseViewSet(ScopedQuerysetMixin, AuditLogMixin, viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [RoleBasedPermission]

    def perform_create(self, serializer):
        instance = serializer.save(recorded_by=self.request.user)
        self._log_action('CREATE', instance, f"Recorded expense: {instance.description} ({instance.amount})")

    @action(detail=False, methods=['get'])
    def summary(self, request):
        qs = self.get_queryset()
        today = timezone.localdate()
        month_ago = today - timedelta(days=30)

        return Response({
            'today': qs.filter(expense_date=today).aggregate(total=Sum('amount'))['total'] or 0,
            'monthly': qs.filter(expense_date__gte=month_ago).aggregate(total=Sum('amount'))['total'] or 0,
            'by_category': list(qs.values('category').annotate(total=Sum('amount'))),
        })


# ============================================================
# DAILY SALES VIEWSET (read-only report of the DailySales ledger)
# ============================================================

class DailySalesViewSet(ScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only view of the per-branch daily ledger updated on checkout/void."""

    queryset = DailySales.objects.select_related('branch').all()
    serializer_class = DailySalesSerializer
    permission_classes = [RoleBasedPermission]


# ============================================================
# AUDIT LOG VIEWSET
# ============================================================

class AuditLogViewSet(ScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['get'])
    def recent(self, request):
        logs = self.get_queryset()[:50]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)


# ============================================================
# DASHBOARD STATS VIEWSET (Enhanced)
# ============================================================

class DashboardStatsViewSet(viewsets.ViewSet):
    permission_classes = [RoleBasedPermission]

    @extend_schema(
        responses={200: drf_serializers.DictField()},
        summary='Dashboard KPI summary',
        description='Rooms, stock, sales, expenses, ratings and top staff for the caller\'s scope.',
        tags=['Dashboard'],
    )
    @action(detail=False, methods=['get'])
    def summary(self, request):
        today = timezone.localdate()
        month_ago = today - timedelta(days=30)

        rooms = auto_scope(RoomTable.objects.all(), request)
        products = auto_scope(
            Item.objects.filter(item_type='PRODUCT', is_active=True),
            request,
            branch_lookup='inventory_levels__branch_id',
        )
        transactions = auto_scope(Transaction.objects.all(), request)
        expenses = auto_scope(Expense.objects.all(), request)
        feedbacks = auto_scope(CustomerFeedback.objects.all(), request)

        # Stock totals per item within the caller's branch scope
        stock_by_item = {}
        for level in auto_scope(InventoryLevel.objects.all(), request):
            stock_by_item[level.item_id] = stock_by_item.get(level.item_id, 0) + level.stock_qty

        active_rooms = rooms.filter(is_occupied=True).count()
        total_rooms = rooms.count()
        low_stock_count = sum(
            1 for p in products if stock_by_item.get(p.id, 0) <= p.min_stock
        )

        today_sales = transactions.filter(
            created_at__date=today, transaction_type='SALE'
        ).aggregate(total=Sum('total'))['total'] or 0

        month_sales = transactions.filter(
            created_at__date__gte=month_ago, transaction_type='SALE'
        ).aggregate(total=Sum('total'))['total'] or 0

        month_expenses = expenses.filter(
            expense_date__gte=month_ago
        ).aggregate(total=Sum('amount'))['total'] or 0

        avg_rating = feedbacks.aggregate(avg=Avg('rating'))['avg'] or 0

        top_staff = list(
            transactions.filter(
                transaction_type='SALE',
                created_at__date__gte=month_ago,
                staff__isnull=False,
            ).values('staff__username').annotate(
                total_sales=Sum('total'),
                transaction_count=Count('id'),
            ).order_by('-total_sales')[:5]
        )

        return Response({
            'active_rooms': active_rooms,
            'total_rooms': total_rooms,
            'available_staff': User.objects.filter(is_active=True).count(),
            'low_stock_count': low_stock_count,
            'today_sales': today_sales,
            'month_sales': month_sales,
            'month_expenses': month_expenses,
            'net_profit': float(month_sales) - float(month_expenses),
            'average_rating': round(avg_rating, 2),
            'total_products': products.count(),
            'total_services': Item.objects.filter(item_type='SERVICE', is_active=True).count(),
            'top_staff': top_staff,
        })

    @extend_schema(
        responses={200: drf_serializers.ListField(child=drf_serializers.DictField())},
        summary='Per-branch sales comparison',
        description='Organization-wide sales stats grouped by active branch.',
        tags=['Dashboard'],
    )
    @action(detail=False, methods=['get'])
    def branch_comparison(self, request):
        """Return sales stats per branch.

        Organization-wide only: the role check lives in permissions.py
        (DashboardStats:branch_comparison is denied for BRANCH_ADMIN).
        """
        today = timezone.localdate()
        month_ago = today - timedelta(days=30)

        branches = Branch.objects.filter(is_active=True)
        results = []
        for branch in branches:
            transactions = Transaction.objects.filter(branch=branch, transaction_type='SALE')
            today_sales = transactions.filter(created_at__date=today).aggregate(total=Sum('total'))['total'] or 0
            month_sales = transactions.filter(created_at__date__gte=month_ago).aggregate(total=Sum('total'))['total'] or 0
            results.append({
                'branch_id': branch.id,
                'branch_name': branch.name,
                'branch_type': branch.branch_type,
                'today_sales': today_sales,
                'month_sales': month_sales,
                'total_staff': UserProfile.objects.filter(branch=branch, user__is_active=True).count(),
                'occupied_rooms': RoomTable.objects.filter(branch=branch, is_occupied=True).count(),
            })

        return Response(results)


# ============================================================
# BRANCH CATALOG VIEWSET (Para sa POS)
# ============================================================

class BranchCatalogViewSet(viewsets.ViewSet):
    """POS catalog for a branch — nested arrays, served from the unified catalog.

    The three legacy slots (vss_services / vreal_products / bb_products) are
    filled from the branch's ``Business`` (falling back to ``branch_type`` for
    branches created before the SaaS migration).
    """
    permission_classes = [RoleBasedPermission]

    @extend_schema(
        responses={200: drf_serializers.DictField()},
        parameters=[
            OpenApiParameter(name='branch_id', type=int, location='path', required=True),
        ],
        summary='POS catalog for a branch',
        description='Returns the VSS/VReal/BB catalog applicable to the given branch.',
        tags=['Branch Catalog'],
    )
    @action(detail=False, methods=['get'], url_path='by-branch/(?P<branch_id>[^/.]+)')
    def by_branch(self, request, branch_id=None):
        try:
            branch = Branch.objects.get(pk=branch_id, is_active=True)
        except Branch.DoesNotExist:
            return Response({'detail': 'Branch not found.'}, status=404)

        branch_type = branch.branch_type
        slug = branch.business.slug if branch.business_id else None

        if slug == 'vss':
            wants = (True, False, False)
        elif slug == 'vreal':
            wants = (False, True, False)
        elif slug == 'bb':
            wants = (False, False, True)
        elif slug in {'panganan', 'kb', 'autospa'}:
            # These businesses have no legacy POS tab; their items are sold
            # through the unified catalog / Sales page.
            wants = (False, False, False)
        else:
            wants = {
                'VSS': (True, False, False),
                'VREAL': (False, True, False),
                'BB': (False, False, True),
                'MIXED': (True, True, True),
            }.get(branch_type, (True, False, False))

        catalog = {
            'branch_id': branch.id,
            'branch_name': branch.name,
            'branch_type': branch_type,
            'branch_type_display': branch.get_branch_type_display(),
            'business': slug,
            'vss_services': [],
            'vreal_products': [],
            'bb_products': [],
        }

        if wants[0]:
            catalog['vss_services'] = VSSServiceSerializer(
                business_catalog_queryset('vss', 'SERVICE')
                .order_by('category__name', 'name'),
                many=True
            ).data

        if wants[1]:
            catalog['vreal_products'] = VRealProductSerializer(
                business_catalog_queryset('vreal', 'PRODUCT')
                .order_by('category__name', 'name'),
                many=True
            ).data

        if wants[2]:
            catalog['bb_products'] = BBProductSerializer(
                business_catalog_queryset('bb', 'PRODUCT').order_by('name'),
                many=True
            ).data

        return Response(catalog)


# ============================================================
# CUSTOMER DETECTION VIEWSET (Auto-detect returning customers)
# ============================================================

class CustomerDetectionViewSet(viewsets.ViewSet):
    permission_classes = [RoleBasedPermission]

    @extend_schema(
        request=drf_serializers.DictField(),
        responses={200: drf_serializers.DictField()},
        summary='Auto-detect returning customer',
        description='Search by phone or name; returns matching customers with tier info and rewards.',
        tags=['Customer Detection'],
    )
    @action(detail=False, methods=['post'])
    def detect(self, request):
        """
        Auto-detect customer by name or phone number.
        Returns customer info + available rewards if found.
        """
        search_term = request.data.get('search', '').strip()
        if not search_term:
            return Response({'detail': 'Search term is required.'}, status=400)

        # Try to find by phone first
        customers = ClientProfile.objects.filter(
            Q(phone_number__icontains=search_term) |
            Q(first_name__icontains=search_term) |
            Q(last_name__icontains=search_term)
        )[:10]

        if not customers.exists():
            return Response({
                'found': False,
                'message': 'New customer - please fill up the form.',
            })

        results = []
        for customer in customers:
            results.append({
                'customer': ClientProfileSerializer(customer).data,
                'tier_info': build_tier_payload(customer),
            })

        return Response({
            'found': True,
            'count': len(results),
            'results': results,
        })


# ============================================================
# NOTIFICATION VIEWSET (Para sa cashier notifications)
# ============================================================

class NotificationViewSet(viewsets.ViewSet):
    permission_classes = [RoleBasedPermission]

    @extend_schema(
        responses={200: drf_serializers.ListField(child=drf_serializers.DictField())},
        summary='Customer reward alerts for cashiers',
        description='Lists customers with available rewards so cashiers can announce them.',
        tags=['Notifications'],
    )
    @action(detail=False, methods=['get'])
    def customer_alerts(self, request):
        """
        Get notifications for cashier about customers with rewards.
        """
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.branch:
            return Response([])

        # Get customers with available rewards
        customers_with_rewards = ClientProfile.objects.filter(
            rewards__status='AVAILABLE'
        ).distinct()[:20]

        alerts = []
        for customer in customers_with_rewards:
            rewards = customer.rewards.filter(status='AVAILABLE')
            alert = build_tier_payload(customer)
            alert['reward_count'] = rewards.count()
            alerts.append(alert)

        return Response(alerts)