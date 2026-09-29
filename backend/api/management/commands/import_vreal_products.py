# backend/api/management/commands/import_vreal_products.py

from django.core.management.base import BaseCommand

from api.business.models import Business
from api.catalog.models import BusinessItem, Category, Item

# Legacy category code -> display label (matches the retired VRealProduct table)
CATEGORY_LABELS = {
    'SOAP': 'Soap',
    'FS_WASH': 'F/S Wash',
    'TONER': 'Toner',
    'NIGHT_CREAM': 'Night Cream',
    'MOISTURIZER': 'Moisturizer',
    'SUNBLOCK': 'Sunblock',
    'SERUM': 'Serum',
    'SET': 'Set',
    'GLUTA': 'Glutathione',
    'HAIR_CARE': 'Hair Care',
    'LOTION': 'Lotion',
    'OTHERS': 'Others',
    'SALON_PRODUCTS': 'Salon Products',
}


class Command(BaseCommand):
    help = 'Import VReal Products data from a text file into the unified catalog'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the data file')

    def handle(self, *args, **options):
        file_path = options['file_path']

        business, _ = Business.objects.get_or_create(
            slug='vreal',
            defaults={'name': 'VReal Products'},
        )

        with open(file_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()

        products = []
        current_category = None

        for line in lines:
            line = line.strip()
            if not line or line.isspace():
                continue

            is_category = False
            for key in CATEGORY_LABELS:
                if line.upper() == key.upper():
                    current_category = key
                    self.stdout.write(f'Processing category: {current_category}')
                    is_category = True
                    break
            if is_category:
                continue

            # Parse product and price (TAB separated)
            parts = line.split('\t')
            if len(parts) >= 2:
                product_name = parts[0].strip()
                price_str = parts[1].strip()

                if not price_str or not product_name:
                    continue

                try:
                    price = float(price_str.replace(',', ''))
                except ValueError:
                    continue

                products.append({
                    'category': current_category or 'OTHERS',
                    'product': product_name,
                    'price': price,
                })
                self.stdout.write(f'  Added: {product_name} - {price}')

        created_count = 0
        for product_data in products:
            try:
                label = CATEGORY_LABELS.get(product_data['category'], 'Others')
                category, _ = Category.objects.get_or_create(
                    name=label, kind='PRODUCT', defaults={'is_active': True}
                )
                item, _ = Item.objects.get_or_create(
                    name=product_data['product'],
                    item_type='PRODUCT',
                    defaults={
                        'category': category,
                        'selling_price': product_data['price'],
                        'cost_price': 0,
                        'tracks_stock': True,
                        'unit': 'pc',
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
                self.stdout.write(f'Error importing {product_data["product"]}: {e}')

        self.stdout.write(self.style.SUCCESS(f'Successfully imported {created_count} VReal Products'))
