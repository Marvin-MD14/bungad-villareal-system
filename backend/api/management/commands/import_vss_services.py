# backend/api/management/commands/import_vss_services.py

from django.core.management.base import BaseCommand
from api.models import VSSService
import re

class Command(BaseCommand):
    help = 'Import VSS Services data from a text file'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the data file')

    def handle(self, *args, **options):
        file_path = options['file_path']
        
        # Clear existing data
        VSSService.objects.all().delete()
        
        with open(file_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()
            
        services = []
        current_category = None
        
        # EXACT MATCH ng categories sa file
        category_map = {
            'RADIO FREQUENCY': 'RADIO_FREQUENCY',
            'SALON SERVICES': 'SALON_SERVICES',
            'HAND AND FOOT TREATMENT': 'HAND_FOOT_TREATMENT',
            'FACIAL TREAMENT': 'FACIAL_TREATMENT',
            'LASER THREATMENT': 'LASER_TREATMENT',
            'INSTANT BLEACHING AND SKIN WHITENING': 'BLEACHING_WHITENING',
            'HIFU - ULTERA': 'HIFU_ULTERA',
            'PICO WAY': 'PICO_WAY',
            'EYELASH EXTENSIONS': 'EYELASH_EXTENSIONS',
            'GLYCOLIC PEELING': 'GLYCOLIC_PEELING',
            'SKIN GROWTH REMOVAL': 'SKIN_GROWTH_REMOVAL',
            'WAXING': 'WAXING',
            'MASSAGE': 'MASSAGE',
            'MICRODERMABRASION': 'MICRODERMABRASION',
            'BODY SCRUB': 'BODY_SCRUB',
            'AESTHETIC TATTOO/ SEMI PERMANENT TATTOO': 'AESTHETIC_TATTOO',
            'PROMO PRICE': 'PROMO_PRICE',
            'PERMANENT HAIR REMOVAL': 'PERMANENT_HAIR_REMOVAL',
            'OTHER SERVICES': 'OTHER_SERVICES',
        }
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Check if line is a category header (exact match)
            if line in category_map:
                current_category = category_map[line]
                self.stdout.write(f'Processing category: {current_category}')
                continue
            
            # Check if line is a category header (case insensitive)
            found_category = False
            for key in category_map.keys():
                if line.upper() == key.upper():
                    current_category = category_map[key]
                    self.stdout.write(f'Processing category: {current_category}')
                    found_category = True
                    break
            
            if found_category:
                continue
            
            # Parse description and price (TAB separated)
            parts = line.split('\t')
            if len(parts) >= 2:
                description = parts[0].strip()
                price_str = parts[1].strip()
                
                if not price_str:
                    continue
                
                try:
                    price = float(price_str.replace(',', ''))
                except ValueError:
                    continue
                
                if not description:
                    continue
                
                # Skip if description looks like a category
                if description in category_map:
                    continue
                
                services.append({
                    'category': current_category or 'OTHER_SERVICES',
                    'description': description,
                    'price': price,
                    'is_active': True
                })
                self.stdout.write(f'  Added: {description} - {price}')
        
        # Bulk create services
        created_count = 0
        for service_data in services:
            try:
                VSSService.objects.create(**service_data)
                created_count += 1
            except Exception as e:
                self.stdout.write(f'Error creating {service_data["description"]}: {e}')
        
        self.stdout.write(self.style.SUCCESS(f'Successfully imported {created_count} VSS Services'))