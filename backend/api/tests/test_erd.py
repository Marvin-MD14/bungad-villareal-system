"""The ERD registry stays honest (§ ERD.md).

``ERD.md`` is the map people act on, and ``manage.py erd --check`` is the only thing
stopping it from describing a schema that no longer exists. These tests are the local
copy of that CI gate — plus the part a CI gate cannot do for itself: proving the gate
*can* fail, because a check that never red-lights is decoration.
"""

import io
import os
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase

from ..management.commands import erd


class RegistryTests(SimpleTestCase):
    def test_erd_md_matches_the_models(self):
        """The gate itself: the registry block and the schema agree."""
        out = io.StringIO()
        call_command('erd', check=True, stdout=out)
        self.assertIn('matches the models', out.getvalue())

    def test_tenant_edges_are_documented(self):
        """The edges isolation depends on must appear with their real policy."""
        rows = erd.registry()
        for source in ('Branch.business', 'ClientProfile.business',
                       'UserAccess.business', 'Transaction.business',
                       'BusinessItem.business'):
            line = next((r for r in rows if r.startswith(f'{source} -> ')), None)
            self.assertIsNotNone(line, f'{source} is missing from the registry')
            self.assertIn('-> Business [', line)

    def test_money_rows_protect_their_outlet_and_catalog_item(self):
        """Receipts must not evaporate when an outlet or item is retired."""
        rows = {r.split(' -> ')[0]: r for r in erd.registry()}
        self.assertIn('PROTECT', rows['Transaction.branch'])
        self.assertIn('PROTECT', rows['TransactionItem.item'])
        self.assertIn('PROTECT', rows['InventoryLevel.item'])

    def test_registry_covers_every_declared_relation(self):
        """Nothing may hide: counted from model metadata, not from the document."""
        expected = sum(
            len(erd.forward_relations(model)) for model in erd.model_registry()
        )
        self.assertEqual(len(erd.registry()), expected)
        self.assertGreater(expected, 50, 'the map should cover the whole schema')


class CommandOutputTests(SimpleTestCase):
    def test_impact_analysis_reports_inbound_guards(self):
        out = io.StringIO()
        call_command('erd', model='Branch', stdout=out)
        text = out.getvalue()
        self.assertIn('INBOUND', text)
        self.assertIn('Transaction.branch -> Branch [fk PROTECT', text)

    def test_summary_lists_every_business_carrying_model(self):
        out = io.StringIO()
        call_command('erd', summary=True, stdout=out)
        text = out.getvalue()
        tenants = [
            model.__name__ for model in erd.model_registry()
            if any(f.name == 'business' for f in model._meta.fields)
        ]
        for name in tenants:
            self.assertIn(name, text)
        self.assertIn(f'relationships: {len(erd.registry())}', text)


class GateIntegrityTests(SimpleTestCase):
    def test_check_fails_when_a_relationship_is_undocumented(self):
        """Delete one line from the block and --check must refuse to pass."""
        text = erd.ERD_PATH.read_text(encoding='utf-8')
        drop = 'Item.category -> Category'
        stale = text.replace(drop, '# (removed on purpose by this test)')
        self.assertNotEqual(stale, text, 'the fixture assumed a different registry')

        handle, path = tempfile.mkstemp(suffix='.md')
        with os.fdopen(handle, 'w', encoding='utf-8') as stream:
            stream.write(stale)
        self.addCleanup(os.unlink, path)

        errors = io.StringIO()
        with self.assertRaises(CommandError):
            call_command('erd', check=True, file=path, stderr=errors)
        self.assertIn(drop, errors.getvalue(),
                      '--check must name the relationship that went undocumented')

    def test_write_is_idempotent(self):
        """Regenerating twice must not duplicate the block or shift its content."""
        source = erd.ERD_PATH.read_text(encoding='utf-8')
        handle, path = tempfile.mkstemp(suffix='.md')
        with os.fdopen(handle, 'w', encoding='utf-8') as stream:
            stream.write(source)
        self.addCleanup(os.unlink, path)
        target = Path(path)

        call_command('erd', write=True, file=path, stdout=io.StringIO())
        first = erd.registry_from_file(target)
        call_command('erd', write=True, file=path, stdout=io.StringIO())
        second = erd.registry_from_file(target)

        self.assertEqual(first, second)
        self.assertEqual(second, erd.registry())
        self.assertEqual(Path(path).read_text(encoding='utf-8').count('```erd'), 1,
                         '--write must replace the block, never append a second one')
