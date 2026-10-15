import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

# What does the login API return for demo_owner (multi-business)?
from api.views import login_view
from django.test import RequestFactory
import json

factory = RequestFactory()
request = factory.post("/api/auth/login/", 
    data=json.dumps({"username": "demo_owner", "password": "DemoOwner!2026"}),
    content_type="application/json"
)

from api.views import login_view
response = login_view(request)
data = json.loads(response.content)
print("Login response keys:", list(data.keys()))
print("primary_business:", data.get("primary_business"))
businesses = data.get("businesses", [])
print(f"Businesses returned ({len(businesses)}):")
for b in businesses:
    print(f"  id={b.get('id')} name={b.get('name')} slug={b.get('slug')}")

print()
# Check user role
print("User role:", data.get("user", {}).get("role_code"))
