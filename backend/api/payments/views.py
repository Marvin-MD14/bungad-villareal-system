# backend/api/payments/views.py

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from api.access.context import ensure_business_context
from api.access.scoping import ScopedQuerysetMixin
from api.models import Branch
from api.payments.models import CashierShift, Payment, PaymentMethod
from api.payments.serializers import (
    CashierShiftSerializer,
    PaymentMethodSerializer,
    PaymentSerializer,
)
from api.permissions import RoleBasedPermission, get_effective_role
from api.views import AuditLogMixin


class PaymentMethodViewSet(ScopedQuerysetMixin, AuditLogMixin, viewsets.ModelViewSet):
    """Tender types this business accepts (CASH/GCASH/MAYA/CARD by default)."""

    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer
    permission_classes = [RoleBasedPermission]


class PaymentViewSet(ScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """The tender ledger: one row per tender against a receipt."""

    queryset = Payment.objects.select_related('method', 'transaction').all()
    serializer_class = PaymentSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        transaction_id = self.request.query_params.get('transaction')
        if transaction_id:
            qs = qs.filter(transaction_id=transaction_id)
        shift_id = self.request.query_params.get('shift')
        if shift_id:
            qs = qs.filter(shift_id=shift_id)
        return qs


class CashierShiftViewSet(ScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Till sessions. Opening/closing happen through explicit actions."""

    queryset = CashierShift.objects.select_related('branch', 'staff').all()
    serializer_class = CashierShiftSerializer
    permission_classes = [RoleBasedPermission]

    MANAGER_ROLES = {'SUPERADMIN', 'OWNER', 'COMPANY_ADMIN', 'BUSINESS_MANAGER', 'SUPERVISOR'}

    def _branch_authority(self, branch):
        from api.views import TransactionViewSet  # local: avoids import cycle

        return TransactionViewSet._branch_allowed_for_request(branch, self.request)

    @action(detail=False, methods=['post'], url_path='open')
    def open_shift(self, request):
        ensure_business_context(request)
        branch_id = request.data.get('branch')
        try:
            opening_float = float(request.data.get('opening_float', 0) or 0)
        except (TypeError, ValueError):
            return Response({'detail': 'opening_float must be a number.'}, status=400)
        if opening_float < 0:
            return Response({'detail': 'opening_float cannot be negative.'}, status=400)
        branch = Branch.all_objects.filter(pk=branch_id, is_active=True).first()
        if branch is None:
            return Response({'detail': 'Branch not found.'}, status=400)
        if not self._branch_authority(branch):
            return Response(
                {'detail': 'You can only open a shift at your assigned branch.'}, status=403,
            )
        existing = CashierShift.objects.filter(
            branch=branch, staff=request.user, status='OPEN',
        ).first()
        if existing is not None:
            return Response(
                {'detail': 'You already have an open shift at this branch.',
                 'shift': self.get_serializer(existing).data},
                status=status.HTTP_409_CONFLICT,
            )
        shift = CashierShift.objects.create(
            business=branch.business,
            branch=branch,
            staff=request.user,
            opening_float=opening_float,
            notes=str(request.data.get('notes', ''))[:255],
        )
        return Response(self.get_serializer(shift).data, status=201)

    @action(detail=True, methods=['post'], url_path='close')
    def close_shift(self, request, pk=None):
        shift = self.get_object()
        role = get_effective_role(request)
        if shift.staff_id != request.user.pk and role not in self.MANAGER_ROLES:
            return Response(
                {'detail': 'Only the shift owner or a manager can close this shift.'},
                status=403,
            )
        if shift.status == 'CLOSED':
            return Response({'detail': 'Shift is already closed.'}, status=409)
        raw = request.data.get('closing_cash')
        if raw is None:
            return Response({'detail': 'closing_cash is required.'}, status=400)
        try:
            closing_cash = float(raw)
        except (TypeError, ValueError):
            return Response({'detail': 'closing_cash must be a number.'}, status=400)
        if closing_cash < 0:
            return Response({'detail': 'closing_cash cannot be negative.'}, status=400)
        shift.close(closing_cash)
        return Response(self.get_serializer(shift).data)

    @action(detail=False, methods=['get'])
    def current(self, request):
        """The caller's open shift (managers may pass ?staff=<id>)."""
        staff_id = request.user.pk
        if get_effective_role(request) in self.MANAGER_ROLES and request.query_params.get('staff'):
            staff_id = request.query_params['staff']
        shift = CashierShift.objects.filter(
            staff_id=staff_id, status='OPEN',
        ).select_related('branch', 'staff').first()
        if shift is None:
            return Response({'shift': None})
        return Response({'shift': self.get_serializer(shift).data})
