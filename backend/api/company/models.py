# backend/api/company/models.py

from django.db import models


class Company(models.Model):
    """The single company that owns everything. Use Company.get_solo()."""
    legal_name = models.CharField(max_length=200, default='Bungad & Villareal Group')
    display_name = models.CharField(max_length=150, blank=True)
    logo = models.ImageField(upload_to='company/', blank=True, null=True)
    tax_id = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    contact_number = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    default_currency = models.CharField(max_length=3, default='PHP')
    timezone = models.CharField(max_length=64, default='Asia/Manila')
    default_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    receipt_footer = models.TextField(blank=True)
    loyalty_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'api'
        verbose_name_plural = 'Company'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1  # enforce singleton
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError('The Company record cannot be deleted.')

    def __str__(self):
        return self.display_name or self.legal_name
