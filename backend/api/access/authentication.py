# backend/api/access/authentication.py
"""Authentication classes that also resolve the active business.

DRF only knows the user once an authentication class has run, which is *after*
``BusinessMiddleware``.  These wrappers resolve the grant immediately after a
successful authentication so ``request.business`` / ``request.access`` /
``request.company_wide`` / ``request.allowed_branch_ids`` are correct for every
API call.

``api.access.scoping.auto_scope`` and the access permission classes additionally
call ``ensure_business_context()`` lazily, which keeps things correct for paths
that never reach these classes (``APIClient.force_authenticate`` in tests,
custom authentication added later, etc.).
"""

from rest_framework import authentication

from api.access.context import apply_business_context


class BusinessContextMixin:
    """Apply the business context after any successful authentication."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            apply_business_context(request, result[0])
        return result


class BusinessTokenAuthentication(BusinessContextMixin, authentication.TokenAuthentication):
    pass


class BusinessSessionAuthentication(BusinessContextMixin, authentication.SessionAuthentication):
    pass
