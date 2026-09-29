# backend/api/management/commands/import_vss_services.py

from django.core.management.base import BaseCommand

from api.business.models import Business
from api.catalog.models import BusinessItem, Category, Item

# Legacy category code -> display label (matches the retired VSSService table)
CATEGORY_LABELS = {
    'RADIO_FREQUENCY': 'Radio Frequency',
    'SALON_SERVICES': 'Salon Services',
    'HAND_FOOT_TREATMENT': 'Hand and Foot Treatment',
    'FACIAL_TREATMENT': 'Facial Treatment',
    'LASER_TREATMENT': 'Laser Treatment',
    'BLEACHING_WHITENING': 'Instant Bleaching and Skin Whitening',
    'HIFU_ULTERA': 'HIFU - Ultera',
    'PICO_WAY': 'Pico Way',
    'EYELASH_EXTENSIONS': 'Eyelash Extensions',
    'GLYCOLIC_PEELING': 'Glycolic Peeling',
    'SKIN_GROWTH_REMOVAL': 'Skin Growth Removal',
    'WAXING': 'Waxing',
    'MASSAGE': 'Massage',
    'MICRODERMABRASION': 'Microdermabrasion',
    'BODY_SCRUB': 'Body Scrub',
    'AESTHETIC_TATTOO': 'Aesthetic Tattoo/Semi Permanent Tattoo',
    'PROMO_PRICE': 'Promo Price',
    'PERMANENT_HAIR_REMOVAL': 'Permanent Hair Removal',
    'OTHER_SERVICES': 'Other Services',
}


class Command(BaseCommand):
    help = 'Import VSS Services data from a text file into the unified catalog'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the data file')

    def handle(self, *args, **options):
        file_path = options['file_path']

        business, _ = Business.objects.get_or_create(
            slug='vss',
            defaults={'name': 'Villareal Spa Services'},
        )

        with open(file_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()

        services = []
        current_category = None

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Category header (exact or case-insensitive match)?
            matched = None
            for key in CATEGORY_LABELS:
                if line.upper() == key.upper():
                    matched = key
                    break
            if matched:
                current_category = matched
                self.stdout.write(f'Processing category: {current_category}')
                continue

            # Parse description and price (TAB separated)
            parts = line.split('\t')
            if len(parts) >= 2:
                description = parts[0].strip()
                price_str = parts[1].strip()

                if not price_str or not description:
                    continue

                try:
                    price = float(price_str.replace(',', ''))
                except ValueError:
                    continue

                services.append({
                    'category': current_category or 'OTHER_SERVICES',
                    'description': description,
                    'price': price,
                })
                self.stdout.write(f'  Added: {description} - {price}')

        created_count = 0
        for service_data in services:
            try:
                label = CATEGORY_LABELS.get(service_data['category'], 'Other Services')
                category, _ = Category.objects.get_or_create(
                    name=label, kind='SERVICE', defaults={'is_active': True}
                )
                item, _ = Item.objects.get_or_create(
                    name=service_data['description'],
                    item_type='SERVICE',
                    defaults={
                        'category': category,
                        'selling_price': service_data['price'],
                        'cost_price': 0,
                        'tracks_stock': False,
                        'unit': 'session',
                        'is_active': True,
                    },
                )
                if item.category_id != category.id:
                    item.category = category
                    item.save(update_fields=['category'])
                BusinessItem.objects.get_or_create(
                    business=business, item=item, defaults={'is_available': True}
                )
                created_count += 1
            except Exception as e:
                self.stdout.write(f'Error importing {service_data["description"]}: {e}')

        self.stdout.write(self.style.SUCCESS(f'Successfully imported {created_count} VSS Services'))
