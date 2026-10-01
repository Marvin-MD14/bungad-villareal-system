# backend/api/access/storage.py
"""Media storage that files every upload under its business (§8.2).

Uploads used to land in one flat ``media/`` tree, so two businesses could not
own a file of the same name and nothing marked which business a receipt or
product photo belonged to.  ``BusinessMediaStorage`` prefixes every stored name
with the *active* business:

    media/business_vss/items/soap.png
    media/business_panganan/receipts/2026-09-01.jpg
    media/company/business/logo.png      <- no active business (company-wide write)

The prefix comes from the same context var the scoping layer uses, so a company
wide (OWNER) write with no active business files under ``company/`` and a
business-scoped write files under its own folder.  Nothing else changes: URLs and
``FileField.url`` still resolve, because the prefix is part of the stored name.
"""

from django.core.files.storage import FileSystemStorage

from api.access.request_context import get_active_business, is_in_request

COMPANY_FOLDER = 'company'
BUSINESS_FOLDER_PREFIX = 'business_'
UNSCOPED_FOLDER = 'unscoped'


class BusinessMediaStorage(FileSystemStorage):
    """``FileSystemStorage`` that prefixes names with the active business."""

    def scope_folder(self):
        business = get_active_business()
        if business is not None:
            slug = getattr(business, 'slug', None) or business.pk
            return f'{BUSINESS_FOLDER_PREFIX}{slug}'
        # Inside a request with no resolvable business the row itself is
        # company-level (Company logo, Business logo, staff avatar).
        return COMPANY_FOLDER if is_in_request() else UNSCOPED_FOLDER

    def get_available_name(self, name, max_length=None):
        if name.startswith(f'{BUSINESS_FOLDER_PREFIX}') or name.startswith(f'{COMPANY_FOLDER}/'):
            return super().get_available_name(name, max_length)
        return super().get_available_name(f'{self.scope_folder()}/{name}', max_length)
