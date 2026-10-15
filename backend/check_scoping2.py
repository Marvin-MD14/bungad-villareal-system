import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

# UserProfile has NO business/branch FK, so auto_scope doesn't filter it by business
# This means ALL users from ALL businesses show on the Users page regardless of selected business!
# 
# Also check if RoomTable, Expense, Attendance have branch->business path

from api.models import RoomTable, Expense

# RoomTable scoping: has branch FK, auto_scope filters branch->business
print("RoomTable fields:", [f.name for f in RoomTable._meta.fields if "branch" in f.name or "business" in f.name])

# Expense scoping  
print("Expense fields:", [f.name for f in Expense._meta.fields if "branch" in f.name or "business" in f.name])

# Check if branch_comparison uses business scoping
from api.access.scoping import auto_scope
from django.test import RequestFactory
from django.contrib.auth.models import User
from api.access.models import UserAccess
from api.business.models import Business

biz = Business.objects.filter(slug="vss").first()
print(f"\nTesting with business: {biz}")

factory = RequestFactory()
request = factory.get("/")
request.user = User.objects.filter(username="demo_owner").first()
request.business = biz
request.company_wide = False  # Force business-scoped
request.access = UserAccess.objects.filter(user=request.user).first()
request.allowed_branch_ids = []
request._business_context_for = request.user.pk

# UserProfile - no business FK, auto_scope will NOT filter
from api.models import UserProfile
qs = auto_scope(UserProfile.objects.all(), request)
print(f"\nUserProfile after scoping (business={biz}): {qs.count()} rows (SHOULD be scoped!)")

# AuditLog - HAS business FK
from api.models import AuditLog
qs2 = auto_scope(AuditLog.objects.all(), request)
print(f"AuditLog after scoping: {qs2.count()} rows (filtered by business=vss)")

# Transaction
from api.models import Transaction
qs3 = auto_scope(Transaction.objects.all(), request)
print(f"Transaction after scoping: {qs3.count()} rows (filtered by business=vss)")
