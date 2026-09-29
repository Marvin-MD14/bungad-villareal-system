# backend/api/access/views.py

from rest_framework import viewsets
from api.access.models import UserAccess
from api.access.serializers import UserAccessSerializer
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
