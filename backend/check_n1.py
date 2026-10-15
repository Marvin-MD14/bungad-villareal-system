import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

# Check for missing select_related on serializers that access FK fields
# This is the main N+1 source in DRF

from api.models import Transaction, UserProfile, Branch
from api.catalog.models import BusinessItem, Item

# Check serializers that iterate FK fields
from api.serializers import TransactionSerializer, UserProfileSerializer

# Check if Transaction serializer accesses branch and customer without select_related  
print("=== Checking for N+1 in querysets ===")

# Check transaction default queryset
from api.views import TransactionViewSet
qs = TransactionViewSet.queryset
print("Transaction queryset:", qs.query.__str__()[:200])

# Check UserProfile
from api.views import UserProfileViewSet
qs2 = UserProfileViewSet.queryset
print("\nUserProfile queryset:", qs2.query.__str__()[:200])

# Check ClientProfile
from api.views import ClientProfileViewSet
qs3 = ClientProfileViewSet.queryset
print("\nClientProfile queryset:", qs3.query.__str__()[:200])
