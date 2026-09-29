# backend/api/business/views.py

from rest_framework import viewsets, filters
from api.business.models import BusinessType, Business
from api.business.serializers import BusinessTypeSerializer, BusinessSerializer
from api.permissions import RoleBasedPermission


class BusinessTypeViewSet(viewsets.ModelViewSet):
    queryset = BusinessType.objects.all()
    serializer_class = BusinessTypeSerializer
    permission_classes = [RoleBasedPermission]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'code']


class BusinessViewSet(viewsets.ModelViewSet):
    queryset = Business.objects.select_related('business_type').all()
    serializer_class = BusinessSerializer
    permission_classes = [RoleBasedPermission]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'slug']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser or getattr(self.request, 'company_wide', False):
            return qs
        # Company-wide grants (business=None) see every business
        if user.access_grants.filter(is_active=True, business__isnull=True).exists():
            return qs
        accessible_biz_ids = user.access_grants.filter(
            is_active=True, business__isnull=False
        ).values_list('business_id', flat=True)
        return qs.filter(id__in=list(accessible_biz_ids))
