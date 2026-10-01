# backend/api/access/models.py

import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class UserAccess(models.Model):
    """What a user may do, and where. One row per (user, business).

    Company-wide roles (OWNER / COMPANY_ADMIN / ACCOUNTANT) use business=None
    and see every business. Business roles must set a business; `branches`
    narrows them further (empty = every branch of that business).
    """
    COMPANY_ROLES = {'SUPERADMIN', 'OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'}
    ROLE_CHOICES = [
        # SUPERADMIN operates the platform (creates/retires businesses, business
        # types and access grants). OWNER runs the company itself. They were
        # merged into one code in §6.3 and are separate again: their jobs differ.
        ('SUPERADMIN', 'Superadmin'),
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
                    models.Q(role__in=['SUPERADMIN', 'OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'], business__isnull=True)
                    | ~models.Q(role__in=['SUPERADMIN', 'OWNER', 'COMPANY_ADMIN', 'ACCOUNTANT'])
                ),
                name='company_role_has_no_business',
            ),
            # There is exactly ONE active company-wide OWNER (Compare_System
            # §5: "there can be only one owner of the business").  All rows the
            # condition matches carry role='OWNER', so a unique index on `role`
            # restricted to that slice allows at most one live owner grant;
            # revoked (is_active=False) rows stay for history.
            models.UniqueConstraint(
                fields=['role'],
                condition=models.Q(
                    role='OWNER', business__isnull=True, is_active=True,
                ),
                name='single_active_owner',
            ),
        ]

    @property
    def is_company_wide(self):
        return self.role in self.COMPANY_ROLES

    def branch_ids(self):
        """Branch ids this grant ticks — read straight from the through table.

        ``self.branches`` is a M2M to ``Branch``, whose default manager is the
        context-scoped :class:`~api.access.managers.BusinessScopedManager`.
        A grant is resolved *before* the active-business context var is set, and
        inside a request that manager fails closed to ``none()`` — which would
        silently report a ticked grant as covering no branch (and let a narrowed
        till sell at any outlet).  Querying the unscoped through rows keeps the
        grant's branch list truthful regardless of ambient scope.
        """
        if not self.pk:
            return []
        return list(
            self.branches.through.objects
            .filter(useraccess_id=self.pk)
            .order_by('branch_id')
            .values_list('branch_id', flat=True)
        )

    def __str__(self):
        where = self.business.name if self.business else 'Whole company'
        return f'{self.user.username} — {self.role} @ {where}'


# ============================================================
# DEVICE TOKENS (§7.9)
# ------------------------------------------------------------
# The stock DRF ``authtoken`` is a single, immortal, non-rotatable
# row per user: one leaked key is a permanent credential for the whole
# account, there is no way to tell which device holds it, and cutting
# it off logs the user out everywhere with no replacement.  A
# ``DeviceToken`` is one credential per device that expires, rotates,
# and dies with the password.
# ============================================================

def password_fingerprint(user):
    """Stable, non-reversible fingerprint of the account's current password.

    A ``DeviceToken`` stores the fingerprint it was issued against.  Django
    already stores passwords as salted hashes, so this is an HMAC of that hash
    keyed with ``SECRET_KEY`` — it never reveals the password, and it changes
    whenever the password does.
    """
    return hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        (user.password or '').encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()


class DeviceToken(models.Model):
    """One API credential per device, with a bounded life (§7.9).

    * **Expiring** — ``expires_at`` caps how long a leaked or abandoned key
      keeps working, so a stolen credential cannot be a permanent backdoor.
    * **Rotatable** — :meth:`rotate` mints a successor and revokes this row, so
      a trusted session renews without re-entering the password and without
      the new key ever being derivable from the old one.
    * **Bound to the password** — ``password_fingerprint`` pins the credential
      to the password hash it was issued against, so a password change
      invalidates *every* outstanding token for that account.  Comparing a
      fingerprint on each request beats a ``post_save`` signal here: it also
      catches a password rotated by an admin or a management command, and it
      cannot be missed by a code path that forgets to send the signal.
    * **Attributable** — device name, user agent and IP are recorded, so a user
      can see and revoke individual sessions instead of all-or-nothing.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='device_tokens')
    key = models.CharField(max_length=64, unique=True, db_index=True)
    device_name = models.CharField(max_length=120, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    password_fingerprint = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    rotated_from = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='successors',
    )

    class Meta:
        app_label = 'api'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'revoked_at'])]

    def __str__(self):
        state = 'revoked' if self.is_revoked else ('expired' if self.is_expired else 'active')
        return f'{self.user.username} — {self.device_name or "device"} ({state})'

    @property
    def is_revoked(self):
        return self.revoked_at is not None

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()

    @property
    def is_stale(self):
        """The password changed after this token was issued."""
        return self.password_fingerprint != password_fingerprint(self.user)

    @property
    def is_valid(self):
        """Usable right now: not revoked, not expired, password unchanged."""
        return not self.is_revoked and not self.is_expired and not self.is_stale

    @classmethod
    def _generate_key(cls):
        while True:
            key = secrets.token_hex(32)
            if not cls.objects.filter(key=key).exists():
                return key

    @classmethod
    def issue(cls, user, *, device_name='', user_agent='', ip_address=None, lifetime=None):
        """Mint a new credential for ``user`` and return it."""
        if lifetime is None:
            lifetime = timedelta(hours=getattr(settings, 'API_TOKEN_LIFETIME_HOURS', 12))
        return cls.objects.create(
            user=user,
            key=cls._generate_key(),
            device_name=(device_name or '')[:120],
            user_agent=(user_agent or '')[:255],
            ip_address=ip_address,
            password_fingerprint=password_fingerprint(user),
            expires_at=timezone.now() + lifetime,
        )

    def rotate(self, **kwargs):
        """Mint a successor credential and revoke this one.

        The successor is a fresh random key — it is never derived from this
        one, so a rotation does not extend the life of a compromised key.
        """
        successor = DeviceToken.issue(
            self.user,
            device_name=self.device_name,
            user_agent=self.user_agent,
            ip_address=self.ip_address,
            **kwargs,
        )
        DeviceToken.objects.filter(pk=successor.pk).update(rotated_from=self)
        self.revoke()
        return successor

    def revoke(self):
        """Mark this credential dead (idempotent)."""
        if not self.revoked_at:
            self.revoked_at = timezone.now()
            self.save(update_fields=['revoked_at'])

    def touch(self):
        """Record use, without writing on every single request."""
        if self.last_used_at is None or (timezone.now() - self.last_used_at) > timedelta(minutes=5):
            self.last_used_at = timezone.now()
            self.save(update_fields=['last_used_at'])


# ============================================================
# STAFFING HELPERS (§4.4)
# ------------------------------------------------------------
# Staff no longer carry a single ``UserProfile.branch``; membership of a branch
# is now expressed by the grants that cover it (a business-wide grant, or one
# with this branch ticked).  These helpers are the single place that answers
# "who works at this outlet?", used by the branch serializer and the staffing
# report.
# ============================================================

def branch_staff_grants(branch):
    """Active grants whose holder works at ``branch``."""
    if not getattr(branch, 'business_id', None):
        return UserAccess.objects.none()
    grants = UserAccess.objects.filter(is_active=True, business=branch.business)
    return grants.filter(models.Q(branches=branch) | models.Q(branches__isnull=True)).distinct()


def staff_count_for_branch(branch):
    return (
        branch_staff_grants(branch)
        .filter(user__is_active=True)
        .values('user_id')
        .distinct()
        .count()
    )


def staff_counts_by_role_for_branch(branch):
    """``{'BUSINESS_MANAGER': n, 'CASHIER': n, 'STAFF': n}`` for the staffing report."""
    counts = {}
    for role, user_id in branch_staff_grants(branch).values_list('role', 'user_id'):
        counts.setdefault(role, set()).add(user_id)
    return {role: len(users) for role, users in counts.items()}
