# backend/api/access/managers.py

from django.core.exceptions import ValidationError
from django.db import models

# The context vars live in a Django-free module so the JSON log formatter can
# read them while `django.setup()` is still configuring LOGGING.  They are
# re-exported here because this is where callers expect them.
from api.access.request_context import (  # noqa: F401
    clear_context,
    get_active_business,
    get_log_context,
    is_company_wide,
    is_in_request,
    set_business_context,
    set_in_request,
    set_log_context,
)



class BusinessQuerySet(models.QuerySet):
    def for_business(self, business):
        return self.filter(business=business)

    def all_businesses(self):
        """Explicit cross-business access — company-wide roles / reports only."""
        return self


class BusinessScopedManager(models.Manager):
    """Default manager: scopes every query to the active business (§6.1).

    * company-wide grant (OWNER / COMPANY_ADMIN / ACCOUNTANT / superuser)
      → every business;
    * active business → only that business's rows;
    * **inside a request with no business resolved → ``qs.none()``** (fail
      closed, so a forgotten ``.filter()`` can never leak another business);
    * outside a request (commands, shell, tests) → system-wide, exactly what
      ``all_objects`` returns.
    """

    def get_queryset(self):
        qs = BusinessQuerySet(self.model, using=self._db)
        if is_company_wide():
            return qs
        business = get_active_business()
        if business is None:
            return qs.none() if is_in_request() else qs
        return qs.filter(business=business)


def resolve_business_id(instance):
    """Business id for ``instance``: its branch's business first, else the active one.

    The branch is authoritative (an outlet belongs to exactly one business), so
    this also stamps rows written by company-wide users, whose active grant
    deliberately carries no business.
    """
    branch_id = getattr(instance, 'branch_id', None)
    if branch_id:
        from api.models import Branch  # local import: api.models imports this module
        found = Branch.objects.filter(pk=branch_id).values_list('business_id', flat=True).first()
        if found:
            return found
    business = get_active_business()
    return business.pk if business is not None else None


class BusinessStampMixin:
    """Auto-fill ``business_id`` on save so scoped reads never lose rows.

    Without this, a write whose serializer does not carry ``business`` stores
    ``business_id = NULL``, and ``api.access.scoping.auto_scope`` then hides that
    row from the very user who created it (their grant filters ``business=...``)
    — a 201 that silently disappears.  An explicit value always wins.

    When the model's ``business`` column is **not nullable** and nothing could be
    resolved, saving is refused (plan §6.1) instead of letting the database raise
    an opaque ``IntegrityError``.
    """

    def stamp_business(self):
        if getattr(self, 'business_id', None) is not None:
            return
        resolved = resolve_business_id(self)
        if resolved is not None:
            self.business_id = resolved
            return
        try:
            field = self._meta.get_field('business')
        except Exception:  # pragma: no cover - model without a business FK
            return
        if not field.null and not field.has_default():
            raise ValueError(
                f'{type(self).__name__}: no active business — pass `business` explicitly '
                'or write inside a request with a resolved business grant.'
            )

    def save(self, *args, **kwargs):
        self.stamp_business()
        return super().save(*args, **kwargs)


class BusinessScopedModel(BusinessStampMixin, models.Model):
    """Abstract base for business-owned models that do not declare ``business``.

    ``objects`` filters by the active business, ``all_objects`` is the unfiltered
    manager for reports, management commands and the admin.
    """
    business = models.ForeignKey('api.Business', on_delete=models.CASCADE, editable=False)

    objects = BusinessScopedManager()      # default, auto-filtered
    all_objects = models.Manager()         # reports, management commands, admin

    class Meta:
        abstract = True

    def clean(self):
        """Reject references that belong to another business."""
        super().clean()
        for field in self._meta.fields:
            value = getattr(self, field.name, None)
            other = getattr(value, 'business_id', None)
            if other is not None and self.business_id is not None and other != self.business_id:
                raise ValidationError({field.name: 'Cross-business reference is not allowed.'})


class BusinessScopedQuerySetModel(BusinessStampMixin, models.Model):
    """The same auto-filtering managers for models that declare their own ``business`` FK.

    ``Transaction``, ``Expense``, ``Branch`` … already own the FK (some keep it
    nullable so company-level rows, such as a LOGIN audit entry, stay possible),
    so they cannot inherit :class:`BusinessScopedModel` without a risky data
    migration.  They get the identical ``objects`` / ``all_objects`` pair instead.
    """

    objects = BusinessScopedManager()      # default, auto-filtered
    all_objects = models.Manager()         # reports, management commands, admin

    class Meta:
        abstract = True
