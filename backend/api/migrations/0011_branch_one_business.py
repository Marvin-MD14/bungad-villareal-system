# backend/api/migrations/0011_branch_one_business.py
"""Every branch gets exactly one business; ``branch_type`` dies.

One data transaction per step, so an existing database converts in place:

1. orphan branches (``business IS NULL``) are attached to a business — the
   primary one where it exists (same rule ``bootstrap_company`` applies),
   otherwise a "Standalone Operations" business created on the spot;
2. duplicate outlet names *inside* a business are renamed with a numeric
   suffix, because the new uniqueness rule is (business, name);
3. ``business`` becomes non-null and ``branch_type`` is dropped — the legacy
   catalog label is derived from the business in ``Branch.branch_type`` now.
"""

from django.db import migrations, models
import django.db.models.deletion


def attach_orphans(apps, schema_editor):
    Branch = apps.get_model('api', 'Branch')
    Business = apps.get_model('api', 'Business')
    BusinessType = apps.get_model('api', 'BusinessType')

    orphans = Branch.objects.filter(business__isnull=True)
    if not orphans.exists():
        return

    primary = Business.objects.order_by('id').first()
    if primary is None:
        spa_type, _ = BusinessType.objects.get_or_create(
            code='general',
            defaults={'name': 'General', 'default_unit': 'pc', 'tracks_stock': True},
        )
        primary = Business.objects.create(
            name='Standalone Operations', slug='standalone-operations',
            business_type=spa_type,
        )

    # Branch names stay unique company-wide after this point, so suffix the
    # orphans that would collide with the business they are joining.
    taken = set(Branch.objects.filter(business=primary).values_list('name', flat=True))
    for branch in orphans.order_by('id'):
        name = branch.name
        if name in taken:
            suffix = 2
            while f'{name} ({suffix})' in taken:
                suffix += 1
            name = f'{name} ({suffix})'
        taken.add(name)
        Branch.objects.filter(pk=branch.pk).update(business=primary, name=name)


def dedupe_names(apps, schema_editor):
    Branch = apps.get_model('api', 'Branch')
    taken = {}
    for branch in Branch.objects.order_by('business_id', 'id'):
        key = (branch.business_id, branch.name.lower())
        seen = taken.get(key)
        if seen is None:
            taken[key] = branch.pk
            continue
        base, suffix = branch.name, 2
        while (branch.business_id, f'{base} ({suffix})'.lower()) in taken:
            suffix += 1
        renamed = f'{base} ({suffix})'
        taken[(branch.business_id, renamed.lower())] = branch.pk
        Branch.objects.filter(pk=branch.pk).update(name=renamed)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_delete_autospaservice_delete_bbproduct_and_more'),
    ]

    operations = [
        migrations.RunPython(attach_orphans, migrations.RunPython.noop),
        migrations.RunPython(dedupe_names, migrations.RunPython.noop),
        migrations.RemoveField(model_name='branch', name='branch_type'),
        migrations.AlterField(
            model_name='branch',
            name='business',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='branches',
                to='api.business',
            ),
        ),
        migrations.AlterModelOptions(
            name='branch',
            options={
                'ordering': ['business__name', 'name'],
                'verbose_name': 'Branch',
                'verbose_name_plural': 'Branches',
            },
        ),
        migrations.AlterUniqueTogether(
            name='branch',
            unique_together={('business', 'name')},
        ),
    ]
