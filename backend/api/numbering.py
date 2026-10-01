# backend/api/numbering.py
"""Concurrency-safe document numbering (receipts, shifts, ...).

Receipt numbers used to be ``date + random hex``: two tills selling in the same
microsecond produced a collision, the unique constraint caught it, and the
cashier saw a 500.  A per-business, per-period counter row locked with
``SELECT ... FOR UPDATE`` (row-level on PostgreSQL; SQLite serialises writes at
the file level) makes numbering gapless and collision-free.
"""

from django.db import models, transaction as db_transaction
from django.utils import timezone


class DocumentSequence(models.Model):
    """The last used number for one (business, prefix, period) triple.

    ``period`` is normally ``YYYYMMDD`` so counters restart daily; pass any
    string (e.g. ``'2026'`` or ``''`` for a never-resetting counter) to change
    the cadence.
    """

    business = models.ForeignKey(
        'api.Business', on_delete=models.CASCADE, related_name='document_sequences',
    )
    prefix = models.CharField(max_length=10, default='TXN')
    period = models.CharField(max_length=12)
    last_number = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'api'
        unique_together = ('business', 'prefix', 'period')
        verbose_name_plural = 'Document sequences'

    def __str__(self):
        return f'{self.business_id}/{self.prefix}-{self.period}#{self.last_number}'

    @classmethod
    def next_number(cls, business, prefix='TXN', period=None):
        """Atomically claim and return the next number as ``(period, number)``.

        Safe to call from any nesting level: the ``atomic`` block participates
        in an enclosing transaction (checkout is already atomic), so the row
        lock is held until the *sale* commits — never released early.
        """
        period = period or timezone.localdate().strftime('%Y%m%d')
        with db_transaction.atomic():
            row, _ = cls.objects.get_or_create(
                business=business, prefix=prefix, period=period,
            )
            # Re-read under a row lock: the lock serialises concurrent claims.
            row = (
                cls.objects.select_for_update()
                .filter(pk=row.pk)
                .first()
            )
            row.last_number += 1
            row.save(update_fields=['last_number', 'updated_at'])
            return period, row.last_number

    @classmethod
    def next_document_number(cls, business, prefix='TXN', period=None, width=4):
        """Formatted document number, e.g. ``TXN-20260930-0042``."""
        period, number = cls.next_number(business, prefix=prefix, period=period)
        return f'{prefix}-{period}-{number:0{width}d}'
