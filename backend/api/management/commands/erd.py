"""The ERD as a *checkable artifact*, not a picture.

``ERD.md`` is the human-facing entity-relationship map.  Its ```` ``erd ```` fenced
block is a machine-readable registry of every relationship the ORM actually has —
this command builds that registry by introspecting the live model graph, so the
diagram cannot quietly disagree with the schema.

Usage::

    python manage.py erd                    # print the registry from the models
    python manage.py erd --check            # fail if ERD.md disagrees with them
    python manage.py erd --write            # rewrite the registry block in ERD.md
    python manage.py erd --mermaid          # print a generated erDiagram
    python manage.py erd --model Branch     # impact analysis: what points at it
    python manage.py erd --summary          # on_delete counts + scoping

``--check`` runs in CI (and in ``api/tests/test_erd.py``): add a foreign key
without drawing it, or change an ``on_delete`` without saying so, and the build
red-lights with the exact line to fix.
"""

import re
from collections import Counter
from pathlib import Path

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError

# The registry lives in the repo root's ERD.md, inside a fenced ```erd block.
ERD_PATH = Path(__file__).resolve().parents[4] / 'ERD.md'
BLOCK_RE = re.compile(r"```erd\n(?P<body>.*?)```", re.S)

APP_LABEL = 'api'


def model_registry():
    """Every model of the api app, plus django.contrib.auth.User.

    ``User`` is included because half the system points at it (staff, audit,
    attendance, tokens); a map without it would hide the edges people most need
    to see before changing a delete policy.
    """
    config = apps.get_app_config(APP_LABEL)
    models = sorted(config.get_models(), key=lambda m: m.__name__)
    from django.contrib.auth.models import User
    return models + [User]


def forward_relations(model):
    """Forward FK / O2O / M2M declared *on* ``model`` (no reverse side)."""
    fields = []
    for field in model._meta.get_fields():
        if getattr(field, 'auto_created', False):
            continue
        if not (field.many_to_one or field.one_to_one or field.many_to_many):
            continue
        fields.append(field)
    return sorted(fields, key=lambda f: f.name)


def describe(model, field):
    """One canonical registry line for one relationship."""
    if field.one_to_one:
        kind = 'o2o'
    elif field.many_to_many:
        kind = 'm2m'
    else:
        kind = 'fk'

    target = field.related_model.__name__
    parts = [kind]
    if kind != 'm2m':
        parts.append(field.remote_field.on_delete.__name__.upper())
        parts.append('null=yes' if getattr(field, 'null', False) else 'null=no')
    # Django's implicit reverse name is built from the *declaring* model
    # (Transaction.staff -> transaction_set), not the target.
    related_name = field.remote_field.related_name or (
        model._meta.model_name + '_set')
    parts.append(f'rn={related_name}')
    if getattr(field, 'unique', False) and kind == 'fk':
        parts.append('unique')
    if field.related_model is model:
        parts.append('self')
    if kind == 'm2m':
        parts.append(f'through={field.remote_field.through.__name__}')

    return f'{model.__name__}.{field.name} -> {target} [{" ".join(parts)}]'


def registry():
    """The full relationship registry, sorted and de-duplicated."""
    lines = []
    for model in model_registry():
        for field in forward_relations(model):
            lines.append(describe(model, field))
    return sorted(lines)


def registry_from_file(path):
    """Read the registry block out of ERD.md (comments and blanks ignored)."""
    if not path.exists():
        raise CommandError(f'{path} not found — the ERD file is missing.')
    match = BLOCK_RE.search(path.read_text(encoding='utf-8'))
    if not match:
        raise CommandError(
            f'{path} has no ```erd block. Add one, or run: manage.py erd --write'
        )
    return [
        line.strip() for line in match.group('body').splitlines()
        if line.strip() and not line.strip().startswith('#')
    ]


class Command(BaseCommand):
    help = 'Print or verify the system entity-relationship registry from the live models.'

    def add_arguments(self, parser):
        parser.add_argument('--check', action='store_true',
                            help='Fail if ERD.md disagrees with the models.')
        parser.add_argument('--write', action='store_true',
                            help='Rewrite the registry block inside ERD.md.')
        parser.add_argument('--mermaid', action='store_true',
                            help='Emit a generated Mermaid erDiagram.')
        parser.add_argument('--summary', action='store_true',
                            help='on_delete counts and the tenant-scoped model list.')
        parser.add_argument('--model', dest='model', default=None,
                            help='Impact analysis for one model (inbound + outbound).')
        parser.add_argument('--file', dest='file', default=None,
                            help='Override the ERD.md path.')

    # ------------------------------------------------------------------ output

    def handle(self, *args, **options):
        path = Path(options['file']) if options['file'] else ERD_PATH
        rows = registry()

        if options['model']:
            return self._impact(options['model'], rows)
        if options['mermaid']:
            return self.stdout.write(self.mermaid())
        if options['summary']:
            return self._summary(rows)
        if options['check']:
            return self._check(path, rows)
        if options['write']:
            return self._write(path, rows)

        for line in rows:
            self.stdout.write(line)
        self.stdout.write(
            f'# {len(rows)} relationships across {len(model_registry())} models')
        return None

    # ------------------------------------------------------------------ checks

    def _check(self, path, rows):
        documented = registry_from_file(path)
        missing = [line for line in rows if line not in documented]  # code has it, map lacks it
        stale = [line for line in documented if line not in rows]    # map claims it, code disagrees
        if not missing and not stale:
            self.stdout.write(self.style.SUCCESS(
                f'ERD.md matches the models ({len(rows)} relationships).'))
            return None

        if missing:
            self.stderr.write('Relationships in the code but missing from ERD.md:')
            for line in missing:
                self.stderr.write(f'  + {line}')
        if stale:
            self.stderr.write('Lines in ERD.md the models do not produce:')
            for line in stale:
                self.stderr.write(f'  - {line}')
        raise CommandError(
            'ERD.md is out of date. Edit the diagrams if the schema is what you '
            'wanted, or run `manage.py erd --write` if the schema change was the '
            'intended one.'
        )

    def _write(self, path, rows):
        text = path.read_text(encoding='utf-8') if path.exists() else ''
        body = ('# generated by `manage.py erd --write` — do not hand-edit this block;\n'
                '# edit the diagrams above and verify with `manage.py erd --check`.\n'
                + '\n'.join(rows))
        replacement = f'```erd\n{body}\n```\n'
        if BLOCK_RE.search(text):
            text = BLOCK_RE.sub(lambda _m: replacement, text, count=1)
        else:
            text = (text.rstrip() + '\n\n## Machine-readable relationship registry\n\n'
                    + replacement)
        path.write_text(text, encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(
            f'Wrote {len(rows)} relationship lines into {path}'))
        return None

    # ------------------------------------------------------------- diagnostics

    def _impact(self, name, rows):
        """What a model depends on, and what depends on it.

        This is the question to ask *before* changing an ``on_delete`` or
        deleting a row type: inbound lines are the ones that decide whether the
        change is a migration or an outage.
        """
        name = name.split('.')[-1]
        outbound = [r for r in rows if r.split('.')[0] == name]
        inbound = [r for r in rows if f'-> {name} [' in r]
        if not outbound and not inbound:
            raise CommandError(
                f'No relationship involving {name!r}. See: manage.py erd --summary')

        self.stdout.write(f'# {name}: {len(outbound)} outbound, {len(inbound)} inbound')
        self.stdout.write('# OUTBOUND — rows this kind points at '
                          '(this row disappears with them under CASCADE):')
        for line in outbound:
            self.stdout.write(f'  {line}')
        self.stdout.write('# INBOUND — rows that point here '
                          '(these decide what deleting one of us does):')
        for line in inbound:
            self.stdout.write(f'  {line}')
        return None

    def _summary(self, rows):
        policies = Counter()
        for row in rows:
            attrs = row.split('[', 1)[1].rstrip(']').split()
            if attrs[0] in ('fk', 'o2o'):
                policies[attrs[1]] += 1

        self.stdout.write(f'models: {len(model_registry())}   relationships: {len(rows)}')
        for policy, count in policies.most_common():
            self.stdout.write(f'  on_delete {policy:<9} {count}')

        tenant = sorted(
            model.__name__ for model in model_registry()
            if any(f.name == 'business' for f in model._meta.fields)
        )
        self.stdout.write(f'carries a business FK ({len(tenant)}): {", ".join(tenant)}')
        return None

    # ---------------------------------------------------------------- mermaid

    def mermaid(self):
        """A generated erDiagram — every entity, every edge, policy in the label.

        Hand-drawn diagrams in ERD.md read better; this one is guaranteed true.
        Paste it over a diagram when a schema change makes the drawing stale.
        """
        lines = ['```mermaid', 'erDiagram']
        for model in model_registry():
            keys = [f.name for f in model._meta.concrete_fields[:3]
                    if f.name not in ('id', 'created_at', 'updated_at')]
            lines.append(f'    {model.__name__} {{')
            lines.append('        int id PK')
            for name in keys:
                lines.append(f'        string {name}')
            lines.append('    }')

        for row in registry():
            source, _, rest = row.partition(' -> ')
            target, _, attrs = rest.partition(' [')
            attrs = attrs.rstrip(']')
            tokens = attrs.split()
            kind = tokens[0]
            label = ' '.join(t for t in tokens[1:]
                             if not t.startswith(('rn=', 'null=', 'through=')))
            src_name, _, field_name = source.partition('.')
            if kind == 'm2m':
                cardinals = f'{src_name} }}o--o{{ {target}'
            elif kind == 'o2o':
                cardinals = (f'{target} ||--o| {src_name}' if 'null=yes' in attrs
                             else f'{target} ||--|| {src_name}')
            else:
                cardinals = f'{target} ||--o{{ {src_name}'
            lines.append(f'    {cardinals} : "{field_name} {label}"')

        lines.append('```')
        return '\n'.join(lines)


