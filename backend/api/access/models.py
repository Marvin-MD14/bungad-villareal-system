# backend/api/access/models.py

from django.db import models
from django.contrib.auth.models import User


class UserAccess(models.Model):
    """What a user may do, and where. One row per (user, business).

    Company-wide roles (OWNER / COMPANY_ADMIN / ACCOUNTANT) use business=None
    and see every business. Business roles must set a business; `branches`
    narrows them further (empty = every branch of that business).
    """
    COMPANY_ROLES = {'OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'}
    ROLE_CHOICES = [
        ('OWNER', 'Owner'),
        ('COMPANY_ADMIN', 'Company Admin'),
        ('ACCOUNTANT', 'Accountant'),
        ('BUSINESS_MANAGER', 'Business Manager'),
        ('SUPERVISOR', 'Supervisor'),
        ('CASHIER', 'Cashier'),
        ('STAFF', 'Staff'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='access_grants')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    business = models.ForeignKey(
        'api.Business',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='access_grants',
        help_text='NULL = company-wide role',
    )
    branches = models.ManyToManyField(
        'api.Branch',
        blank=True,
        related_name='access_grants',
        help_text='Empty = all branches of the business',
    )
    is_primary = models.BooleanField(default=False, help_text='Business the user lands on after login')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'api'
        unique_together = ('user', 'role', 'business')
        ordering = ['user__username', 'business__name']
        constraints = [
            # company roles must not carry a business; business roles must have one
            models.CheckConstraint(
                check=(
                    models.Q(role__in=['OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'], business__isnull=True)
                    | ~models.Q(role__in=['OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'])
                ),
                name='company_role_has_no_business',
            ),
        ]

    @property
    def is_company_wide(self):
        return self.role in self.COMPANY_ROLES

    def branch_ids(self):
        return list(self.branches.values_list('id', flat=True))

    def __str__(self):
        where = self.business.name if self.business else 'Whole company'
        return f'{self.user.username} — {self.role} @ {where}'
