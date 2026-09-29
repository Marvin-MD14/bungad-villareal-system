# Bungad & Villareal Management System

One company, many businesses (spa, retail, kitchen, auto spa), many branches - one POS, inventory,
loyalty and staff-management system with a single catalog and centralized access control.

* **Backend:** Django 5.1 + Django REST Framework (token & session auth, OpenAPI via drf-spectacular)
* **Frontend:** React 19 + Vite 8 + Tailwind 4
* **Database:** SQLite for local development (PostgreSQL recommended for production)

## Documentation

| Document | Read it when |
|----------|--------------|
| [`SYSTEM_DOCUMENTATION.md`](SYSTEM_DOCUMENTATION.md) | **Start here.** Data model, access control & business scoping, sales/inventory engine, full API reference, frontend map, commands, configuration, roadmap |
| In the app: **Documentation** page | Staff-facing handbook with detailed explanations — how checkout/stock/loyalty work, role expectations, error-message meanings, troubleshooting and setup. Searchable and printable; content lives in `frontend/src/components/documentation/content.js` |
| [`MULTI_BUSINESS_SAAS_PLAN.md`](MULTI_BUSINESS_SAAS_PLAN.md) | The refactor plan that was implemented (Phases 0-5) |
| [`MULTITENANT_SAAS_PLAN.md`](MULTITENANT_SAAS_PLAN.md) | Obsolete - assumed many companies; kept for history only |
| `backend/README.md` | Backend-only commands and environment setup |

## Quick start

```bash
# API - http://localhost:8000  (docs at /api/docs/)
cd backend
python -m pip install -r requirements.txt
copy .env.example .env          # set DJANGO_SECRET_KEY
python manage.py migrate
python manage.py bootstrap_company
python manage.py setup_demo_data
python manage.py createsuperuser
python manage.py runserver

# SPA - http://localhost:5173
cd ../frontend
npm install
npm run dev
```

## Verify

```bash
cd backend && python manage.py check && python manage.py test api   # 33 tests
cd frontend && npm run lint && npm run build
```

## Layout

```
backend/   Django project (core/) and the api/ app: company, business, access, catalog, sales
frontend/  React SPA (src/App.jsx shell + src/components pages)
```

Signed-in users are scoped to the business and branches of their `UserAccess` grant; send
`X-Business: <slug>` to switch between the businesses a user has been granted.