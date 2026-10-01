# backend/api/business/models.py

from django.db import models


class BusinessType(models.Model):
    """Spa / Salon / Restaurant / Auto shop / Retail — user-extensible, not code."""
    code = models.SlugField(unique=True)  # 'spa', 'restaurant', 'auto-shop'
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=40, blank=True)  # lucide icon name for the UI
    default_unit = models.CharField(max_length=20, default='pc')  # pc / session / hour
    tracks_stock = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = 'api'
        ordering = ['name']

    def __str__(self):
        return self.name


class Business(models.Model):
    """One business the company runs — the parent that Branch outlets hang from.

    Naming (this tripped us up before): a **Business** is the top operating
    unit the Owner/superadmin creates (e.g. "Spa Biz", "Retail Biz"); a
    **Branch** is one physical *outlet* of that business (e.g. "Main", "DSM-01").
    They are NOT the same thing — Business is the parent and the isolation
    boundary, Branch is its outlet.  The Owner can create as many Businesses as
    the company runs; each then owns one or more Branches.
    """
    name = models.CharField(max_length=150, unique=True)
    slug = models.SlugField(max_length=80, unique=True)
    business_type = models.ForeignKey(
        BusinessType,
        on_delete=models.PROTECT,
        related_name='businesses',
        help_text='Spa / Restaurant / Auto shop ... determines default item kinds',
    )
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='business/', blank=True, null=True)
    receipt_header = models.TextField(blank=True)
    currency = models.CharField(max_length=3, blank=True)  # blank = use Company default
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    loyalty_enabled = models.BooleanField(default=True)
    # The accountable owner of this business.  *Authority* to act as Owner still
    # comes from a company-wide OWNER UserAccess grant — and the database now
    # guarantees at most one such active grant exists for the whole company
    # (see UserAccess.Meta.constraints).  This column records who owns the
    # tenant itself, for reporting and future per-business ownership.
    owner = models.ForeignKey(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='owned_businesses',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'api'
        ordering = ['name']
        verbose_name_plural = 'Businesses'

    def __str__(self):
        return self.name
