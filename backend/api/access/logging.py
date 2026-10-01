# backend/api/access/logging.py
"""JSON log records that always carry the request's business context (§7.11).

A log line is only triageable if it answers *who* did *what*, *in which
business/branch*, *under which request id*.  :class:`JsonBusinessFormatter`
merges the four ids from the context vars written by
:mod:`api.access.context` into every record, so no caller has to remember to
pass them:

    {"level": "INFO", "logger": "api", "message": "request",
     "timestamp": "...", "business_id": 2, "branch_id": 5, "user_id": 7,
     "request_id": "9f3c...", "method": "POST", "path": "/api/transactions/checkout/",
     "status_code": 201, "duration_ms": 41.2}

Records use ``logging``'s ``extra=`` for per-line fields (``method``, ``path``,
``status_code``, ``duration_ms``) which are picked up automatically.
"""

import json
import logging

from api.access.request_context import get_log_context

# Keys the formatter always emits, in this order, before any `extra` fields.
CONTEXT_KEYS = ('business_id', 'branch_id', 'user_id', 'request_id')
EXTRA_KEYS = ('method', 'path', 'status_code', 'duration_ms', 'reason')

# `extra` fields that must NOT leak into the payload (logging internals).
_SKIP = {
    'name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 'filename',
    'module', 'exc_info', 'exc_text', 'stack_info', 'lineno', 'funcName',
    'created', 'msecs', 'relativeCreated', 'thread', 'threadName',
    'processName', 'process', 'taskName', 'message', 'asctime',
}


class JsonBusinessFormatter(logging.Formatter):
    """Render every record as one JSON object including the active business."""

    def format(self, record):
        payload = {
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'timestamp': self.formatTime(record, '%Y-%m-%dT%H:%M:%S%z'),
        }

        context = get_log_context()
        for key in CONTEXT_KEYS:
            value = context.get(key)
            if value is not None:
                payload[key] = value

        # The record's own extras win over the shared context (a caller may
        # deliberately log a different business, e.g. a report spanning two).
        for key in EXTRA_KEYS:
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value

        for key, value in getattr(record, '__dict__', {}).items():
            if key in _SKIP or key in payload or key in CONTEXT_KEYS or key in EXTRA_KEYS:
                continue
            if key.startswith('_'):
                continue
            payload[key] = value

        if record.exc_info:
            payload['exception'] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str)
