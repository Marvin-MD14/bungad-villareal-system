# backend/api/views.py

from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import datetime, timedelta
from .models import *
from .serializers import *


# ============ VSS SERVICES VIEWSET ============
class VSSServiceViewSet(viewsets.ModelViewSet):
    queryset = VSSService.objects.filter(is_active=True).order_by('category', 'description')
    serializer_class = VSSServiceSerializer
    permission_classes = [AllowAny]
    
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
    permission_classes = [AllowAny]
    
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
    permission_classes = [AllowAny]


class PangananMenuViewSet(viewsets.ModelViewSet):
    queryset = PangananMenu.objects.filter(is_active=True).order_by('-updated_at')
    serializer_class = PangananMenuSerializer
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['get'])
    def categories(self, request):
        categories = PangananMenu.objects.values_list('category', flat=True).distinct()
        return Response([c for c in categories if c])


class KBItemViewSet(viewsets.ModelViewSet):
    queryset = KBItem.objects.filter(is_active=True)
    serializer_class = KBItemSerializer
    permission_classes = [AllowAny]


class AutoSpaServiceViewSet(viewsets.ModelViewSet):
    queryset = AutoSpaService.objects.filter(is_active=True)
    serializer_class = AutoSpaServiceSerializer
    permission_classes = [AllowAny]


# ============ INVENTORY MANAGEMENT ============
class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.filter(is_active=True)
    serializer_class = BranchSerializer
    permission_classes = [AllowAny]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.filter(is_active=True)
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]
    
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
    permission_classes = [AllowAny]
    
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
    permission_classes = [AllowAny]
    
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
    permission_classes = [AllowAny]
    
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
    permission_classes = [AllowAny]
    
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
    permission_classes = [AllowAny]
    
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