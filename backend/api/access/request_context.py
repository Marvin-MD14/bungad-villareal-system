# backend/api/access/request_context.py
"""Request-scoped context vars — deliberately free of Django model imports.

``LOGGING`` is configured by ``django.setup()`` *before* the app registry is
ready, so :mod:`api.access.logging` (the JSON formatter) must not import
anything that defines a model.  Keeping the context vars in their own module
means the formatter can read the business/user/request ids at any time, while
:mod:`api.access.managers` simply re-exports them next to the managers that use
them.
"""

from contextvars import ContextVar

_active_business = ContextVar('active_business', default=None)
_company_wide = ContextVar('company_wide', default=False)
_in_request = ContextVar('in_request', default=False)
_log_context = ContextVar('log_context', default=None)


def set_business_context(business, company_wide=False):
    _active_business.set(business)
    _company_wide.set(company_wide)


def get_active_business():
    return _active_business.get()


def is_company_wide():
    return _company_wide.get()


def set_in_request(value):
    """Mark that we are inside a handled request (set by ``BusinessMiddleware``)."""
    _in_request.set(bool(value))


def is_in_request():
    """True while a request is being served.

    ``BusinessScopedManager`` uses this to tell the two "no business" cases
    apart: *inside* a request that means "no grant resolved" and must fail
    closed (``qs.none()``), while *outside* a request (management commands,
    shell, tests doing direct ORM work) system-wide access is the only sensible
    answer — and is what ``all_objects`` would give anyway.
    """
    return _in_request.get()


def clear_context():
    """Reset every request-scoped context var (the middleware's ``finally``)."""
    set_business_context(None, False)
    set_in_request(False)
    _log_context.set(None)


def set_log_context(**fields):
    """Merge ``fields`` into the context every JSON log line is stamped with (§7.11)."""
    context = dict(_log_context.get() or {})
    context.update({key: value for key, value in fields.items() if value is not None})
    _log_context.set(context)
    return context


def get_log_context():
    return dict(_log_context.get() or {})
