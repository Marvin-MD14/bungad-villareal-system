# backend/api/management/commands/bootstrap_company.py

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from api.models import (
    Company, BusinessType, Business, Branch, UserAccess
)


class Command(BaseCommand):
    help = 'Bootstrap singleton Company, default BusinessTypes, initial Businesses, and OWNER access.'

    def handle(self, *args, **options):
        # 1. Company singleton
        company = Company.get_solo()
        company.legal_name = 'Bungad & Villareal Group'
        company.display_name = 'Bungad & Villareal'
        company.default_currency = 'PHP'
        company.timezone = 'Asia/Manila'
        company.save()
        self.stdout.write(self.style.SUCCESS(f"Company ensured: {company.legal_name}"))

        # 2. Business types
        btypes_data = [
            {'code': 'spa', 'name': 'Spa & Wellness', 'icon': 'sparkles', 'default_unit': 'session', 'tracks_stock': False},
            {'code': 'retail', 'name': 'Retail & Cosmetics', 'icon': 'shopping-bag', 'default_unit': 'pc', 'tracks_stock': True},
            {'code': 'restaurant', 'name': 'Restaurant / Food', 'icon': 'utensils', 'default_unit': 'order', 'tracks_stock': True},
            {'code': 'auto-spa', 'name': 'Auto Spa & Detailing', 'icon': 'car', 'default_unit': 'service', 'tracks_stock': True},
        ]
        created_btypes = {}
        for bt in btypes_data:
            obj, _ = BusinessType.objects.get_or_create(
                code=bt['code'],
                defaults={
                    'name': bt['name'],
                    'icon': bt['icon'],
                    'default_unit': bt['default_unit'],
                    'tracks_stock': bt['tracks_stock'],
                }
            )
            created_btypes[bt['code']] = obj
        self.stdout.write(self.style.SUCCESS(f"Business types ensured: {list(created_btypes.keys())}"))

        # 3. Default Businesses
        businesses_data = [
            {'slug': 'vss', 'name': 'Villareal Spa Services', 'type': 'spa'},
            {'slug': 'vreal', 'name': 'VReal Products', 'type': 'retail'},
            {'slug': 'bb', 'name': 'BB Retail', 'type': 'retail'},
            {'slug': 'panganan', 'name': 'Panganan Menu', 'type': 'restaurant'},
            {'slug': 'kb', 'name': 'KB Items', 'type': 'retail'},
            {'slug': 'autospa', 'name': 'Auto Spa Services', 'type': 'auto-spa'},
        ]
        created_businesses = {}
        for b in businesses_data:
            obj, _ = Business.objects.get_or_create(
                slug=b['slug'],
                defaults={
                    'name': b['name'],
                    'business_type': created_btypes[b['type']],
                    'is_active': True,
                }
            )
            created_businesses[b['slug']] = obj
        self.stdout.write(self.style.SUCCESS(f"Businesses ensured: {list(created_businesses.keys())}"))

        # 4. Attach unassigned branches to primary business (e.g. VSS)
        primary_biz = created_businesses['vss']
        unassigned_branches = Branch.objects.filter(business__isnull=True)
        count = unassigned_branches.count()
        if count:
            unassigned_branches.update(business=primary_biz)
            self.stdout.write(self.style.SUCCESS(f"Attached {count} branches to {primary_biz.name}"))

        # 5. Ensure superusers/staff have OWNER/COMPANY_ADMIN access
        superusers = User.objects.filter(is_superuser=True)
        for u in superusers:
            UserAccess.objects.get_or_create(
                user=u,
                role='OWNER',
                business=None,
                defaults={'is_primary': True, 'is_active': True}
            )
        self.stdout.write(self.style.SUCCESS("Bootstrap completed successfully."))
