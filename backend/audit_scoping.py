import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

# Check which viewsets actually apply business scoping
from api.access.scoping import ScopedQuerysetMixin
from api import views as v
from api.catalog import views as cv
from api.business import views as bv
from api.access import views as av
from api.payments import views as pv

import inspect

viewsets_to_check = [
    ("TransactionViewSet", v.TransactionViewSet),
    ("ClientProfileViewSet", v.ClientProfileViewSet),
    ("RoomTableViewSet", v.RoomTableViewSet),
    ("ExpenseViewSet", v.ExpenseViewSet),
    ("AttendanceViewSet", v.AttendanceViewSet),
    ("CustomerFeedbackViewSet", v.CustomerFeedbackViewSet),
    ("AuditLogViewSet", v.AuditLogViewSet),
    ("UserProfileViewSet", v.UserProfileViewSet),
    ("DashboardStatsViewSet", v.DashboardStatsViewSet),
    ("ItemViewSet", cv.ItemViewSet),
    ("BusinessItemViewSet", cv.BusinessItemViewSet),
    ("InventoryLevelViewSet", cv.InventoryLevelViewSet),
    ("CustomerRewardViewSet", v.CustomerRewardViewSet),
]

print("=== SCOPING AUDIT ===")
for name, cls in viewsets_to_check:
    has_mixin = issubclass(cls, ScopedQuerysetMixin)
    # Check if get_queryset calls auto_scope
    src = inspect.getsource(cls.get_queryset) if hasattr(cls, "get_queryset") else ""
    has_auto_scope = "auto_scope" in src if src else False
    # Check queryset definition
    qs = getattr(cls, "queryset", None)
    qs_str = str(qs.query)[:80] if qs is not None else "None"
    print(f"  {name}: mixin={has_mixin}, auto_scope_override={has_auto_scope}")
