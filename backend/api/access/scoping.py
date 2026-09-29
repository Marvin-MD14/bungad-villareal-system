# backend/api/access/scoping.py
"""Automatic query scoping driven by BusinessMiddleware.

Replaces the hand-written ``branch_scoped_queryset()`` helper that had to be
remembered at 13 different call sites.  The rules, in order:

1. ``company_wide`` grants (OWNER / COMPANY_ADMIN / ACCOUNTANT / superuser)
   see everything — no narrowing.
2. An active-business user only sees rows of their active business.
   Cross-business rows are hidden *before* any branch check runs.  The
   explicit ``business`` query/body parameter is ignored unless it names
   the active business (or the caller is company-wide).
3. ``allowed_branch_ids`` from the grant narrows rows to those branches.
4. Accounts that predate ``UserAccess`` fall back to the legacy
   ``UserProfile.branch`` for branch roles, so existing behaviour is kept
   until every account has a grant row.

Everything fails closed against the active business; branch narrowing comes
afterwards, never instead of the business filter.
"""

from api.access.context import ensure_business_context

BRANCH_ROLES = {'BRANCH_ADMIN', 'CASHIER', 'STAFF'}


def _lookup_exists(model, lookup):
    """True when ``lookup`` (e.g. ``branch_id``, ``inventory_levels__branch_id``)
    is a valid path on ``model`` — some models only carry a ``business`` FK."""
    from django.core.exceptions import FieldDoesNotExist

    base = lookup.split('__', 1)[0]
    if base == 'pk':
        return True
    try:
        model._meta.get_field(base)
        return True
    except FieldDoesNotExist:
        return hasattr(model, base)


def auto_scope(queryset, request, branch_lookup='branch_id'):
    """Narrow ``queryset`` to what ``request.user`` may see."""
    if request is None:
        return queryset
    ensure_business_context(request)  # grant may only now be resolvable (token auth)
    if getattr(request, 'company_wide', False):
        return queryset

    model = queryset.model
    field_names = {f.name for f in model._meta.fields}
    business = getattr(request, 'business', None)

    if business is not None and 'business' in field_names:
        # Business filter FIRST, and always ANDed with everything else.
        # A ``business`` query param / body value that names a *different*
        # business than the active grant is not authoritative, so it is
        # neutralised here; the grant's business wins.
        param_business = getattr(request, 'query_params', {}).get('business')
        if param_business and str(param_business) != str(business.pk):
            return queryset.none()
        queryset = queryset.filter(business=business)
    elif business is not None and 'branch' in field_names:
        queryset = queryset.filter(branch__business=business)

    allowed = list(getattr(request, 'allowed_branch_ids', None) or [])
    if allowed and _lookup_exists(model, branch_lookup):
        queryset = queryset.filter(**{f'{branch_lookup}__in': allowed})
        if '__' in branch_lookup:
            queryset = queryset.distinct()
        return queryset
    if allowed:
        return queryset  # business filter above already applied

    # No branch restriction on the grant: only users without any grant fall
    # back to the legacy single-branch profile behaviour.
    if getattr(request, 'access', None) is None and _lookup_exists(model, branch_lookup):
        profile = getattr(getattr(request, 'user', None), 'profile', None)
        if profile and profile.role in BRANCH_ROLES:
            if not profile.branch_id:
                return queryset.none()
            queryset = queryset.filter(**{branch_lookup: profile.branch_id})
            if '__' in branch_lookup:
                queryset = queryset.distinct()
    return queryset


class ScopedQuerysetMixin:
    """Give a viewset automatic business/branch scoping.

    Set ``branch_lookup`` to the ORM path that maps a row to a branch when it
    is not a plain ``branch_id`` (e.g. ``inventory_levels__branch_id`` for
    the unified catalog, or ``pk`` for Branch itself).
    """

    branch_lookup = 'branch_id'

    def get_queryset(self):
        return auto_scope(super().get_queryset(), self.request, self.branch_lookup)
