# backend/api/access/managers.py

from contextvars import ContextVar
from django.core.exceptions import ValidationError
from django.db import models

_active_business = ContextVar('active_business', default=None)
_company_wide = ContextVar('company_wide', default=False)


def set_business_context(business, company_wide=False):
    _active_business.set(business)
    _company_wide.set(company_wide)


def get_active_business():
    return _active_business.get()


def is_company_wide():
    return _company_wide.get()


class BusinessQuerySet(models.QuerySet):
    def for_business(self, business):
        return self.filter(business=business)

    def all_businesses(self):
        """Explicit cross-business access — company-wide roles / reports only."""
        return self


class BusinessScopedManager(models.Manager):
    """Default manager: scopes every query to the active business when context is active."""

    def get_queryset(self):
        qs = BusinessQuerySet(self.model, using=self._db)
        if _company_wide.get():
            return qs                                  # OWNER / COMPANY_ADMIN / ACCOUNTANT
        business = get_active_business()
        if business is None:
            # When outside of request context (e.g. tests / shell / tasks without middleware),
            # return full qs to avoid breaking standalone scripts, but in scoped request return none or qs
            return qs
        return qs.filter(business=business)


class BusinessScopedModel(models.Model):
    """Inherit on business-owned models if desired."""
    business = models.ForeignKey('api.Business', on_delete=models.CASCADE, editable=False)

    objects = BusinessScopedManager()      # default, auto-filtered
    all_objects = models.Manager()         # reports, management commands, admin

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.business_id:
            business = get_active_business()
            if business:
                self.business = business
        return super().save(*args, **kwargs)

    def clean(self):
        """Reject references that belong to another business."""
        super().clean()
        for field in self._meta.fields:
            value = getattr(self, field.name, None)
            other = getattr(value, 'business_id', None)
            if other is not None and self.business_id is not None and other != self.business_id:
                raise ValidationError({field.name: 'Cross-business reference is not allowed.'})
