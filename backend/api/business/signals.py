"""Auto-provision a default outlet for every new Business.

A ``Business`` is the parent the Owner/superadmin creates, but every
operational row (sales, rooms, stock, attendance, expenses) hangs off a
``Branch``.  So a business created with no outlet is inert: you can see it in
the switcher but you cannot sell, stock or book anything against it until
someone remembers to add a branch by hand.

This receiver gives each business a single "Main" branch the moment it is
created, from *any* path (API, admin, management command), so a new business is
usable out of the box.  It runs once per business (``created=True``) and only
when the business has no branches yet; the Owner can add or rename more outlets
freely afterwards.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='api.Business', dispatch_uid='api_business_default_branch')
def create_default_branch(sender, instance, created, **kwargs):
    if not created:
        return
    from api.models import Branch  # deferred: avoids a business<->api.models import cycle

    if instance.branches.exists():
        return
    Branch.objects.create(business=instance, name='Main')


@receiver(post_save, sender='api.Business', dispatch_uid='api_business_default_payment_methods')
def create_default_payment_methods(sender, instance, created, **kwargs):
    """Every new business can take the four common tenders out of the box."""
    if not created:
        return
    from api.payments.models import PaymentMethod  # deferred: import cycle

    PaymentMethod.ensure_defaults(instance)
