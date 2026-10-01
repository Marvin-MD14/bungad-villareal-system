"""Structural guard against unscoped endpoints.

Business isolation is enforced in two independent places: the fail-closed
manager on a business-scoped model, and ``ScopedQuerysetMixin`` on the viewset.
Getting a new endpoint right therefore means remembering two things — and a
developer who forgets the second silently ships a cross-tenant read.

Nothing failed loudly about that before. This check makes it loud: it walks
every registered router and errors when a viewset exposes a model that carries
a ``business`` foreign key without also declaring the scoping mixin.

Run automatically by ``manage.py check`` (and therefore by CI).

Usage::

    python manage.py check

If you add a viewset over a business-scoped model and forget the mixin, the
command fails with ``api.E001`` instead of shipping a cross-tenant endpoint.
To mark an endpoint as deliberately platform-wide, add its class name to
``ALLOWED_UNSCOPED`` **with a comment saying why** — that allowlist is the
only thing separating a considered decision from an accident.
"""

from django.core.checks import Error, register


# Endpoints that are intentionally not business-scoped, and why.  Keep this list
# short and justify every entry — it is the only thing standing between a
# deliberate platform-wide endpoint and an accidental one.
ALLOWED_UNSCOPED = {
    'BusinessViewSet': 'the Business row IS the isolation boundary; only SUPERADMIN may touch it',
    'BusinessTypeViewSet': 'platform catalogue of business types, not tenant data',
    'CompanyViewSet': 'singleton company settings, admin-only',
    'UserProfileViewSet': 'profile carries no business; role/branch come from its grants',
    'UserAccessViewSet': (
        'get_queryset() narrows to qs.filter(user=user) — a caller only ever sees '
        'their own grants, which is stricter than business scoping, not looser'
    ),
    'CustomerTierViewSet': 'action-only viewset, no queryset',
    'CustomerDetectionViewSet': 'action-only viewset, no queryset',
    'NotificationViewSet': 'action-only viewset, no queryset',
    'DashboardStatsViewSet': 'read-only aggregate, scoped per branch in the view',
    'BranchCatalogViewSet': 'action-only viewset, no queryset',
}


def _model_of(viewset):
    queryset = getattr(viewset, 'queryset', None)
    return getattr(queryset, 'model', None)


def _has_business_field(model):
    return any(f.name == 'business' for f in model._meta.fields)


@register()
def check_viewsets_are_business_scoped(app_configs=None, **kwargs):
    """Error on a viewset that serves a business-scoped model without scoping."""
    from rest_framework.viewsets import ModelViewSet

    from api.access.scoping import ScopedQuerysetMixin
    from api.urls import router

    errors = []
    for prefix, viewset, _basename in router.registry:
        if not issubclass(viewset, ModelViewSet):
            continue
        if viewset.__name__ in ALLOWED_UNSCOPED:
            continue

        model = _model_of(viewset)
        if model is None or not _has_business_field(model):
            continue

        if issubclass(viewset, ScopedQuerysetMixin):
            continue

        errors.append(Error(
            f"'{viewset.__name__}' serves '{model.__name__}', which carries a "
            f"'business' foreign key, but does not use ScopedQuerysetMixin.",
            hint=(
                f"Add ScopedQuerysetMixin to {viewset.__name__} so list/retrieve "
                f"are narrowed to the caller's active business. If this endpoint "
                f"is genuinely platform-wide, add it to ALLOWED_UNSCOPED in "
                f"api/checks.py with a comment saying why."
            ),
            id='api.E001',
        ))
    return errors
