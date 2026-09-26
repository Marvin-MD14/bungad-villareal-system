# backend/api/management/commands/import_vreal_products.py

from django.core.management.base import BaseCommand
from api.models import VRealProduct
import re

class Command(BaseCommand):
    help = 'Import VReal Products data from a text file'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the data file')

    def handle(self, *args, **options):
        file_path = options['file_path']
        
        # Clear existing data
        VRealProduct.objects.all().delete()
        
        with open(file_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()
            
        products = []
        current_category = None
        
        category_map = {
            'SOAP': 'SOAP',
            'F/S WASH': 'FS_WASH',
            'TONER': 'TONER',
            'NIGHT CREAM': 'NIGHT_CREAM',
            'MOISTURIZER': 'MOISTURIZER',
            'SUNBLOCK': 'SUNBLOCK',
            'SERUM': 'SERUM',
            'SET': 'SET',
            'GLUTA': 'GLUTA',
            'HAIR CARE': 'HAIR_CARE',
            'LOTION': 'LOTION',
            'OTHERS': 'OTHERS',
            'SALON PRODUCTS': 'SALON_PRODUCTS',
        }
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line.isspace():
                continue
                
            # Check if line is a category header
            is_category = False
            for key in category_map.keys():
                if line.upper() == key.upper():
                    current_category = category_map[key]
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
                
                if not price_str:
                    continue
                
                try:
                    price = float(price_str.replace(',', ''))
                except ValueError:
                    continue
                
                if not product_name:
                    continue
                
                if product_name in category_map:
                    continue
                
                products.append({
                    'category': current_category or 'OTHERS',
                    'product': product_name,
                    'price': price,
                    'is_active': True
                })
                self.stdout.write(f'  Added: {product_name} - {price}')
        
        # Bulk create products
        created_count = 0
        for product_data in products:
            try:
                VRealProduct.objects.create(**product_data)
                created_count += 1
            except Exception as e:
                self.stdout.write(f'Error creating {product_data["product"]}: {e}')
        
        self.stdout.write(self.style.SUCCESS(f'Successfully imported {created_count} VReal Products'))