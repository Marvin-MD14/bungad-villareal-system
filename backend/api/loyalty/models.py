# backend/api/loyalty/models.py
"""Loyalty program configuration + the points ledger.

Two corrections over the old design (see Compare_System_backend.md §7/§8):

* **Rules were hardcoded** (1 point per ₱100, free item per ₱5000).
  ``LoyaltyProgram`` makes them per-business configuration.
* **Balances were mutable columns.** ``LoyaltyTransaction`` is the append-only
  ledger every point movement must pass through; ``ClientProfile.loyalty_points``
  stays as a *cached* balance that is always derived from a ledger row, so a
  balance can be audited and rebuilt from history.
"""

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models

from api.access.managers import BusinessScopedModel


class LoyaltyProgram(BusinessScopedModel):
    """Per-business earning rules. One row per business, defaults on demand."""

    # Currency spent to earn one point (legacy rule was 100).
    earn_amount = models.DecimalField(max_digits=10, decimal_places=2, default=100)
    # Currency value of one redeemed point (informational until redemptions
    # exist; kept here so the rules live in one place).
    redeem_value = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    # Sales total that grants one free item (legacy rule was 5000). 0 disables.
    free_item_threshold = models.DecimalField(max_digits=10, decimal_places=2, default=5000)
    # NULL = points never expire.
    points_valid_days = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'api'
        unique_together = ('business',)
        verbose_name_plural = 'Loyalty programs'

    def __str__(self):
        return f'Loyalty @ {self.business_id} (1 pt / {self.earn_amount})'

    @classmethod
    def for_business(cls, business):
        """The program for ``business``, created with defaults on first use."""
        program, _ = cls.objects.get_or_create(business=business)
        return program


class LoyaltyTransaction(models.Model):
    """Append-only points ledger: one row per point movement, forever.

    ``balance_after`` snapshots the customer's (cached) balance at commit time
    so the ledger can be replayed and reconciled without trusting the column.
    """

    ENTRY_TYPES = [
        ('EARN', 'Earned on sale'),
        ('REDEEM', 'Redeemed'),
        ('ADJUST', 'Manual adjustment / void reversal'),
        ('EXPIRE', 'Expired'),
    ]

    business = models.ForeignKey(
        'api.Business', on_delete=models.CASCADE, related_name='loyalty_transactions',
    )
    customer = models.ForeignKey(
        'api.ClientProfile', on_delete=models.CASCADE, related_name='loyalty_entries',
    )
    branch = models.ForeignKey(
        'api.Branch', on_delete=models.PROTECT, null=True, blank=True,
        related_name='loyalty_entries',
    )
    transaction = models.ForeignKey(
        'api.Transaction', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='loyalty_entries',
    )
    entry_type = models.CharField(max_length=10, choices=ENTRY_TYPES)
    # Signed: positive earns, negative deducts.
    points = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reason = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='loyalty_entries',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'api'
        ordering = ['-created_at', '-id']
        indexes = [
            models.Index(fields=['customer', 'created_at']),
            models.Index(fields=['business', 'created_at']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(points__gt=0) | models.Q(points__lt=0),
                name='loyalty_entry_nonzero',
            ),
        ]

    def __str__(self):
        return f'{self.entry_type} {self.points} pts -> {self.balance_after}'

    def save(self, *args, **kwargs):
        """Ledger rows are immutable: corrections are *new* rows, not edits."""
        if self.pk:
            raise ValidationError('Loyalty ledger rows are append-only; write a reversing entry.')
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Loyalty ledger rows cannot be deleted; write a reversing entry.')
