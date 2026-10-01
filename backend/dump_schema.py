import os, json
import importlib, pkgutil
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

import api
for mod in pkgutil.walk_packages(api.__path__, 'api.'):
    try:
        importlib.import_module(mod.name)
    except Exception:
        pass

from django.apps import apps

out = []

def rel_name(f):
    rm = f.related_model
    if isinstance(rm, str):
        from django.apps import apps as _a
        try:
            rm = _a.get_model(rm)
        except Exception:
            return rm.split('.')[-1]
    return rm.__name__

for m in apps.get_app_config('api').get_models():
    fields = []
    fks = []
    for f in m._meta.get_fields(include_hidden=False):
        if f.many_to_one:
            fields.append((f.name + '_id', 'FK -> ' + rel_name(f)))
            fks.append((f.name, rel_name(f)))
        elif f.one_to_one:
            fields.append((f.name + '_id', 'O2O -> ' + rel_name(f)))
            fks.append((f.name, rel_name(f)))
        elif f.one_to_many or f.many_to_many or f.one_to_many:
            pass  # reverse side; skip
        elif hasattr(f, 'column'):
            t = f.get_internal_type()
            if f.primary_key:
                t = 'PK'
            fields.append((f.name, t))
    m2m = [f.name + ' <> ' + rel_name(f)
           for f in m._meta.get_fields() if f.many_to_many and not f.auto_created]
    out.append({'model': m.__name__, 'table': m._meta.db_table,
                'fields': fields, 'fks': fks, 'm2m': m2m})

print(json.dumps(out, indent=1))
