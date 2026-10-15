import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()
from django.contrib.auth.models import User
from api.access.models import UserAccess
from api.business.models import Business
from api.models import Branch

print("=== DEMO USER ACCESS ===")
for u in User.objects.filter(username__startswith="demo_").order_by("username"):
    accesses = list(UserAccess.objects.filter(user=u).select_related("business"))
    for a in accesses:
        biz = a.business.name if a.business else "company-wide (all businesses)"
        branch = a.branch.name if hasattr(a, "branch") and a.branch else "all branches"
        print(f"  {u.username}: role={a.role}, business={biz}")

print()
print("=== BUSINESSES ===")
for b in Business.objects.filter(is_active=True).order_by("name"):
    branch_count = Branch.objects.filter(business=b).count()
    print(f"  {b.name} (slug={b.slug}) - {branch_count} branches")

print()
print("=== BRANCHES ===")
for br in Branch.objects.select_related("business").order_by("business__name", "name"):
    print(f"  {br.business.name} > {br.name} (id={br.id})")
