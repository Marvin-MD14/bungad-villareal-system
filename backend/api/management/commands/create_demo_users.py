from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand
from django.db.models.deletion import ProtectedError
from api.models import Branch, UserProfile, UserAccess, Business


        # Role codes come from UserAccess.ROLE_CHOICES (§6.3 renamed SUPERADMIN ->
        # OWNER; the two are distinct roles again). So "superadmin" below names the
        # account — a Django superuser / platform operator — whose capability role
        # is SUPERADMIN. Every other account holds a distinct role so each login
        # renders a different dashboard.
DEMO_USERS = [
    {
        'username': 'demo_superadmin',
        'password': 'DemoSuperadmin!2026',
        'role': 'SUPERADMIN',
        'access_role': 'SUPERADMIN',
        'is_staff': True,
        'is_superuser': True,
    },
    {
        'username': 'demo_owner',
        'password': 'DemoOwner!2026',
        'role': 'OWNER',
        'access_role': 'OWNER',
        'is_staff': True,
        'is_superuser': False,
    },
    {
        'username': 'demo_business_manager',
        'password': 'DemoBusinessManager!2026',
        'role': 'BUSINESS_MANAGER',
        'access_role': 'BUSINESS_MANAGER',
        'is_staff': True,
        'is_superuser': False,
    },
    {
        'username': 'demo_cashier',
        'password': 'DemoCashier!2026',
        'role': 'CASHIER',
        'access_role': 'CASHIER',
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'demo_staff',
        'password': 'DemoStaff!2026',
        'role': 'STAFF',
        'access_role': 'STAFF',
        'is_staff': False,
        'is_superuser': False,
    },
]

# 2026-10-01: the Company Admin / Accountant / Supervisor one-click demo nodes
# were removed from the login picker. The roles themselves remain in
# UserAccess.ROLE_CHOICES and stay assignable in Administration — only the
# seeded demo accounts are retired, and any rows left behind by an earlier run
# of this command are purged below so a stale login can never succeed.
LEGACY_DEMO_USERNAMES = ['demo_company_admin', 'demo_accountant', 'demo_supervisor']


class Command(BaseCommand):
    help = 'Create or update local demo accounts for each application role with UserAccess grants.'

    def handle(self, *args, **options):
        primary_biz = Business.objects.filter(slug='vss').first()
        branch, _ = Branch.objects.get_or_create(
            business=primary_biz, name='Main',
            defaults={'code': 'MAIN'},
        ) if primary_biz else (None, True)

        # Purge the retired demo accounts (see LEGACY_DEMO_USERNAMES). Deleting
        # a stale user cascades its profile and access grants; if a PROTECTed
        # row (e.g. a stock movement it created) pins the account, deactivate
        # it and revoke its grants so the login can never succeed again.
        for stale in User.objects.filter(username__in=LEGACY_DEMO_USERNAMES):
            try:
                stale.delete()
                self.stdout.write(self.style.SUCCESS(
                    f'Removed retired demo account: {stale.username}'
                ))
            except ProtectedError:
                stale.is_active = False
                stale.save(update_fields=['is_active'])
                stale.access_grants.update(is_active=False)
                self.stdout.write(self.style.WARNING(
                    f'Retired demo account {stale.username} is referenced by '
                    'existing records - deactivated and grants revoked instead.'
                ))

        for demo_user in DEMO_USERS:
            role = demo_user['role']
            access_role = demo_user['access_role']
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
            # §4.4: the profile keeps personal data only — role and branch are
            # carried by the UserAccess grant created just below.
            UserProfile.objects.get_or_create(user=user)

            # Ensure UserAccess grant
            is_company = access_role in UserAccess.COMPANY_ROLES
            target_biz = None if is_company else (branch.business or primary_biz)
            user_access, _ = UserAccess.objects.get_or_create(
                user=user,
                role=access_role,
                business=target_biz,
                defaults={'is_primary': True, 'is_active': True}
            )
            # Cashiers/Staff are pinned to the primary branch; a Business
            # Manager stays business-wide (empty branch list = all branches).
            if branch and access_role in ('CASHIER', 'STAFF'):
                user_access.branches.add(branch)

            action = 'Created' if created else 'Updated'
            self.stdout.write(
                self.style.SUCCESS(
                    f"{action} {role} ({access_role}): {demo_user['username']} / {demo_user['password']}"
                )
            )
