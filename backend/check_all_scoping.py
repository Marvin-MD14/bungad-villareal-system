import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

from api.access.scoping import auto_scope
from django.test import RequestFactory
from django.contrib.auth.models import User
from api.access.models import UserAccess
from api.business.models import Business, BusinessType
from api.models import *
from api.catalog.models import *

biz_vss = Business.objects.filter(slug="vss").first()
biz_bb = Business.objects.filter(slug="bb").first()
print(f"VSS: {biz_vss}, BB: {biz_bb}")

factory = RequestFactory()
request = factory.get("/")
request.user = User.objects.filter(username="demo_owner").first()
request.company_wide = False  # Force business-scoped mode
request.allowed_branch_ids = []
request._business_context_for = request.user.pk

results = {}
for biz in [biz_vss, biz_bb]:
    request.business = biz
    request.access = UserAccess.objects.filter(user=request.user).first()
    
    counts = {}
    counts["Transaction"] = auto_scope(Transaction.objects.all(), request).count()
    counts["ClientProfile"] = auto_scope(ClientProfile.objects.all(), request).count()
    counts["RoomTable"] = auto_scope(RoomTable.objects.all(), request).count()
    counts["Expense"] = auto_scope(Expense.objects.all(), request).count()
    counts["AuditLog"] = auto_scope(AuditLog.objects.all(), request).count()
    counts["CustomerFeedback"] = auto_scope(CustomerFeedback.objects.all(), request).count()
    counts["CustomerReward"] = auto_scope(CustomerReward.objects.all(), request, business_lookup="customer__business").count()
    counts["BusinessItem"] = auto_scope(BusinessItem.objects.all(), request).count()
    counts["InventoryLevel"] = auto_scope(InventoryLevel.objects.all(), request, branch_lookup="branch_id").count()
    counts["UserProfile (UNSCOPED)"] = auto_scope(UserProfile.objects.all(), request).count()  # should differ per biz
    counts["Item"] = auto_scope(Item.objects.filter(is_active=True), request).count()
    
    results[biz.slug] = counts

# Print comparison
print(f"\n{'Model':30s} {'vss':>10} {'bb':>10} {'Same?':>8}")
print("-" * 65)
for model in results["vss"]:
    vss = results["vss"][model]
    bb = results["bb"][model]
    same = "SAME ⚠️" if vss == bb and vss > 0 and model != "Item" else ""
    print(f"{model:30s} {vss:>10} {bb:>10} {same:>8}")
