# backend/api/access/middleware.py

import logging
import time
from uuid import uuid4

from api.access.context import apply_business_context
from api.access.request_context import (
    clear_context,
    set_in_request,
    set_log_context,
)

logger = logging.getLogger('api.request')


class RequestIDMiddleware:
    """Attach a ``request_id`` to every request so audit rows are traceable.

    ``AuditLog.request_id`` is only useful if something generates the id; a
    trusted proxy may override it with ``X-Request-ID`` so one request can be
    followed across the proxy, the API and the log line.  The id (plus the HTTP
    method and path) is pushed into the log context, so every JSON line emitted
    while the request runs carries it (§7.11).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = (request.headers.get('X-Request-ID') or uuid4().hex)[:64]
        set_log_context(
            request_id=request.request_id,
            method=request.method,
            path=request.path,
        )
        response = self.get_response(request)
        response['X-Request-ID'] = request.request_id
        return response


class BusinessMiddleware:
    """Resolve the active business once per request, then fail closed.

    Runs early so session traffic is covered; token-auth traffic is covered by
    :mod:`api.access.authentication`, which re-applies the same context once
    DRF has resolved the user.  The context vars are cleared when the response
    leaves, so nothing leaks between requests, and one JSON line per request is
    emitted with the business, user, request id and status (§7.11).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_in_request(True)
        apply_business_context(request)
        started = time.perf_counter()
        try:
            response = self.get_response(request)
            logger.info(
                'request',
                extra={
                    'status_code': getattr(response, 'status_code', None),
                    'duration_ms': round((time.perf_counter() - started) * 1000, 2),
                },
            )
            return response
        finally:
            clear_context()  # never leak context between requests


