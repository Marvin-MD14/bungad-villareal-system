# backend/core/health.py
"""Liveness (``/healthz``) and readiness (``/readyz``) probes (§7.11).

* ``/healthz`` answers "is this process alive?" and must never touch the
  database — an orchestrator restarts the container when it fails.
* ``/readyz`` answers "can this process serve traffic?" by actually checking the
  database (``SELECT 1``) and the cache, and returns **503** with a per-check
  breakdown when something is down, so a load balancer takes it out of rotation
  instead of serving 500s.
"""

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse

SERVICE = 'bungad-villareal-api'


def _check_database():
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
        cursor.fetchone()
    return {'status': 'ok', 'vendor': connection.vendor}


def _check_cache():
    cache.set('readyz', 'ok', 5)
    if cache.get('readyz') != 'ok':
        raise RuntimeError('cache round-trip failed')
    return {'status': 'ok', 'backend': cache.__class__.__name__}


def healthz(request):
    """Liveness: process is up. No dependency checks, always cheap."""
    return JsonResponse({'status': 'ok', 'service': SERVICE})


def readyz(request):
    """Readiness: database + cache reachable."""
    checks = {}
    healthy = True
    for name, probe in (('database', _check_database), ('cache', _check_cache)):
        try:
            checks[name] = probe()
        except Exception as error:  # noqa: BLE001 - report, never raise
            healthy = False
            checks[name] = {'status': 'error', 'error': str(error)}

    return JsonResponse(
        {'status': 'ok' if healthy else 'unavailable', 'service': SERVICE, 'checks': checks},
        status=200 if healthy else 503,
    )
