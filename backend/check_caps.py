import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()
from api.permissions import ui_capabilities_for

roles = ["SUPERADMIN", "OWNER", "COMPANY_ADMIN", "ACCOUNTANT", "BUSINESS_MANAGER", "SUPERVISOR", "CASHIER", "STAFF"]
for role in roles:
    caps = ui_capabilities_for(role)
    print(role + ":")
    print("  " + str(sorted(caps)))
