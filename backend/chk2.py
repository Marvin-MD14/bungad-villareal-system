import sys, os, traceback
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

try:
    from api.access.scoping import auto_scope
    from django.test import RequestFactory
    from django.contrib.auth.models import User
    from api.access.models import UserAccess
    from api.business.models import Business
    from api.models import Transaction, ClientProfile, RoomTable, Expense, AuditLog, UserProfile
    
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
    
    for name, qs in [
        ("Transaction", Transaction.objects.all()),
        ("ClientProfile", ClientProfile.objects.all()),
        ("UserProfile", UserProfile.objects.all()),
    ]:
        request.business = biz_vss
        vss = auto_scope(qs, request).count()
        request.business = biz_bb
        bb = auto_scope(qs, request).count()
        print(f"{name}: vss={vss} bb={bb}")
        
except Exception:
    traceback.print_exc()
