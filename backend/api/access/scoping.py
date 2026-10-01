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
4. An authenticated user with **no** grant sees nothing (fail closed).  The old
   ``UserProfile.branch`` fallback disappeared with §4.4/§6.3.

Everything fails closed against the active business; branch narrowing comes
afterwards, never instead of the business filter.
"""

from api.access.context import ensure_business_context


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


def auto_scope(queryset, request, branch_lookup='branch_id', business_lookup=None):
    """Narrow ``queryset`` to what ``request.user`` may see.

    ``business_lookup`` names the ORM path from a row to its owning business for
    models that have no ``business`` column of their own but inherit the tenant
    through a relation (a reward belongs to the business that owns its
    ``customer``).

    Every branch of the rule fails *closed*: an authenticated user with no
    resolvable grant gets ``none()`` rather than the whole company.  Before
    §6.3's role unification a grant-less account fell back to
    ``UserProfile.branch``; that fallback is gone, so a forgotten grant can
    never silently widen access.
    """
    if request is None:
        return queryset
    ensure_business_context(request)  # grant may only now be resolvable (token auth)

    user = getattr(request, 'user', None)
    if user is not None and getattr(user, 'is_superuser', False):
        return queryset
    if getattr(request, 'company_wide', False):
        return queryset
    if getattr(request, 'access', None) is None:
        # No grant at all: nothing is visible.  The API answers 403 through
        # RoleBasedPermission for write endpoints and an empty list for reads.
        return queryset.none()

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
    elif business is not None and business_lookup and _lookup_exists(model, business_lookup):
        # No business/branch column of its own: inherit the tenant through a
        # relation (e.g. a reward inherits its customer's business).
        queryset = queryset.filter(**{business_lookup: business}).distinct()

    allowed = list(getattr(request, 'allowed_branch_ids', None) or [])
    if allowed and _lookup_exists(model, branch_lookup):
        queryset = queryset.filter(**{f'{branch_lookup}__in': allowed})
        if '__' in branch_lookup:
            queryset = queryset.distinct()
    return queryset


def assert_branch_in_active_business(branch, request):
    """Reject a branch that belongs to a different business (400, not a mis-stamp).

    ``auto_scope`` already hides foreign rows on reads; this closes the write
    side, so a business-scoped user cannot file an expense / room / attendance
    row against another business's outlet.
    """
    from rest_framework.exceptions import ValidationError

    if branch is None or request is None:
        return branch
    ensure_business_context(request)
    business = getattr(request, 'business', None)
    if business is not None and branch.business_id not in (None, business.pk):
        raise ValidationError(
            {'branch': f'{branch.name} does not belong to the active business.'}
        )
    return branch


class ScopedQuerysetMixin:
    """Give a viewset automatic business/branch scoping.

    Set ``branch_lookup`` to the ORM path that maps a row to a branch when it
    is not a plain ``branch_id`` (e.g. ``inventory_levels__branch_id`` for
    the unified catalog, or ``pk`` for Branch itself).
    """

    branch_lookup = 'branch_id'
    # For models with no business/branch column of their own, the path to the
    # owning business (e.g. 'customer__business' for CustomerReward).
    business_lookup = None

    def get_queryset(self):
        return auto_scope(
            super().get_queryset(), self.request, self.branch_lookup, self.business_lookup,
        )
