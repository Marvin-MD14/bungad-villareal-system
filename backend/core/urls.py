# backend/core/urls.py

from django.contrib import admin
from django.urls import path, include  # <- DAPAT MAY INCLUDE DITO

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),  # <- IDAGDAG ITO!
]