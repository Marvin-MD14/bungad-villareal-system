# backend/api/access/context.py
"""Single place that decides *which business a request is acting on*.

Two entry points feed it, because the user is only known at two different
stages of a request:

* ``BusinessMiddleware`` — runs early and covers session-authenticated /
  Django-admin traffic, where ``AuthenticationMiddleware`` already filled in
  ``request.user``.
* ``api.access.authentication`` — DRF token (and session) auth resolves the
  user much later, inside ``APIView.initial()``.  Without this second hook the
  whole access stack would silently see ``AnonymousUser`` for every POS/API
  call, so scoping would fall back to the legacy profile branch only.

Both write the same four attributes (on the underlying ``HttpRequest`` *and*
the DRF ``Request`` wrapper, whichever was handed in) plus the context-var
used by :mod:`api.access.managers`:

``request.access``              the chosen :class:`~api.access.models.UserAccess`
``request.business``            its business (``None`` for company-wide grants)
``request.company_wide``        True for OWNER / COMPANY_ADMIN / ACCOUNTANT
``request.allowed_branch_ids``  branch ids narrowed by the grant (empty = all)
"""

import logging

from api.access.managers import set_business_context

logger = logging.getLogger(__name__)

BUSINESS_HEADER = 'X-Business'
CONTEXT_ATTRS = ('access', 'business', 'company_wide', 'allowed_branch_ids')

_UNSET = object()  # distinguishes "no header passed" from "header is None"
_UNRESOLVED = object()  # request has never had its context computed


def _target(request):
    """The object(s) that must carry the context attributes."""
    underlying = getattr(request, '_request', None)
    return [request] if underlying is None else [underlying, request]


def _reset(request):
    for request_obj in _target(request):
        request_obj.access = None
        request_obj.business = None
        request_obj.company_wide = False
        request_obj.allowed_branch_ids = []


def resolve_grant(user, header=None):
    """Pick the active grant for ``user``: explicit header → primary → first."""
    from api.access.models import UserAccess  # local import: avoid app-loading cycle

    grants = UserAccess.objects.filter(user=user, is_active=True).select_related('business')
    if header:
        chosen = grants.filter(business__slug=header).first()
        if chosen is not None:
            return chosen
        # Unknown / unauthorized slug: never grant, fall back to a real grant.
        logger.debug('Ignored X-Business header %r for user %s', header, user.pk)
    return grants.filter(is_primary=True).first() or grants.first()


def apply_business_context(request, user=None, header=_UNSET):
    """Resolve and attach the business context for ``request``.

    Safe to call twice (middleware then DRF auth); it always recomputes from
    scratch so a spoofed header can only ever *narrow* access, never widen it.
    """
    if user is None:
        user = getattr(request, 'user', None)
    if header is _UNSET:
        header = request.headers.get(BUSINESS_HEADER) if hasattr(request, 'headers') else None

    _reset(request)
    user_pk = getattr(user, 'pk', None) if user is not None else None
    if user is None or not getattr(user, 'is_authenticated', False):
        for request_obj in _target(request):
            request_obj._business_context_for = user_pk
        set_business_context(None, False)
        return request

    grant = resolve_grant(user, header)
    if grant is None:
        for request_obj in _target(request):
            request_obj._business_context_for = user_pk
        set_business_context(None, False)
        return request

    company_wide = grant.is_company_wide
    for request_obj in _target(request):
        request_obj.access = grant
        request_obj.business = grant.business  # None for company-wide roles
        request_obj.company_wide = company_wide
        request_obj.allowed_branch_ids = grant.branch_ids()
        request_obj._business_context_for = user_pk
    set_business_context(grant.business, company_wide)
    return request


def ensure_business_context(request):
    """Resolve the context on demand, at most once per authenticated user.

    ``BusinessMiddleware`` runs before DRF authenticates a token (and before
    ``APIClient.force_authenticate`` in tests), so at that stage the user is
    still anonymous.  Every place that *consumes* the context calls this first;
    by then ``request.user`` is resolved, so the grant lookup is accurate.  A
    request whose user was already stamped is returned untouched — repeated
    calls (scoping + permission + object check) cost nothing extra.
    """
    user = getattr(request, 'user', None)
    user_pk = getattr(user, 'pk', None) if user is not None else None
    stamped = getattr(request, '_business_context_for', _UNRESOLVED)
    if stamped == user_pk and stamped is not _UNRESOLVED:
        return request
    if user is None or not getattr(user, 'is_authenticated', False):
        # Anonymous: keep whatever the middleware resolved (nothing) and don't
        # hit the DB. Views still fail closed via IsAuthenticated.
        if stamped is _UNRESOLVED:
            apply_business_context(request, user, header=None)
        return request
    return apply_business_context(request, user)

