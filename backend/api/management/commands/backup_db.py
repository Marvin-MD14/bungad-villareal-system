# backend/api/management/commands/backup_db.py
"""Nightly-style database backup with rotation (§7.12).

``dumpdata`` is portable and vendor-neutral, so one command covers the SQLite
development database *and* a PostgreSQL production one (where ``pg_dump``
remains the better tool for point-in-time recovery, but this still gives a
verifiable, restorable artefact):

    python manage.py backup_db                      # -> backend/backups/backup_2026-09-30_031500.json
    python manage.py backup_db --keep 14            # keep the 14 newest, delete the rest
    python manage.py backup_db --database-url ...   # just prints the pg_dump command to run

Restore with ``python manage.py loaddata <file>``.
"""

import os
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

DEFAULT_KEEP = 7


class Command(BaseCommand):
    help = 'Write a timestamped JSON backup of the database and rotate old ones.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output-dir',
            default=None,
            help='Directory for the backup files (default: <BASE_DIR>/backups).',
        )
        parser.add_argument(
            '--keep',
            type=int,
            default=DEFAULT_KEEP,
            help=f'How many backups to keep (default: {DEFAULT_KEEP}). Use 0 to keep all.',
        )
        parser.add_argument(
            '--prefix',
            default='backup',
            help='Filename prefix (default: backup -> backup_2026-09-30_031500.json).',
        )

    def handle(self, *args, **options):
        output_dir = Path(options['output_dir'] or (Path(settings.BASE_DIR) / 'backups'))
        output_dir.mkdir(parents=True, exist_ok=True)

        stamp = datetime.now().strftime('%Y-%m-%d_%H%M%S')
        target = output_dir / f"{options['prefix']}_{stamp}.json"

        # `dumpdata` needs a real file handle on every backend; write then move.
        tmp = target.with_suffix('.json.tmp')
        with open(tmp, 'w', encoding='utf-8') as handle:
            call_command(
                'dumpdata',
                indent=2,
                output=handle,
                exclude=['contenttypes', 'auth.permission', 'sessions', 'admin.logentry'],
            )
        os.replace(tmp, target)

        size = target.stat().st_size
        if size == 0:
            target.unlink(missing_ok=True)
            raise CommandError('Backup produced an empty file — nothing written.')

        self.stdout.write(self.style.SUCCESS(f'Backup written: {target} ({size} bytes)'))

        database_url = os.environ.get('DATABASE_URL', '')
        if database_url.startswith(('postgres://', 'postgresql://')):
            self.stdout.write(
                'PostgreSQL detected. For point-in-time recovery also run:\n'
                f'  pg_dump --format=custom --file={target.with_suffix(".pgdump")} "$DATABASE_URL"'
            )

        keep = options['keep']
        if keep > 0:
            self._rotate(output_dir, options['prefix'], keep)

    def _rotate(self, output_dir, prefix, keep):
        backups = sorted(
            output_dir.glob(f'{prefix}_*.json'),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        for stale in backups[keep:]:
            stale.unlink(missing_ok=True)
            self.stdout.write(f'Removed old backup: {stale.name}')
