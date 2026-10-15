import django, os, sys
sys.path.insert(0, r'backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
django.setup()
from django.contrib.auth.models import User
from api.access.models import UserAccess
from api.business.models import Business

print('--- Demo Users ---')
for u in User.objects.filter(username__startswith='demo_').order_by('username'):
    accesses = list(UserAccess.objects.filter(user=u).select_related('business'))
    if accesses:
        for a in accesses:
            biz = a.business.name if a.business else 'company-wide'
            print('  ' + u.username + ': role=' + a.role + ', business=' + biz)
    else:
        print('  ' + u.username + ': no access row')

print()
print('--- Businesses ---')
for b in Business.objects.all():
    print('  id=' + str(b.id) + ' name=' + b.name + ' slug=' + b.slug + ' active=' + str(b.is_active))
