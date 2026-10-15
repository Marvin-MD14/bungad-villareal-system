import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()
from django.contrib.auth.models import User
from api.access.models import UserAccess
from api.business.models import Business

owner = User.objects.get(username="demo_owner")
grants = UserAccess.objects.filter(user=owner, is_active=True).select_related("business")
print("demo_owner grants:")
for g in grants:
    biz = g.business
    print(f"  role={g.role}, business={biz.name if biz else 'company-wide'}, is_primary={g.is_primary}")

# Company-wide OWNER should see ALL businesses
bizs = Business.objects.filter(is_active=True).order_by("name")
print(f"\nAll active businesses ({bizs.count()}):")
for b in bizs:
    print(f"  {b.name} (slug={b.slug})")
