# backend/api/management/commands/setup_demo_data.py
"""
One-shot environment bootstrap for local/frontend development.

Runs, in order:
  1. migrate                - apply schema migrations
  2. import_vss_services    - load backend/vss_services_data.txt
  3. import_vreal_products  - load backend/vreal_products_data.txt
  4. create_demo_users      - role demo accounts (SUPERADMIN..STAFF)

Usage:
    python manage.py setup_demo_data
    python manage.py setup_demo_data --skip-imports   # users only
    python manage.py setup_demo_data --skip-users     # catalog only
"""

import os
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

BASE_DIR = Path(__file__).resolve().parents[3]
VSS_DATA_FILE = BASE_DIR / 'vss_services_data.txt'
VREAL_DATA_FILE = BASE_DIR / 'vreal_products_data.txt'


class Command(BaseCommand):
    help = 'Migrate the database, import catalog seed files, and create demo users.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-imports',
            action='store_true',
            help='Skip importing the VSS/VReal catalog text files.',
        )
        parser.add_argument(
            '--skip-users',
            action='store_true',
            help='Skip creating demo user accounts.',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('Applying migrations...'))
        call_command('migrate', verbosity=0)

        if not options['skip_imports']:
            self._import_catalog()

        if not options['skip_users']:
            self.stdout.write(self.style.MIGRATE_HEADING('Creating demo users...'))
            call_command('create_demo_users')

        self.stdout.write(self.style.SUCCESS('setup_demo_data completed.'))

    def _import_catalog(self):
        for label, path, command in (
            ('VSS services', VSS_DATA_FILE, 'import_vss_services'),
            ('VReal products', VREAL_DATA_FILE, 'import_vreal_products'),
        ):
            if not os.path.exists(path):
                raise CommandError(f'{label} data file not found: {path}')
            self.stdout.write(self.style.MIGRATE_HEADING(f'Importing {label}...'))
            call_command(command, str(path), verbosity=0)