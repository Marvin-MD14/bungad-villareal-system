# backend/api/views.py

from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.db import transaction as db_transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from .models import *
from .serializers import *
from .permissions import RoleBasedPermission


def branch_scoped_queryset(queryset, request):
    profile = getattr(request.user, 'profile', None)
    if profile and profile.role in {'BRANCH_ADMIN', 'CASHIER', 'STAFF'}:
        if not profile.branch_id:
            return queryset.none()
        return queryset.filter(branch_id=profile.branch_id)
    return queryset


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


# ============ VSS SERVICES VIEWSET ============
class VSSServiceViewSet(viewsets.ModelViewSet):
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


# ============ VREAL PRODUCTS VIEWSET ============
class VRealProductViewSet(viewsets.ModelViewSet):
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


class BBProductViewSet(viewsets.ModelViewSet):
    queryset = BBProduct.objects.filter(is_active=True).order_by('-updated_at')
    serializer_class = BBProductSerializer
    permission_classes = [RoleBasedPermission]


class PangananMenuViewSet(viewsets.ModelViewSet):
    queryset = PangananMenu.objects.filter(is_active=True).order_by('-updated_at')
    serializer_class = PangananMenuSerializer
    permission_classes = [RoleBasedPermission]
    
    @action(detail=False, methods=['get'])
    def categories(self, request):
        categories = PangananMenu.objects.values_list('category', flat=True).distinct()
        return Response([c for c in categories if c])


class KBItemViewSet(viewsets.ModelViewSet):
    queryset = KBItem.objects.filter(is_active=True)
    serializer_class = KBItemSerializer
    permission_classes = [RoleBasedPermission]


class AutoSpaServiceViewSet(viewsets.ModelViewSet):
    queryset = AutoSpaService.objects.filter(is_active=True)
    serializer_class = AutoSpaServiceSerializer
    permission_classes = [RoleBasedPermission]


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.select_related('user', 'branch').prefetch_related('services').all()
    serializer_class = UserProfileSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)


# ============ INVENTORY MANAGEMENT ============
class BranchViewSet(viewsets.ModelViewSet):
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


class ProductViewSet(viewsets.ModelViewSet):
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


class BranchInventoryViewSet(viewsets.ModelViewSet):
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


# ============ CLIENT MANAGEMENT ============
class ClientProfileViewSet(viewsets.ModelViewSet):
    queryset = ClientProfile.objects.all()
    serializer_class = ClientProfileSerializer
    permission_classes = [RoleBasedPermission]
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '')
        clients = ClientProfile.objects.filter(
            Q(first_name__icontains=query) | 
            Q(last_name__icontains=query) |
            Q(phone_number__icontains=query)
        )
        serializer = self.get_serializer(clients, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        client = self.get_object()
        transactions = Transaction.objects.filter(customer=client)
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data)


# ============ ROOM MANAGEMENT ============
class RoomTableViewSet(viewsets.ModelViewSet):
    queryset = RoomTable.objects.all()
    serializer_class = RoomTableSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        return branch_scoped_queryset(super().get_queryset(), self.request)
    
    @action(detail=False, methods=['get'])
    def available(self, request):
        rooms = RoomTable.objects.filter(is_occupied=False)
        serializer = self.get_serializer(rooms, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def occupied(self, request):
        rooms = RoomTable.objects.filter(is_occupied=True)
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
        room.save()
        
        serializer = self.get_serializer(room)
        return Response(serializer.data)


# ============ TRANSACTION MANAGEMENT ============
class TransactionViewSet(viewsets.ModelViewSet):
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

        if not branch_id or not items:
            return Response(
                {'detail': 'A branch and at least one item are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if discount < 0 or amount_paid < 0:
            return Response(
                {'detail': 'Discount and payment cannot be negative.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            branch = Branch.objects.get(pk=branch_id, is_active=True)
            customer = ClientProfile.objects.get(pk=customer_id) if customer_id else None
        except (Branch.DoesNotExist, ClientProfile.DoesNotExist):
            return Response(
                {'detail': 'The selected branch or customer does not exist.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = getattr(request.user, 'profile', None)
        if profile and profile.role in {'BRANCH_ADMIN', 'CASHIER', 'STAFF'} and profile.branch_id != branch.id:
            return Response(
                {'detail': 'You can only transact for your assigned branch.'},
                status=status.HTTP_403_FORBIDDEN,
            )

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
                        inventory = BranchInventory.objects.select_for_update().get(
                            branch=branch,
                            product=product,
                        )
                        if inventory.stock_qty < quantity:
                            raise ValueError(f'Insufficient stock for {product.name}.')
                        description = product.name
                        price = product.selling_price
                    else:
                        service = VSSService.objects.get(
                            pk=submitted_item.get('service'),
                            is_active=True,
                        )
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

                total = max(Decimal('0'), subtotal - discount)
                if amount_paid < total:
                    raise ValueError('Payment is less than the transaction total.')

                transaction_record = Transaction.objects.create(
                    transaction_number=f"TXN-{timezone.now():%Y%m%d}-{uuid4().hex[:8].upper()}",
                    branch=branch,
                    transaction_type='SALE',
                    customer=customer,
                    staff=request.user,
                    subtotal=subtotal,
                    discount=discount,
                    total=total,
                    amount_paid=amount_paid,
                    change=amount_paid - total,
                    status='PAID',
                    notes=request.data.get('notes', ''),
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

                daily_sales, _ = DailySales.objects.get_or_create(
                    branch=branch,
                    date=timezone.localdate(),
                )
                daily_sales.total_sales = Decimal(str(daily_sales.total_sales or 0)) + total
                daily_sales.transaction_count += 1
                daily_sales.save(update_fields=['total_sales', 'transaction_count', 'updated_at'])

        except (Product.DoesNotExist, VSSService.DoesNotExist, BranchInventory.DoesNotExist) as error:
            return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)
        except (TypeError, ValueError) as error:
            return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(self.get_serializer(transaction_record).data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        today = timezone.now().date()
        transactions = Transaction.objects.filter(created_at__date=today)
        serializer = self.get_serializer(transactions, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        today = timezone.now().date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)
        
        today_sales = Transaction.objects.filter(
            created_at__date=today,
            transaction_type='SALE'
        ).aggregate(
            total=Sum('total'),
            count=Count('id')
        )
        
        week_sales = Transaction.objects.filter(
            created_at__date__gte=week_ago,
            transaction_type='SALE'
        ).aggregate(total=Sum('total'))
        
        month_sales = Transaction.objects.filter(
            created_at__date__gte=month_ago,
            transaction_type='SALE'
        ).aggregate(total=Sum('total'))
        
        return Response({
            'today': {
                'total': today_sales['total'] or 0,
                'count': today_sales['count'] or 0
            },
            'weekly': week_sales['total'] or 0,
            'monthly': month_sales['total'] or 0
        })


# ============ DASHBOARD STATS ============
class DashboardStatsViewSet(viewsets.ViewSet):
    permission_classes = [RoleBasedPermission]
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        today = timezone.now().date()
        
        active_rooms = RoomTable.objects.filter(is_occupied=True).count()
        total_rooms = RoomTable.objects.count()
        available_staff = User.objects.filter(is_active=True).count()
        
        low_stock = Product.objects.filter(is_active=True)
        low_stock_count = sum(1 for p in low_stock if p.is_low_stock)
        
        today_sales = Transaction.objects.filter(
            created_at__date=today,
            transaction_type='SALE'
        ).aggregate(total=Sum('total'))['total'] or 0
        
        total_products = Product.objects.filter(is_active=True).count()
        total_services = VSSService.objects.filter(is_active=True).count()
        
        return Response({
            'active_rooms': active_rooms,
            'total_rooms': total_rooms,
            'available_staff': available_staff,
            'low_stock_count': low_stock_count,
            'today_sales': today_sales,
            'total_products': total_products,
            'total_services': total_services,
        })