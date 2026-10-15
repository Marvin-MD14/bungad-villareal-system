import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()
from api.permissions import ui_capabilities_for, ROLE_GUIDE_META

roles = ["SUPERADMIN", "OWNER", "COMPANY_ADMIN", "ACCOUNTANT", "BUSINESS_MANAGER", "SUPERVISOR", "CASHIER", "STAFF"]
for role in roles:
    caps = ui_capabilities_for(role)
    meta = ROLE_GUIDE_META.get(role, ("dashboard", ""))
    print(f"\n{role}:")
    print(f"  Lands on: {meta[0]}")
    print(f"  Scope: {meta[1]}")
    print(f"  Capabilities: {sorted(caps)}")
