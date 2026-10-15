import sys, os, traceback
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

try:
    from api.access.models import UserAccess
    from api.business.models import Business
    from api.models import UserProfile
    
    biz_vss = Business.objects.get(slug="vss")
    biz_bb = Business.objects.get(slug="bb")
    
    def scope_profiles(biz):
        user_ids = UserAccess.objects.filter(business=biz, is_active=True).values_list("user_id", flat=True)
        return UserProfile.objects.filter(user_id__in=user_ids).count()
    
    vss_count = scope_profiles(biz_vss)
    bb_count = scope_profiles(biz_bb)
    total = UserProfile.objects.count()
    
    print(f"Total UserProfiles: {total}")
    print(f"VSS business users: {vss_count}")
    print(f"BB business users: {bb_count}")
    
    # Show who belongs to each business
    for biz in [biz_vss, biz_bb]:
        user_ids = UserAccess.objects.filter(business=biz, is_active=True).values_list("user_id", flat=True)
        profiles = UserProfile.objects.filter(user_id__in=user_ids).select_related("user")
        print(f"\n{biz.name} users:")
        for p in profiles:
            print(f"  {p.user.username} ({p.user.first_name} {p.user.last_name})")
except Exception:
    traceback.print_exc()
