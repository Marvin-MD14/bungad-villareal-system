# backend/api/loyalty/views.py

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from api.access.context import ensure_business_context
from api.access.scoping import ScopedQuerysetMixin
from api.business.models import Business
from api.loyalty.models import LoyaltyProgram, LoyaltyTransaction
from api.loyalty.serializers import (
    LoyaltyProgramSerializer,
    LoyaltyTransactionSerializer,
)
from api.permissions import RoleBasedPermission
from api.views import AuditLogMixin


class LoyaltyProgramViewSet(ScopedQuerysetMixin, AuditLogMixin, viewsets.ModelViewSet):
    """Per-business earning rules.  Managers edit; POS roles read them."""

    queryset = LoyaltyProgram.objects.select_related('business').all()
    serializer_class = LoyaltyProgramSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        # LoyaltyProgram uses the context-scoped manager AND the viewset
        # scoping mixin; the mixin alone would fight the scoped manager here,
        # so narrow explicitly and let reads through it.
        qs = LoyaltyProgram.objects.all()
        business = getattr(self.request, 'business', None)
        if getattr(self.request, 'company_wide', False) or self.request.user.is_superuser:
            business_id = self.request.query_params.get('business')
            if business_id:
                qs = qs.filter(business_id=business_id)
            return qs
        if business is not None:
            return qs.filter(business=business)
        return qs.none()

    @action(detail=False, methods=['get'], url_path='for-current-business')
    def for_current_business(self, request):
        """The active business's program, created with defaults on first call."""
        ensure_business_context(request)
        business = getattr(request, 'business', None)
        if business is None:
            business_id = request.query_params.get('business')
            business = Business.objects.filter(pk=business_id).first() if business_id else None
        if business is None:
            return Response(
                {'detail': 'No active business — pass ?business=<id>.'}, status=400,
            )
        program = LoyaltyProgram.for_business(business)
        return Response(self.get_serializer(program).data)


class LoyaltyTransactionViewSet(ScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """The append-only points ledger (filter with ?customer=<id>)."""

    queryset = LoyaltyTransaction.objects.select_related(
        'customer', 'transaction', 'created_by',
    ).all()
    serializer_class = LoyaltyTransactionSerializer
    permission_classes = [RoleBasedPermission]
    business_lookup = 'customer__business'

    def get_queryset(self):
        qs = super().get_queryset()
        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        return qs
