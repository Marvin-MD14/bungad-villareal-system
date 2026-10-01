# backend/api/migrations/0012_role_grants_from_profiles.py
"""§4.4: ``role``/``branch`` leave ``UserProfile``.

The columns are dropped only *after* every row has been turned into the
``UserAccess`` grant that now carries both, so no account loses its scope or
capability during the upgrade.  The personal fields the plan always wanted
(``avatar``, ``phone_number``) are added at the same time, along with the other
§4.5/§7.10 additions that do not touch money: branch opening hours and a room's
catalog item.
"""

from django.db import migrations, models
import django.db.models.deletion

# Legacy profile role -> (grant role, is company-wide).  Unknown values fall
# back to the group/superuser path in api.permissions.get_user_role().
ROLE_MAP = {
    'SUPERADMIN': ('OWNER', True),
    'OWNER': ('OWNER', True),
    'BRANCH_ADMIN': ('BUSINESS_MANAGER', False),
    'CASHIER': ('CASHIER', False),
    'STAFF': ('STAFF', False),
}


def grants_from_profiles(apps, schema_editor):
    """Backfill UserAccess rows from the profile columns that are about to go.

    Accounts that already have a grant are left alone (the API has been writing
    grants since migration 0008).
    """
    UserProfile = apps.get_model('api', 'UserProfile')
    UserAccess = apps.get_model('api', 'UserAccess')
    Branch = apps.get_model('api', 'Branch')

    for profile in UserProfile.objects.select_related('user').iterator():
        mapping = ROLE_MAP.get(profile.role)
        if mapping is None:
            continue
        if UserAccess.objects.filter(user_id=profile.user_id).exists():
            continue

        code, company_wide = mapping
        branch = None
        if not company_wide and profile.branch_id:
            branch = Branch.objects.filter(pk=profile.branch_id).select_related('business').first()

        if company_wide or branch is None:
            # Company role, or a branch role with no branch yet: the account
            # keeps company-wide visibility rather than ending up with none.
            UserAccess.objects.get_or_create(
                user_id=profile.user_id,
                role=code,
                business=None,
                defaults={'is_primary': True, 'is_active': True},
            )
            continue

        grant, _ = UserAccess.objects.get_or_create(
            user_id=profile.user_id,
            role=code,
            business_id=branch.business_id,
            defaults={'is_primary': True, 'is_active': True},
        )
        grant.branches.add(branch)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_branch_one_business'),
    ]

    operations = [
        migrations.RunPython(grants_from_profiles, migrations.RunPython.noop),

        # UserProfile becomes personal data only (§4.4).
        migrations.AddField(
            model_name='userprofile', name='phone_number',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='userprofile', name='avatar',
            field=models.ImageField(blank=True, null=True, upload_to='staff/'),
        ),
        migrations.RemoveField(model_name='userprofile', name='role'),
        migrations.RemoveField(model_name='userprofile', name='branch'),

        # Branch opening hours (§4.3).
        migrations.AddField(
            model_name='branch', name='opens_at',
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='branch', name='closes_at',
            field=models.TimeField(blank=True, null=True),
        ),

        # Customers are retired with is_active=False, never deleted (§7.10).
        migrations.AddField(
            model_name='clientprofile', name='is_active',
            field=models.BooleanField(default=True),
        ),

        # A room can name the catalog service being performed (§4.5).
        migrations.AddField(
            model_name='roomtable', name='item',
            field=models.ForeignKey(
                blank=True,
                help_text='Catalog service currently being performed in this room, if any',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='room_bookings',
                to='api.item',
            ),
        ),
    ]
