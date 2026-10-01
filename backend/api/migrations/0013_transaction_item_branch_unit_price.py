# backend/api/migrations/0013_transaction_item_branch_unit_price.py
"""§5.4 / §3.4 L4 / §7.6: sharpen the money rows.

* every sales line gets its own ``branch`` and the price column is renamed to
  ``unit_price`` (the snapshot a receipt must reprint);
* receipt numbers become unique **per business** instead of globally;
* ``Transaction.branch`` and the stock rows move to ``on_delete=PROTECT`` so a
  branch or catalog item can never be deleted out from under history.
"""

from django.db import migrations, models
import django.db.models.deletion


def backfill_transaction_item_branch(apps, schema_editor):
    """Existing lines inherit their parent transaction's branch (§5.4).

    Done row by row: Django refuses a joined ``F('transaction__branch_id')``
    inside ``update()``, and the sales history is small enough that a loop is
    both safe and readable.
    """
    TransactionItem = apps.get_model('api', 'TransactionItem')
    for item in TransactionItem.objects.filter(branch__isnull=True).select_related('transaction'):
        item.branch_id = item.transaction.branch_id
        item.save(update_fields=['branch_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_role_grants_from_profiles'),
    ]

    operations = [
        migrations.AddField(
            model_name='transactionitem', name='branch',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='transaction_items',
                to='api.branch',
            ),
        ),
        migrations.RenameField(
            model_name='transactionitem', old_name='price', new_name='unit_price',
        ),
        migrations.RunPython(backfill_transaction_item_branch, migrations.RunPython.noop),

        # Receipts unique per business, not globally (§3.4 L4).
        migrations.AlterField(
            model_name='transaction', name='transaction_number',
            field=models.CharField(max_length=50),
        ),
        migrations.AlterUniqueTogether(
            name='transaction',
            unique_together={('business', 'transaction_number')},
        ),

        # Money history survives a catalog/outlet retirement (§7.6).
        migrations.AlterField(
            model_name='transaction', name='branch',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to='api.branch'
            ),
        ),
        migrations.AlterField(
            model_name='inventorylevel', name='branch',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='inventory_levels',
                to='api.branch',
            ),
        ),
        migrations.AlterField(
            model_name='inventorylevel', name='item',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='inventory_levels',
                to='api.item',
            ),
        ),
    ]
