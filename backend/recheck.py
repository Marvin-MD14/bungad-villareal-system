import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()
# Force reload
import importlib
import api.permissions as perms
importlib.reload(perms)
from api.permissions import ui_capabilities_for, role_allows

print("CASHIER - users:", role_allows("CASHIER", "UserProfile:list"))
print("STAFF - users:", role_allows("STAFF", "UserProfile:list"))
print("CASHIER caps:", sorted(ui_capabilities_for("CASHIER")))
print("STAFF caps:", sorted(ui_capabilities_for("STAFF")))
