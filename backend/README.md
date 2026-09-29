# Backend - Django API

Django 5.1 + Django REST Framework. Single company, many businesses, many branches, one catalog.
See [`../SYSTEM_DOCUMENTATION.md`](../SYSTEM_DOCUMENTATION.md) for the architecture, access-control
flow and the full endpoint reference.

## Setup

```bash
python -m pip install -r requirements.txt
copy .env.example .env        # DJANGO_SECRET_KEY, DJANGO_DEBUG, DJANGO_ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS
python manage.py migrate
```

`python-dotenv` loads `backend/.env`; real environment variables take precedence. `DEBUG` defaults
to `True` when `DJANGO_DEBUG` is unset - set it explicitly outside local development.

## Commands

| Command | Purpose |
|---------|---------|
| `python manage.py bootstrap_company` | Singleton `Company`, default `BusinessType`s, the initial businesses, `OWNER` grant |
| `python manage.py create_demo_users` | One demo account per role with matching `UserAccess` grants (never in production) |
| `python manage.py setup_demo_data` | Migrate + import catalog seed files + create demo users |
| `python manage.py import_vss_services <file>` | `DESCRIPTION<TAB>PRICE` seed file -> `Category`/`Item`/`BusinessItem` for business `vss` |
| `python manage.py import_vreal_products <file>` | Same, `item_type=PRODUCT`, business `vreal` |

## Checks

```bash
python manage.py check
python manage.py test api                  # api.tests: test_api + test_business_isolation + test_admin (33)
python manage.py test api.tests.test_business_isolation -v 2
python manage.py spectacular --file schema.yml
```

## Layout

```
core/            settings, urls, wsgi/asgi
api/
  company/       Company (singleton)
  business/      BusinessType, Business
  access/        UserAccess + middleware, authentication, context, scoping, managers, permissions
  catalog/       Category, Item, BusinessItem, InventoryLevel, StockMovement
  sales/         checkout / void_sale / receive_stock / adjust_stock  (all atomic)
  views.py       auth, operational viewsets and the read-only legacy catalog shims
  permissions.py ROLE_ACTIONS capability matrix
  tests/         role + business-isolation test suites
```

## Rules to keep

1. Never filter by business or branch by hand - use `ScopedQuerysetMixin` / `BusinessScopedManager`.
2. Never mutate `InventoryLevel.stock_qty` outside `api/sales/services.py`; every change needs a
   `StockMovement` row.
3. New capability checks go into `ROLE_ACTIONS`, not inside a view.
4. New endpoints get a business-isolation test (a second business must be invisible).
5. The legacy routes (`/api/vss-services/`, `/api/products/`, ...) are read-only shims slated for
   removal - build against `/api/catalog/*` instead.
