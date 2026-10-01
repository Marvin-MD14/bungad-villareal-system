# backend/api/business/views.py

from django.db.models import ProtectedError
from rest_framework import viewsets, filters, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
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

    def _blocking_relations(self, business):
        """Business-owned rows that make a hard delete unsafe.

        Deleting a business cascades to its branches, and sales/stock/rooms
        point at those branches with ``on_delete=PROTECT``.  Without this check
        Django raises ``ProtectedError``, which the API would surface as a 500.
        Counting them up front lets us refuse with an actionable 409 instead.
        """
        from api.models import Expense, InventoryLevel, RoomTable, StockMovement, Transaction
        from api.catalog.models import BusinessItem

        branch_ids = list(business.branches.values_list('id', flat=True))
        blockers = {
            'branches': len(branch_ids),
            'sales': Transaction.objects.filter(branch_id__in=branch_ids).count(),
            'expenses': Expense.objects.filter(branch_id__in=branch_ids).count(),
            'rooms': RoomTable.objects.filter(branch_id__in=branch_ids).count(),
            'stock levels': InventoryLevel.objects.filter(branch_id__in=branch_ids).count(),
            'stock movements': StockMovement.objects.filter(branch_id__in=branch_ids).count(),
            'catalog entries': BusinessItem.objects.filter(business=business).count(),
        }
        return {name: count for name, count in blockers.items() if count}

    def destroy(self, request, *args, **kwargs):
        """Hard-delete a business, refusing when it still owns history.

        §7.10 prefers deactivating (``is_active = False``) over deleting, so a
        business that has ever traded is retired rather than erased; otherwise
        historical reports would silently lose their rows.
        """
        business = self.get_object()
        blockers = self._blocking_relations(business)
        if blockers:
            summary = ', '.join(f'{count} {name}' for name, count in blockers.items())
            return Response(
                {
                    'detail': (
                        f'"{business.name}" still owns {summary}. Deactivate it instead '
                        'of deleting it, so past sales and reports stay intact.'
                    ),
                    'blockers': blockers,
                    'remedy': 'deactivate',
                },
                status=status.HTTP_409_CONFLICT,
            )
        try:
            business.delete()
        except ProtectedError as exc:  # pragma: no cover - belt and braces
            raise ValidationError(str(exc)) from exc
        return Response(status=status.HTTP_204_NO_CONTENT)
