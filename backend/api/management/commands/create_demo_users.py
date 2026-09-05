from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand
from api.models import Branch, UserProfile


DEMO_USERS = [
    {
        'username': 'demo_superadmin',
        'password': 'DemoSuperadmin!2026',
        'role': 'SUPERADMIN',
        'is_staff': True,
        'is_superuser': True,
    },
    {
        'username': 'demo_owner',
        'password': 'DemoOwner!2026',
        'role': 'OWNER',
        'is_staff': True,
        'is_superuser': False,
    },
    {
        'username': 'demo_branch_admin',
        'password': 'DemoBranchAdmin!2026',
        'role': 'BRANCH_ADMIN',
        'is_staff': True,
        'is_superuser': False,
    },
    {
        'username': 'demo_cashier',
        'password': 'DemoCashier!2026',
        'role': 'CASHIER',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'demo_staff',
        'password': 'DemoStaff!2026',
        'role': 'STAFF',
        'is_staff': False,
        'is_superuser': False,
    },
]


class Command(BaseCommand):
    help = 'Create or update local demo accounts for each application role.'

    def handle(self, *args, **options):
        branch, _ = Branch.objects.get_or_create(name='Demo Branch')
        for demo_user in DEMO_USERS:
            role = demo_user['role']
            group, _ = Group.objects.get_or_create(name=role)
            user, created = User.objects.get_or_create(
                username=demo_user['username'],
                defaults={
                    'is_active': True,
                    'is_staff': demo_user['is_staff'],
                    'is_superuser': demo_user['is_superuser'],
                },
            )

            user.is_active = True
            user.is_staff = demo_user['is_staff']
            user.is_superuser = demo_user['is_superuser']
            user.set_password(demo_user['password'])
            user.save()
            user.groups.set([group])
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = role
            profile.branch = branch if role in {'BRANCH_ADMIN', 'CASHIER', 'STAFF'} else None
            profile.save()

            action = 'Created' if created else 'Updated'
            self.stdout.write(
                self.style.SUCCESS(
                    f"{action} {role}: {demo_user['username']} / {demo_user['password']}"
                )
            )
