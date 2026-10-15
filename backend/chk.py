import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

from api.access.scoping import auto_scope
from django.test import RequestFactory
from django.contrib.auth.models import User
from api.access.models import UserAccess
from api.business.models import Business
from api.models import Transaction, ClientProfile, RoomTable, Expense, AuditLog, UserProfile, CustomerFeedback
from api.catalog.models import BusinessItem, InventoryLevel, Item

biz_vss = Business.objects.get(slug="vss")
biz_bb = Business.objects.get(slug="bb")

owner = User.objects.get(username="demo_owner")
factory = RequestFactory()
request = factory.get("/")
request.user = owner
request.company_wide = False
request.allowed_branch_ids = []
request._business_context_for = owner.pk
request.access = UserAccess.objects.filter(user=owner).first()

print("Model | VSS count | BB count | Same?")
print("-" * 60)

models = [
    ("Transaction", Transaction.objects.all()),
    ("ClientProfile", ClientProfile.objects.all()),
    ("RoomTable", RoomTable.objects.all()),
    ("Expense", Expense.objects.all()),
    ("AuditLog", AuditLog.objects.all()),
    ("UserProfile", UserProfile.objects.all()),
    ("BusinessItem", BusinessItem.objects.all()),
    ("InventoryLevel", InventoryLevel.objects.all()),
]

for name, qs in models:
    request.business = biz_vss
    vss = auto_scope(qs, request).count()
    request.business = biz_bb
    bb = auto_scope(qs, request).count()
    flag = "UNSCOPED!" if vss == bb and name != "Item" and vss > 0 else ""
    print(f"{name:20s} | {vss:9d} | {bb:8d} | {flag}")
