import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

# Simulate what the UserProfile viewset does for scoping
# UserProfile has NO business FK - it doesn't directly belong to a business
from api.models import UserProfile, Branch
from api.access.scoping import auto_scope
from django.test import RequestFactory
from django.contrib.auth.models import User
from api.access.models import UserAccess
from api.business.models import Business

# Check the UserProfile model fields
print("UserProfile fields:", [f.name for f in UserProfile._meta.fields])
print()

# Check what happens when auto_scope is called on UserProfile
# UserProfile has no business or branch FK directly - scoping is via user__access_grants
factory = RequestFactory()
request = factory.get("/api/user-profiles/")
request.user = User.objects.first()
request.business = Business.objects.first()
request.company_wide = False
request.access = UserAccess.objects.first()
request.allowed_branch_ids = []

qs = UserProfile.objects.all()
scoped = auto_scope(qs, request)
print("UserProfile auto_scope SQL:", str(scoped.query)[:300])
print()

# Check ClientProfile scoping
from api.models import ClientProfile
print("ClientProfile fields:", [f.name for f in ClientProfile._meta.fields if "business" in f.name or "branch" in f.name])
qs2 = ClientProfile.objects.all()
scoped2 = auto_scope(qs2, request)
print("ClientProfile auto_scope SQL:", str(scoped2.query)[:300])
