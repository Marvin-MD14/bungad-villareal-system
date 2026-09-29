# backend/api/access/middleware.py

from api.access.context import apply_business_context
from api.access.managers import set_business_context


class BusinessMiddleware:
    """Resolve the active business once per request, then fail closed.

    Runs early so session traffic is covered; token-auth traffic is covered by
    :mod:`api.access.authentication`, which re-applies the same context once
    DRF has resolved the user.  Either way the context vars are cleared when
    the response leaves, so nothing leaks between requests.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        apply_business_context(request)
        try:
            return self.get_response(request)
        finally:
            set_business_context(None, False)  # never leak context between requests

