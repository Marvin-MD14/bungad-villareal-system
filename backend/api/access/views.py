# backend/api/access/views.py

from rest_framework import viewsets
from api.access.models import UserAccess
from api.access.serializers import UserAccessSerializer
from api.access.staffing import check_staffing_change
from api.permissions import RoleBasedPermission


class UserAccessViewSet(viewsets.ModelViewSet):
    queryset = UserAccess.objects.select_related('user', 'business').prefetch_related('branches').all()
    serializer_class = UserAccessSerializer
    permission_classes = [RoleBasedPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser or getattr(self.request, 'company_wide', False):
            return qs
        return qs.filter(user=user)

    def perform_destroy(self, instance):
        # Deleting the grant that is an outlet's last manager/cashier — or that
        # would drop its staff below two — answers 400 instead of gutting it
        # (§ api.access.staffing).
        check_staffing_change(
            role=instance.role, business=instance.business,
            branch_ids=instance.branch_ids(), is_active=False,
            exclude_grant_id=instance.pk,
        )
        instance.delete()
