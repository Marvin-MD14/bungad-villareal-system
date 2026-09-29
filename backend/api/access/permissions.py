# backend/api/access/permissions.py

from rest_framework.permissions import BasePermission

from api.access.context import ensure_business_context


def _has_access_context(request):
    """True when a grant (or company-wide access) is resolved for this request."""
    ensure_business_context(request)
    return (
        getattr(request, 'access', None) is not None
        or bool(getattr(request, 'company_wide', False))
    )


class BusinessAccessPermission(BasePermission):
    """User must hold an active grant for a business, or be company-wide / superuser."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return _has_access_context(request)


class BranchScopePermission(BasePermission):
    """Narrows a business grant to specific branches when configured."""

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        _has_access_context(request)  # resolve first: token auth is late-bound
        allowed = getattr(request, 'allowed_branch_ids', []) or []
        if not _has_access_context(request) or not allowed:
            return True  # legacy accounts / company-wide / all branches of the business
        branch_id = getattr(obj, 'branch_id', None)
        return branch_id is None or branch_id in allowed
