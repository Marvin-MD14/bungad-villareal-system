import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

# Check what capabilities STAFF role actually returns
from api.permissions import ui_capabilities_for
staff_caps = ui_capabilities_for("STAFF")
print("STAFF capabilities:", sorted(staff_caps))

cashier_caps = ui_capabilities_for("CASHIER")
print("CASHIER capabilities:", sorted(cashier_caps))

# Check the users probe
from api.permissions import UI_CAPABILITY_PROBES, role_allows
print("\nusers probe:", UI_CAPABILITY_PROBES.get("users"))
print("STAFF can UserProfile:list?", role_allows("STAFF", "UserProfile:list"))
