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
from rest_framework.exceptions import AuthenticationFailed

from api.access.context import apply_business_context


class BusinessContextMixin:
    """Apply the business context after any successful authentication."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            apply_business_context(request, result[0])
        return result


class DeviceTokenAuthentication(BusinessContextMixin, authentication.BaseAuthentication):
    """``Authorization: Token <key>`` against a :class:`DeviceToken` (§7.9).

    This replaces DRF's stock ``TokenAuthentication``, which accepts a single
    immortal row per user.  Here every request re-checks the credential, so a
    token that was rotated, revoked, expired, or orphaned by a password change
    stops working the moment that happens — not whenever an admin thinks to
    delete it.  The wire format is unchanged (``Token <key>``), so existing POS
    clients keep authenticating without a change.
    """

    keyword = 'Token'

    def authenticate(self, request):
        from api.access.models import DeviceToken  # local import: app-loading order

        header = authentication.get_authorization_header(request).split()
        if not header or header[0].lower() != self.keyword.lower().encode():
            return None
        if len(header) == 1:
            raise AuthenticationFailed('Invalid token header. No credentials provided.')
        if len(header) > 2:
            raise AuthenticationFailed('Invalid token header. Token string should not contain spaces.')

        try:
            key = header[1].decode()
        except UnicodeError:
            raise AuthenticationFailed(
                'Invalid token header. Token string should not contain invalid characters.'
            )

        token = DeviceToken.objects.select_related('user').filter(key=key).first()
        if token is None:
            raise AuthenticationFailed('Invalid token.')

        # Each failure gets its own message so a client can tell "log in again"
        # apart from "this session was cut off" — a rotated or revoked key is a
        # deliberate event, an expired one is routine.
        if token.is_revoked:
            raise AuthenticationFailed('This token has been revoked. Please sign in again.')
        if token.is_expired:
            raise AuthenticationFailed('This token has expired. Please sign in again.')
        if token.is_stale:
            # The password changed: burn the credential rather than leave a
            # stale one lingering in the table.
            token.revoke()
            raise AuthenticationFailed(
                'The password has changed. Please sign in again.'
            )
        if not token.user.is_active:
            raise AuthenticationFailed('User inactive or deleted.')

        token.touch()
        return (token.user, token)

    def authenticate_header(self, request):
        return self.keyword


try:  # pragma: no cover - only exercised when drf-spectacular is installed
    from drf_spectacular.extensions import OpenApiAuthenticationExtension

    class DeviceTokenScheme(OpenApiAuthenticationExtension):
        """Keep documenting the credentials as ``Token <key>`` in the schema.

        drf-spectacular ships an extension for DRF's own ``TokenAuthentication``
        but not for this one; without it the generated OpenAPI would quietly
        drop the security scheme from every endpoint.
        """

        target_class = 'api.access.authentication.DeviceTokenAuthentication'
        name = 'TokenAuth'

        def get_security_definition(self, auto_schema):
            return {
                'type': 'apiKey',
                'in': 'header',
                'name': 'Authorization',
                'description': 'Device token, sent as `Token <key>`. Expires; rotate at '
                               'POST /api/auth/rotate-token/.',
            }
except ImportError:  # pragma: no cover
    pass


class BusinessSessionAuthentication(BusinessContextMixin, authentication.SessionAuthentication):
    pass
