# backend/api/payments/models.py
"""Payment methods, split payments and cashier shifts.

The old model had a single ``amount_paid`` column: no tendered/change per
tender, no GCash vs cash, no way to reconcile a till at close.  These three
models close that gap without touching the receipt totals already stored on
``Transaction`` — ``Payment`` rows *decompose* a sale's payment, they never
replace it.
"""

from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from api.access.managers import BusinessScopedModel

# Provisioned for every new Business (and on demand for existing ones).
DEFAULT_PAYMENT_METHODS = [
    ('CASH', 'Cash'),
    ('GCASH', 'GCash'),
    ('MAYA', 'Maya'),
    ('CARD', 'Card'),
]


class PaymentMethod(BusinessScopedModel):
    """A tender type a business accepts (per tenant; codes are free-form)."""

    code = models.CharField(max_length=20)
    name = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'api'
        unique_together = ('business', 'code')
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.code})'

    @classmethod
    def ensure_defaults(cls, business):
        """Idempotently provision the default tenders for ``business``."""
        for code, name in DEFAULT_PAYMENT_METHODS:
            cls.objects.get_or_create(
                business=business, code=code, defaults={'name': name},
            )

    @classmethod
    def resolve(cls, business, reference):
        """Find a method for ``business`` by pk or code (for checkout payloads)."""
        if reference is None or reference == '':
            return None
        text = str(reference)
        method = None
        if text.isdigit():
            method = cls.objects.filter(
                business=business, pk=text, is_active=True,
            ).first()
        if method is None:
            method = cls.objects.filter(
                business=business, code__iexact=text, is_active=True,
            ).first()
        if method is None:  # company-wide fallbacks, if ever introduced
            method = cls.all_objects.filter(
                business__isnull=True, code__iexact=text, is_active=True,
            ).first()
        return method


class CashierShift(BusinessScopedModel):
    """One till session: opening float in, counted cash out, variance stored."""

    STATUS_CHOICES = [('OPEN', 'Open'), ('CLOSED', 'Closed')]

    branch = models.ForeignKey(
        'api.Branch', on_delete=models.PROTECT, related_name='cashier_shifts',
    )
    staff = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name='cashier_shifts',
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='OPEN')
    opening_float = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closing_cash = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    expected_cash = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    over_short = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        app_label = 'api'
        ordering = ['-opened_at']
        constraints = [
            models.UniqueConstraint(
                fields=['branch', 'staff'],
                condition=models.Q(status='OPEN'),
                name='one_open_shift_per_staff_per_branch',
            ),
        ]

    def __str__(self):
        return f'Shift {self.staff.username}@{self.branch.name} {self.status}'

    def expected_cash_due(self):
        """Opening float + net cash tendered on this shift's payments.

        A cash sale puts ``tendered`` in the drawer and returns ``change``, so
        the net drawer movement of one payment is exactly its allocated
        ``amount`` — non-cash tenders never touch the drawer and are excluded.
        """
        cash_in = self.payments.filter(
            method__code='CASH',
        ).aggregate(total=models.Sum('amount'))['total'] or 0
        return Decimal(str(self.opening_float)) + Decimal(str(cash_in))

    def close(self, closing_cash):
        if self.status == 'CLOSED':
            raise ValidationError('Shift is already closed.')
        self.expected_cash = self.expected_cash_due()
        self.closing_cash = Decimal(str(closing_cash))
        self.over_short = self.closing_cash - self.expected_cash
        self.status = 'CLOSED'
        self.closed_at = timezone.now()
        self.save(update_fields=[
            'expected_cash', 'closing_cash', 'over_short', 'status', 'closed_at',
        ])
        return self


class Payment(BusinessScopedModel):
    """One tender against one sale; a sale's Payment rows sum to its total."""

    transaction = models.ForeignKey(
        'api.Transaction', on_delete=models.CASCADE, related_name='payments',
    )
    shift = models.ForeignKey(
        CashierShift, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='payments',
    )
    method = models.ForeignKey(
        PaymentMethod, on_delete=models.PROTECT, related_name='payments',
    )
    # Currency of this payment applied to the receipt total.
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    # Cash handed over (>= amount); non-cash leave blank (= amount).
    tendered = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    change = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'api'
        ordering = ['id']
        constraints = [
            models.CheckConstraint(check=models.Q(amount__gt=0), name='payment_amount_positive'),
        ]

    def __str__(self):
        return f'{self.method_id} {self.amount} on txn {self.transaction_id}'

