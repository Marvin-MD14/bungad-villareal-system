# backend/core/urls.py

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include  # <- DAPAT MAY INCLUDE DITO
from django.views.generic.base import RedirectView

from core.health import healthz, readyz

urlpatterns = [
    # Liveness / readiness probes (§7.11) — deliberately outside /api/ so a load
    # balancer or orchestrator can reach them without authentication.
    path('healthz', healthz, name='healthz'),
    path('readyz', readyz, name='readyz'),
    # Convenience redirects: the docs really live under /api/ (api/urls.py), but
    # everyone types /docs/ eventually. 302 keeps them bookmarkable either way.
    path('docs/', RedirectView.as_view(url='/api/docs/', permanent=False)),
    path('redoc/', RedirectView.as_view(url='/api/redoc/', permanent=False)),
    path('schema/', RedirectView.as_view(url='/api/schema/', permanent=False)),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),  # <- IDAGDAG ITO!
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
