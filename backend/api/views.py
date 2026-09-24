# backend/api/views.py

from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction as db_transaction
from django.db.models import Sum, Count, Q, Avg
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from .models import *
from .serializers import *
from .permissions import RoleBasedPermission


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def branch_scoped_queryset(queryset, request):
    """Filter queryset based on the requesting user's branch scope."""
    profile = getattr(request.user, 'profile', None)
    if profile and profile.role in {'BRANCH_ADMIN', 'CASHIER', 'STAFF'}:
        if not profile.branch_id:
            return queryset.none()
        return queryset.filter(branch_id=profile.branch_id)
    return queryset


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
                action=action,
                model_name=self.__class__.__name__.replace('ViewSet', ''),
                object_id=str(getattr(instance, 'id', '')),
                description=description or f"{action} on {self.__class__.__name__}",
                ip_address=get_client_ip(self.request),
            )
        except Exception:
            pass

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

@api_view(['POST'])
@permission_classes([AllowAny])
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
    except Exception:
        pass

    if hasattr(user, 'profile'):
        profile = user.profile
        role = profile.get_role_display()
        branch = profile.branch
        services = list(profile.services.values_list('description', flat=True))
    else:
        role = user.groups.values_list('name', flat=True).first()
        if not role:
            role = 'Superadmin' if user.is_superuser else 'Owner' if user.is_staff else 'Staff'
        branch = None
        services = []

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
    })


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
    except Exception:
        pass
    return Response({'detail': 'Logged out successfully.'})


# ============================================================
# VSS SERVICES VIEWSET
# ============================================================

class VSSServiceViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = VSSService.objects.filter(is_active=True).order_by('category', 'description')
    serializer_class = VSSServiceSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['post'])
    def preview(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        categories = VSSService.objects.filter(is_active=True).values_list('category', flat=True).distinct()
        return Response([c for c in categories if c])

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = VSSService.objects.filter(is_active=True).count()
        categories = VSSService.objects.filter(is_active=True).values('category').distinct().count()
        total_price = VSSService.objects.filter(is_active=True).aggregate(total=Sum('price'))['total'] or 0
        return Response({
            'total_services': total,
            'total_categories': categories,
            'total_price': total_price,
        })


# ============================================================
# VREAL PRODUCTS VIEWSET
# ============================================================

class VRealProductViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = VRealProduct.objects.filter(is_active=True).order_by('category', 'product')
    serializer_class = VRealProductSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['post'])
    def preview(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        categories = VRealProduct.objects.filter(is_active=True).values_list('category', flat=True).distinct()
        return Response([c for c in categories if c])

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = VRealProduct.objects.filter(is_active=True).count()
        categories = VRealProduct.objects.filter(is_active=True).values('category').distinct().count()
        total_price = VRealProduct.objects.filter(is_active=True).aggregate(total=Sum('price'))['total'] or 0
        return Response({
            'total_products': total,
            'total_categories': categories,
            'total_price': total_price,
        })


# ============================================================
# BB PRODUCTS VIEWSET
# ============================================================

class BBProductViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = BBProduct.objects.filter(is_active=True).order_by('-updated_at')
    serializer_class = BBProductSerializer
    permission_classes = [RoleBasedPermission]


# ============================================================
# PANGANAN MENU VIEWSET
# ============================================================

class PangananMenuViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = PangananMenu.objects.filter(is_active=True).order_by('-updated_at')
    serializer_class = PangananMenuSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['get'])
    def categories(self, request):
        categories = PangananMenu.objects.values_list('category', flat=True).distinct()
        return Response([c for c in categories if c])


# ============================================================
# KB ITEM VIEWSET
# ============================================================

class KBItemViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = KBItem.objects.filter(is_active=True)
    serializer_class = KBItemSerializer
    permission_classes = [RoleBasedPermission]


# ============================================================
# AUTO SPA SERVICE VIEWSET
# ============================================================

class AutoSpaServiceViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = AutoSpaService.objects.filter(is_active=True)
    serializer_class = AutoSpaServiceSerializer
    permission_classes = [RoleBasedPermission]


# ============================================================
# USER PROFILE VIEWSET
# ============================================================

class UserProfileViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = UserProfile.objects.select_related('user', 'branch').prefetch_related('services').all()
    serializer_class = UserProfileSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)

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

class BranchViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = Branch.objects.filter(is_active=True)
    serializer_class = BranchSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        profile = getattr(self.request.user, 'profile', None)
        if profile and profile.role in {'BRANCH_ADMIN', 'CASHIER', 'STAFF'}:
            return super().get_queryset().filter(pk=profile.branch_id)
        return super().get_queryset()

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

class ProductViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductSerializer
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        products = Product.objects.filter(is_active=True)
        low_stock = [p for p in products if p.is_low_stock]
        serializer = self.get_serializer(low_stock, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        category = request.query_params.get('category')
        if category:
            products = Product.objects.filter(category=category, is_active=True)
            serializer = self.get_serializer(products, many=True)
            return Response(serializer.data)
        return Response([])


# ============================================================
# BRANCH INVENTORY VIEWSET
# ============================================================

class BranchInventoryViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = BranchInventory.objects.all()
    serializer_class = BranchInventorySerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)

    @action(detail=False, methods=['get'])
    def by_branch(self, request):
        branch_id = request.query_params.get('branch_id')
        if branch_id:
            inventory = BranchInventory.objects.filter(branch_id=branch_id)
            serializer = self.get_serializer(inventory, many=True)
            return Response(serializer.data)
        return Response([])

    @action(detail=True, methods=['post'])
    def restock(self, request, pk=None):
        """Add stock to a branch inventory item."""
        inventory = self.get_object()
        quantity = int(request.data.get('quantity', 0))
        if quantity <= 0:
            return Response({'detail': 'Quantity must be positive.'}, status=status.HTTP_400_BAD_REQUEST)
        inventory.stock_qty += quantity
        inventory.save()
        return Response(self.get_serializer(inventory).data)


# ============================================================
# CLIENT PROFILE VIEWSET (with Customer Detection & Rewards)
# ============================================================

class ClientProfileViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = ClientProfile.objects.all()
    serializer_class = ClientProfileSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)

    def perform_create(self, serializer):
        instance = serializer.save()
        self._log_action('CREATE', instance, f"Created customer: {instance.full_name}")
        return instance

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '')
        clients = ClientProfile.objects.filter(
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
        try:
            customer = ClientProfile.objects.get(phone_number=phone)
            serializer = self.get_serializer(customer)
            return Response(serializer.data)
        except ClientProfile.DoesNotExist:
            return Response({'detail': 'Customer not found.'}, status=404)
        except ClientProfile.MultipleObjectsReturned:
            customers = ClientProfile.objects.filter(phone_number=phone)
            serializer = self.get_serializer(customers, many=True)
            return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        client = self.get_object()
        transactions = Transaction.objects.filter(customer=client)
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def feedback(self, request, pk=None):
        client = self.get_object()
        feedback = CustomerFeedback.objects.filter(customer=client)
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
        """Return full tier info for a customer."""
        customer = self.get_object()
        return Response({
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
        })


# ============================================================
# ROOM TABLE VIEWSET
# ============================================================

class RoomTableViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = RoomTable.objects.all()
    serializer_class = RoomTableSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)

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
            return Response({'error': 'Room is already occupied'}, status=status.HTTP_400_BAD_REQUEST)

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

class TransactionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)

    @action(detail=False, methods=['post'])
    def checkout(self, request):
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

        try:
            with db_transaction.atomic():
                prepared_items = []
                subtotal = Decimal('0')

                for submitted_item in items:
                    item_type = submitted_item.get('item_type', '').upper()
                    quantity = int(submitted_item.get('quantity', 0))
                    if quantity < 1 or item_type not in {'PRODUCT', 'SERVICE'}:
                        raise ValueError('Each item needs a valid type and quantity.')

                    if item_type == 'PRODUCT':
                        product = Product.objects.get(pk=submitted_item.get('product'), is_active=True)
                        inventory = BranchInventory.objects.select_for_update().get(branch=branch, product=product)
                        if inventory.stock_qty < quantity:
                            raise ValueError(f'Insufficient stock for {product.name}.')
                        description = product.name
                        price = product.selling_price
                    else:
                        service = VSSService.objects.get(pk=submitted_item.get('service'), is_active=True)
                        inventory = None
                        description = service.description
                        price = service.price

                    line_total = price * quantity
                    subtotal += line_total
                    prepared_items.append({
                        'item_type': item_type,
                        'product': product if item_type == 'PRODUCT' else None,
                        'service': service if item_type == 'SERVICE' else None,
                        'description': description,
                        'price': price,
                        'quantity': quantity,
                        'total': line_total,
                        'inventory': inventory,
                    })

                # Tier discount
                tier_discount_amount = Decimal('0')
                tier_at_purchase = None
                if customer and apply_tier_discount:
                    tier_at_purchase = customer.loyalty_tier
                    discount_rate = Decimal(str(customer.get_discount_rate())) / Decimal('100')
                    tier_discount_amount = (subtotal * discount_rate).quantize(Decimal('0.01'))

                # Reward discounts
                reward_discount = Decimal('0')
                claimed_rewards = []
                if reward_ids and customer:
                    for rid in reward_ids:
                        try:
                            r = CustomerReward.objects.select_for_update().get(pk=rid, customer=customer, status='AVAILABLE')
                            if r.reward_type == 'DISCOUNT':
                                if r.discount_percent > 0:
                                    reward_discount += (subtotal * (r.discount_percent / Decimal('100'))).quantize(Decimal('0.01'))
                                else:
                                    reward_discount += r.value
                            r.status = 'CLAIMED'
                            r.claimed_at = timezone.now()
                            r.save()
                            claimed_rewards.append(r)
                        except CustomerReward.DoesNotExist:
                            pass

                total_discount = discount + tier_discount_amount + reward_discount
                total = max(Decimal('0'), subtotal - total_discount)
                if amount_paid < total:
                    raise ValueError('Payment is less than the transaction total.')

                # Points earned (1 per ₱100)
                points_earned = (total / Decimal('100')).quantize(Decimal('0.01')) if customer else Decimal('0')

                transaction_record = Transaction.objects.create(
                    transaction_number=f"TXN-{timezone.now():%Y%m%d}-{uuid4().hex[:8].upper()}",
                    branch=branch,
                    transaction_type='SALE',
                    customer=customer,
                    staff=request.user,
                    subtotal=subtotal,
                    discount=total_discount,
                    total=total,
                    amount_paid=amount_paid,
                    change=amount_paid - total,
                    status='PAID',
                    notes=request.data.get('notes', ''),
                    customer_tier_at_purchase=tier_at_purchase,
                    tier_discount_applied=tier_discount_amount,
                    points_earned=points_earned,
                )

                # Link claimed rewards
                for r in claimed_rewards:
                    r.claimed_in_transaction = transaction_record
                    r.save()
                    transaction_record.rewards_applied.add(r)
                    RewardClaim.objects.create(
                        reward=r,
                        transaction=transaction_record,
                        claimed_by=request.user,
                        amount_applied=r.value,
                    )

                for item in prepared_items:
                    TransactionItem.objects.create(
                        transaction=transaction_record,
                        product=item['product'],
                        service=item['service'],
                        item_type=item['item_type'],
                        description=item['description'],
                        price=item['price'],
                        quantity=item['quantity'],
                        total=item['total'],
                    )
                    if item['inventory']:
                        item['inventory'].stock_qty -= item['quantity']
                        item['inventory'].save(update_fields=['stock_qty', 'last_updated'])

                # Update DailySales
                daily_sales, _ = DailySales.objects.get_or_create(branch=branch, date=timezone.localdate())
                daily_sales.total_sales = Decimal(str(daily_sales.total_sales or 0)) + total
                daily_sales.transaction_count += 1
                daily_sales.save(update_fields=['total_sales', 'transaction_count', 'updated_at'])

                # Update customer loyalty
                if customer:
                    old_tier = customer.loyalty_tier
                    customer.total_spent = Decimal(str(customer.total_spent or 0)) + total
                    customer.loyalty_points = Decimal(str(customer.loyalty_points or 0)) + points_earned

                    # Free item every ₱5,000
                    free_items_earned = int(total // Decimal('5000'))
                    if free_items_earned > 0:
                        customer.free_items_available += free_items_earned

                    # Tier recalculation
                    customer.recalculate_tier()
                    customer.save()

                    # Tier upgrade reward
                    if old_tier != customer.loyalty_tier:
                        CustomerReward.objects.create(
                            customer=customer,
                            reward_type='TIER_UPGRADE',
                            title=f"🎉 Welcome to {customer.get_loyalty_tier_display()}!",
                            description=f"You've been upgraded to {customer.get_loyalty_tier_display()}. Enjoy {customer.get_discount_rate()}% discount on all future purchases!",
                            value=Decimal('0'),
                            discount_percent=Decimal(str(customer.get_discount_rate())),
                            transaction=transaction_record,
                        )

                    # Free item reward
                    if free_items_earned > 0:
                        CustomerReward.objects.create(
                            customer=customer,
                            reward_type='FREE_ITEM',
                            title=f"🎁 Free Item Unlocked!",
                            description=f"You earned {free_items_earned} free item(s) with your ₱{total} purchase. Ask the cashier to claim.",
                            value=Decimal('200'),
                            transaction=transaction_record,
                        )

        except (Product.DoesNotExist, VSSService.DoesNotExist, BranchInventory.DoesNotExist) as error:
            return Response({'detail': str(error)}, status=400)
        except (TypeError, ValueError) as error:
            return Response({'detail': str(error)}, status=400)

        return Response(self.get_serializer(transaction_record).data, status=201)

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        """Void a transaction and restore stock."""
        transaction = self.get_object()
        if transaction.transaction_type == 'VOID':
            return Response({'detail': 'Transaction is already voided.'}, status=400)

        reason = request.data.get('reason', '')

        try:
            with db_transaction.atomic():
                for item in transaction.items.all():
                    if item.product:
                        try:
                            inventory = BranchInventory.objects.select_for_update().get(
                                branch=transaction.branch,
                                product=item.product,
                            )
                            inventory.stock_qty += item.quantity
                            inventory.save(update_fields=['stock_qty', 'last_updated'])
                        except BranchInventory.DoesNotExist:
                            pass

                transaction.transaction_type = 'VOID'
                transaction.status = 'VOIDED'
                transaction.notes = f"{transaction.notes or ''}\n[VOIDED] {reason}".strip()
                transaction.save()

                try:
                    daily = DailySales.objects.get(branch=transaction.branch, date=transaction.created_at.date())
                    daily.total_void = Decimal(str(daily.total_void or 0)) + transaction.total
                    daily.total_sales = Decimal(str(daily.total_sales or 0)) - transaction.total
                    daily.save(update_fields=['total_void', 'total_sales', 'updated_at'])
                except DailySales.DoesNotExist:
                    pass

        except Exception as error:
            return Response({'detail': str(error)}, status=400)

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

class CustomerRewardViewSet(viewsets.ModelViewSet):
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

    @action(detail=False, methods=['get'], url_path='by-customer/(?P<customer_id>[^/.]+)')
    def by_customer(self, request, customer_id=None):
        try:
            customer = ClientProfile.objects.get(pk=customer_id)
        except ClientProfile.DoesNotExist:
            return Response({'detail': 'Customer not found.'}, status=404)

        return Response({
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
        })


# ============================================================
# ATTENDANCE VIEWSET
# ============================================================

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)

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

class CustomerFeedbackViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = CustomerFeedback.objects.all()
    serializer_class = CustomerFeedbackSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)

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

class ExpenseViewSet(AuditLogMixin, viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)

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
# AUDIT LOG VIEWSET
# ============================================================

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)

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

    @action(detail=False, methods=['get'])
    def summary(self, request):
        today = timezone.localdate()
        month_ago = today - timedelta(days=30)

        rooms = branch_scoped_queryset(RoomTable.objects.all(), request)
        products = branch_scoped_queryset(Product.objects.all(), request)
        transactions = branch_scoped_queryset(Transaction.objects.all(), request)
        expenses = branch_scoped_queryset(Expense.objects.all(), request)
        feedbacks = branch_scoped_queryset(CustomerFeedback.objects.all(), request)

        active_rooms = rooms.filter(is_occupied=True).count()
        total_rooms = rooms.count()
        low_stock_count = sum(1 for p in products.filter(is_active=True) if p.is_low_stock)

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
            'total_products': products.filter(is_active=True).count(),
            'total_services': VSSService.objects.filter(is_active=True).count(),
            'top_staff': top_staff,
        })

    @action(detail=False, methods=['get'])
    def branch_comparison(self, request):
        """Return sales stats per branch (Superadmin only)."""
        profile = getattr(request.user, 'profile', None)
        if profile and profile.role not in {'SUPERADMIN', 'OWNER'}:
            return Response({'detail': 'Access denied.'}, status=403)

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
    permission_classes = [RoleBasedPermission]

    @action(detail=False, methods=['get'], url_path='by-branch/(?P<branch_id>[^/.]+)')
    def by_branch(self, request, branch_id=None):
        try:
            branch = Branch.objects.get(pk=branch_id, is_active=True)
        except Branch.DoesNotExist:
            return Response({'detail': 'Branch not found.'}, status=404)

        branch_type = branch.branch_type
        catalog = {
            'branch_id': branch.id,
            'branch_name': branch.name,
            'branch_type': branch_type,
            'branch_type_display': branch.get_branch_type_display(),
            'vss_services': [],
            'vreal_products': [],
            'bb_products': [],
        }

        if branch_type in ('VSS', 'MIXED'):
            catalog['vss_services'] = VSSServiceSerializer(
                VSSService.objects.filter(is_active=True).order_by('category', 'description'),
                many=True
            ).data

        if branch_type in ('VREAL', 'MIXED'):
            catalog['vreal_products'] = VRealProductSerializer(
                VRealProduct.objects.filter(is_active=True).order_by('category', 'product'),
                many=True
            ).data

        if branch_type in ('BB', 'MIXED'):
            catalog['bb_products'] = BBProductSerializer(
                BBProduct.objects.filter(is_active=True).order_by('product_name'),
                many=True
            ).data

        return Response(catalog)


# ============================================================
# CUSTOMER DETECTION VIEWSET (Auto-detect returning customers)
# ============================================================

class CustomerDetectionViewSet(viewsets.ViewSet):
    permission_classes = [RoleBasedPermission]

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
                'tier_info': {
                    'loyalty_tier': customer.loyalty_tier,
                    'discount_rate': customer.get_discount_rate(),
                    'total_spent': customer.total_spent,
                    'loyalty_points': customer.loyalty_points,
                    'free_items_available': customer.free_items_available,
                },
                'available_rewards': CustomerRewardSerializer(
                    customer.rewards.filter(status='AVAILABLE'), many=True
                ).data,
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
            alerts.append({
                'customer_id': customer.id,
                'customer_name': customer.full_name,
                'loyalty_tier': customer.loyalty_tier,
                'discount_rate': customer.get_discount_rate(),
                'reward_count': rewards.count(),
                'rewards': CustomerRewardSerializer(rewards, many=True).data,
                'total_spent': customer.total_spent,
            })

        return Response(alerts)