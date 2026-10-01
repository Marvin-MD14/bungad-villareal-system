# backend/api/permissions.py

from api.access.context import ensure_business_context
from rest_framework.permissions import BasePermission


# ============================================================
# ROLE POLICY
# ------------------------------------------------------------
# Every entry is "<Resource>:<action>" where Resource is the viewset
# class name without the "ViewSet" suffix and <action> is the DRF
# action name (list/retrieve/create/update/partial_update/destroy or a
# custom @action name). The matrix below is the single source of truth
# for authorization - viewsets must not re-check roles themselves.
#
# SUPERADMIN  - the platform operator: creates/retires businesses and business
#               types, hands out access grants, changes company settings.
# OWNER       - the company owner: everything across every business, but not the
#               platform itself (it may not restructure the tenant it runs on).
# COMPANY_ADMIN - every business, except user management and business types.
# ACCOUNTANT  - company-wide money views + expense bookkeeping, never selling.
# BUSINESS_MANAGER - everything inside *one* business (and only the branches the
#               grant ticks), except company-level actions — this is what
#               BRANCH_ADMIN used to be.
# SUPERVISOR  - a Business Manager who may not add/delete catalog entries.
# CASHIER     - front-of-house operations: catalogs, clients, rooms,
#               checkout/void, rewards claiming, own attendance.
# STAFF       - customer/room/attendance focused read + room assignments.
#               Staff do not see transactions, expenses or inventory values.
# ============================================================

ROLE_ACTIONS = {
    # The platform operator and the company owner are both wildcard roles; the
    # split between them lives entirely in DENIED_ACTIONS below.
    'SUPERADMIN': {'*'},
    'OWNER': {'*'},
    'CASHIER': {
        # --- Catalogs (read + pricing preview) ---
        # --- Unified catalog (read + stock receiving) ---
        'Item:list', 'Item:retrieve',
        'Category:list', 'Category:retrieve',
        'BusinessItem:list', 'BusinessItem:retrieve',
        'InventoryLevel:list', 'InventoryLevel:retrieve', 'InventoryLevel:restock',
        'StockMovement:list', 'StockMovement:retrieve',
        # --- Businesses & access (read) ---
        'Business:list', 'Business:retrieve',
        'BusinessType:list', 'BusinessType:retrieve',
        'UserAccess:list', 'UserAccess:retrieve',
        # --- Branch (read) ---
        'Branch:list', 'Branch:retrieve',
        # --- Client ---
        'ClientProfile:list', 'ClientProfile:retrieve', 'ClientProfile:create',
        'ClientProfile:search', 'ClientProfile:find_by_phone', 'ClientProfile:tier_info',
        'ClientProfile:transactions', 'ClientProfile:feedback', 'ClientProfile:rewards',
        # --- Room ---
        'RoomTable:list', 'RoomTable:retrieve', 'RoomTable:available',
        'RoomTable:occupied', 'RoomTable:check_in', 'RoomTable:check_out',
        # --- Transaction (checkout/void only: raw create/update/destroy are blocked) ---
        'Transaction:list', 'Transaction:retrieve',
        'Transaction:today', 'Transaction:stats', 'Transaction:checkout', 'Transaction:void',
        # --- Daily Sales (read) ---
        'DailySales:list', 'DailySales:retrieve',
        # --- Dashboard ---
        'DashboardStats:summary',
        # --- User Profile (own profile + branch directory) ---
        'UserProfile:list', 'UserProfile:retrieve', 'UserProfile:me',
        # --- Attendance (self service) ---
        'Attendance:list', 'Attendance:retrieve',
        'Attendance:today', 'Attendance:my_records', 'Attendance:check_in', 'Attendance:check_out',
        # --- Customer Feedback ---
        'CustomerFeedback:list', 'CustomerFeedback:retrieve', 'CustomerFeedback:create',
        # --- Expense (view only) ---
        'Expense:list', 'Expense:retrieve',
        # --- Branch Catalog (para sa POS) ---
        'BranchCatalog:by_branch',
        # --- Customer Rewards ---
        'CustomerReward:list', 'CustomerReward:retrieve', 'CustomerReward:claim',
        'CustomerReward:by_customer', 'CustomerTier:by_customer',
        'RewardClaim:list', 'RewardClaim:retrieve',
        # --- Cashier notifications + customer auto-detection ---
        'Notification:customer_alerts',
        'CustomerDetection:detect',
        # --- Payments, shifts, loyalty config/ledger (priority modules) ---
        'PaymentMethod:list', 'PaymentMethod:retrieve',
        'Payment:list', 'Payment:retrieve',
        'CashierShift:list', 'CashierShift:retrieve',
        'CashierShift:open_shift', 'CashierShift:close_shift', 'CashierShift:current',
        'LoyaltyProgram:list', 'LoyaltyProgram:retrieve',
        'LoyaltyProgram:for_current_business',
        'LoyaltyTransaction:list', 'LoyaltyTransaction:retrieve',
    },
    'STAFF': {
        # --- Catalogs (read) ---
        # --- Unified catalog (read) ---
        'Item:list', 'Item:retrieve',
        'Category:list', 'Category:retrieve',
        'Business:list', 'Business:retrieve',
        'BusinessType:list', 'BusinessType:retrieve',
        # --- Client (read + lookup) ---
        'ClientProfile:list', 'ClientProfile:retrieve', 'ClientProfile:search',
        'ClientProfile:find_by_phone', 'ClientProfile:tier_info', 'ClientProfile:rewards',
        # --- Room ---
        'RoomTable:list', 'RoomTable:retrieve', 'RoomTable:available',
        'RoomTable:occupied', 'RoomTable:check_in', 'RoomTable:check_out',
        # --- Dashboard ---
        'DashboardStats:summary',
        # --- User Profile (own profile + branch directory) ---
        'UserProfile:list', 'UserProfile:retrieve', 'UserProfile:me',
        # --- Attendance (self service) ---
        'Attendance:list', 'Attendance:retrieve',
        'Attendance:today', 'Attendance:my_records', 'Attendance:check_in', 'Attendance:check_out',
        # --- Customer Feedback ---
        'CustomerFeedback:list', 'CustomerFeedback:retrieve', 'CustomerFeedback:create',
        # --- Branch Catalog (para sa POS view) ---
        'BranchCatalog:by_branch',
        # --- Customer Rewards (view only) ---
        'CustomerReward:list', 'CustomerReward:retrieve', 'CustomerReward:by_customer',
        'CustomerTier:by_customer',
        # --- Payments & loyalty config (POS read-only) ---
        'PaymentMethod:list', 'PaymentMethod:retrieve',
        'Payment:list', 'Payment:retrieve',
        'CashierShift:list', 'CashierShift:retrieve', 'CashierShift:current',
        'LoyaltyProgram:list', 'LoyaltyProgram:retrieve',
        'LoyaltyProgram:for_current_business',
        'LoyaltyTransaction:list', 'LoyaltyTransaction:retrieve',
    },
    # --- Grant-driven capability codes (§6.3) ---
    # Wildcards: judged against DENIED_ACTIONS.
    'COMPANY_ADMIN': {'*'},
    'BUSINESS_MANAGER': {'*'},
    'SUPERVISOR': {'*'},
    'ACCOUNTANT': {
        # Reports and the money views, plus expense bookkeeping.  No checkout,
        # no stock writes, no access management.
        'DashboardStats:summary', 'DashboardStats:branch_comparison',
        'Transaction:list', 'Transaction:retrieve', 'Transaction:today', 'Transaction:stats',
        'TransactionItem:list', 'TransactionItem:retrieve',
        'DailySales:list', 'DailySales:retrieve',
        'Expense:list', 'Expense:retrieve', 'Expense:summary',
        'Expense:create', 'Expense:update', 'Expense:partial_update', 'Expense:destroy',
        'Item:list', 'Item:retrieve',
        'Category:list', 'Category:retrieve',
        'InventoryLevel:list', 'InventoryLevel:retrieve',
        'StockMovement:list', 'StockMovement:retrieve',
        'Business:list', 'Business:retrieve',
        'Company:retrieve',
        'AuditLog:list', 'AuditLog:retrieve',
        # --- Payments & till reconciliation (money views only) ---
        'Payment:list', 'Payment:retrieve',
        'PaymentMethod:list', 'PaymentMethod:retrieve',
        'CashierShift:list', 'CashierShift:retrieve',
        'LoyaltyProgram:list', 'LoyaltyTransaction:list', 'LoyaltyTransaction:retrieve',
    },
}

# Actions that change the *platform* rather than running a business: creating or
# retiring businesses, editing the business-type dictionary, and handing out
# access grants.  These belong to the SUPERADMIN, who operates the SaaS — the
# Owner runs the company day to day and must not be able to restructure the
# tenant it runs on or mint new privileges.
PLATFORM_DENIED_ACTIONS = {
    'UserAccess:create', 'UserAccess:update', 'UserAccess:partial_update', 'UserAccess:destroy',
    'Business:create', 'Business:update', 'Business:partial_update', 'Business:destroy',
    'BusinessType:create', 'BusinessType:update', 'BusinessType:partial_update',
    'BusinessType:destroy',
    'Company:update',
}

# Actions a wildcard business role (BUSINESS_MANAGER) must NOT perform:
# business-level admins are scoped to their own business and cannot change the
# organization structure or compare businesses against each other.
ORGANIZATION_DENIED_ACTIONS = {
    'Branch:create', 'Branch:update', 'Branch:partial_update', 'Branch:destroy',
    'UserProfile:create', 'UserProfile:update', 'UserProfile:partial_update',
    'UserProfile:destroy',
    'DashboardStats:branch_comparison',
} | PLATFORM_DENIED_ACTIONS

# Money rows are immutable for every scoped wildcard role too: corrections go
# through /transactions/{id}/void/ (the viewset already refuses DELETE, this
# keeps the policy readable from one place).  Tenders and loyalty ledger rows
# follow the same rule — reverse them with a new row, never edit or delete.
IMMUTABLE_ROW_DENIED_ACTIONS = {
    'Transaction:destroy', 'TransactionItem:destroy',
    'Payment:update', 'Payment:partial_update', 'Payment:destroy',
    'LoyaltyTransaction:update', 'LoyaltyTransaction:partial_update',
    'LoyaltyTransaction:destroy',
    'LoyaltyProgram:destroy',
    'CashierShift:update', 'CashierShift:partial_update', 'CashierShift:destroy',
}

# Business Manager: everything inside *one* business — same org-level denials as
# a branch admin (org structure, other businesses, company settings).
# Business Manager: everything inside *one* business — the org-level denials plus
# the company settings a business manager must never touch (§6.3).
BUSINESS_MANAGER_DENIED_ACTIONS = (
    ORGANIZATION_DENIED_ACTIONS | IMMUTABLE_ROW_DENIED_ACTIONS | {'Company:update'}
)

# Supervisor: like a Business Manager but may not add or delete catalog entries
# (they can void, adjust stock and edit cost/price).
SUPERVISOR_DENIED_ACTIONS = BUSINESS_MANAGER_DENIED_ACTIONS | {
    'Item:create', 'Item:destroy',
    'Category:create', 'Category:destroy',
    'BusinessItem:create', 'BusinessItem:destroy',
}

# Company Admin: every business, but user management belongs to the Owner and
# business *types* are platform-level configuration (§5.1).
COMPANY_ADMIN_DENIED_ACTIONS = {
    'UserAccess:create', 'UserAccess:update', 'UserAccess:partial_update', 'UserAccess:destroy',
    'BusinessType:create', 'BusinessType:update', 'BusinessType:partial_update', 'BusinessType:destroy',
}

# ``UserAccess.role`` *is* the capability code (§6.3).  The legacy codes were
# renamed (BRANCH_ADMIN -> BUSINESS_MANAGER), so a grant no longer needs
# translating before it is judged and there is exactly one role system: the
# grant decides both scope *and* capability.
#
# §6.3 also folded SUPERADMIN into OWNER; they are distinct again. SUPERADMIN
# operates the platform (businesses, business types, access grants, company
# settings). OWNER runs the company across every business but cannot change the
# tenant it runs on.

DENIED_ACTIONS = {
    # The platform operator: nothing is off-limits at the tenant level.
    'SUPERADMIN': frozenset(),
    # The Owner reaches DELETE /transactions/ but the viewset itself answers 405
    # (§7.5): hard-deleting a money row is not an operation the API offers to
    # anyone, so it is the *method* that is refused, not the caller's identity.
    # Scoped wildcard roles (Business Manager, Supervisor) are refused earlier,
    # by these matrix denials, and get a 403 instead.
    'OWNER': PLATFORM_DENIED_ACTIONS,
    'BUSINESS_MANAGER': BUSINESS_MANAGER_DENIED_ACTIONS,
    'SUPERVISOR': SUPERVISOR_DENIED_ACTIONS,
    'COMPANY_ADMIN': COMPANY_ADMIN_DENIED_ACTIONS,
}


# Group names that may exist from earlier data sets, fixtures or the SPA.  The
# renamed codes (§6.3) keep their old spellings working: a legacy "Branch Admin"
# group resolves to BUSINESS_MANAGER.  "Superadmin" is its own role again, not a
# synonym for Owner — the two do different jobs.
ROLE_ALIASES = {
    'SUPERADMIN': 'SUPERADMIN',
    'Superadmin': 'SUPERADMIN',
    'OWNER': 'OWNER',
    'Owner': 'OWNER',
    'COMPANY_ADMIN': 'COMPANY_ADMIN',
    'Company Admin': 'COMPANY_ADMIN',
    'ACCOUNTANT': 'ACCOUNTANT',
    'Accountant': 'ACCOUNTANT',
    'BUSINESS_MANAGER': 'BUSINESS_MANAGER',
    'Business Manager': 'BUSINESS_MANAGER',
    'BRANCH_ADMIN': 'BUSINESS_MANAGER',
    'Branch Admin': 'BUSINESS_MANAGER',
    'Admin': 'BUSINESS_MANAGER',
    'SUPERVISOR': 'SUPERVISOR',
    'Supervisor': 'SUPERVISOR',
    'CASHIER': 'CASHIER',
    'Cashier': 'CASHIER',
    'STAFF': 'STAFF',
    'Staff': 'STAFF',
    'Therapist': 'STAFF',
    'Spa Therapist': 'STAFF',
    'Massage Therapist': 'STAFF',
}

METHOD_ACTIONS = {
    'GET': 'list',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'partial_update',
    'DELETE': 'destroy',
}


def get_user_role(user):
    """Return the legacy capability role of a user account.

    Request-time authorization should call :func:`get_effective_role` instead:
    this variant deliberately ignores ``UserAccess`` and exists for accounts
    created before grants existed (and for unit-test users).

    Group membership is the only fallback: accounts that own a ``UserAccess``
    grant are judged by that grant (see :func:`get_effective_role`), and this
    helper exists for grandfathered accounts and fixtures.
    """
    group_name = user.groups.values_list('name', flat=True).first()
    if group_name in ROLE_ALIASES:
        return ROLE_ALIASES[group_name]

    if user.is_superuser:
        return 'OWNER'
    if user.is_staff:
        return 'BUSINESS_MANAGER'
    return 'STAFF'


def get_effective_role(request, user=None):
    """Capability code for ``request``.

    §6.3 unified the two role systems: the *grant* supplies both scope and
    capability, so its role is returned verbatim.  Only accounts with no grant at
    all fall back to their legacy group name.  Token-auth requests resolve the
    grant late (inside ``initialize_request``), so this resolves on demand.
    """
    if user is None:
        user = getattr(request, 'user', None)
    grant = getattr(request, 'access', None)
    if grant is None:
        ensure_business_context(request)
        grant = getattr(request, 'access', None)
    if grant is not None:
        return grant.role
    return get_user_role(user)


def _grant_is_usable(request):
    """Once an account has grants, it needs an *active* one to act.

    ``UserAccess.is_active`` used to be ignored here, so revoking every grant
    still left a legacy role in charge.  Accounts that never had a grant keep
    working off their group/superuser role — the same migration window
    :func:`api.access.scoping.auto_scope` documents.
    """
    if request.user.is_superuser:
        return True
    ensure_business_context(request)
    if getattr(request, 'access', None) is not None or getattr(request, 'company_wide', False):
        return True
    from api.access.models import UserAccess  # local import: app-loading order

    return not UserAccess.objects.filter(user=request.user).exists()


class RoleBasedPermission(BasePermission):
    message = 'Your user role does not have access to this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not _grant_is_usable(request):
            return False

        role = get_effective_role(request)
        allowed_actions = ROLE_ACTIONS.get(role, set())
        resource = view.__class__.__name__.replace('ViewSet', '')
        action = getattr(view, 'action', None) or METHOD_ACTIONS.get(request.method)

        if not action:
            return False

        action_key = f'{resource}:{action}'

        if '*' in allowed_actions:
            return action_key not in DENIED_ACTIONS.get(role, frozenset())

        if action_key in allowed_actions:
            return True

        # Read fallback for detail routes that do not expose a router action
        # (e.g. plain APIViews): GET is allowed when either list or retrieve is.
        if action in ('list', 'retrieve') and request.method == 'GET':
            return f'{resource}:list' in allowed_actions or f'{resource}:retrieve' in allowed_actions

        return False


class IsSuperAdmin(BasePermission):
    """Allow access only to the company Owner (or a Django superuser)."""

    message = 'Only the company Owner can perform this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.is_superuser or get_effective_role(request) in {
            'SUPERADMIN', 'OWNER',
        }


class IsBusinessManagerOrAbove(BasePermission):
    """Allow access to Business Manager, Company Admin and Owner."""

    message = 'Only a Business Manager or above can perform this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.is_superuser or get_effective_role(request) in {
            'SUPERADMIN', 'OWNER', 'COMPANY_ADMIN', 'BUSINESS_MANAGER',
        }


# Historical name kept so existing imports keep working (§6.3 renamed the role,
# not the class).
IsBranchAdminOrAbove = IsBusinessManagerOrAbove


# ============================================================
# UI CAPABILITIES (§6.3)
# ------------------------------------------------------------
# The SPA hides navigation it knows the caller cannot use. That used to be a
# hand-written `ROLE_CAPABILITIES` map in App.jsx — a second copy of the policy
# above, free to drift from it. Each capability is defined here as a *probe*
# into the real matrix, so it is derived rather than restated: change
# ROLE_ACTIONS and the UI follows automatically.
UI_CAPABILITY_PROBES = {
    'dashboard': 'DashboardStats:summary',
    'sales': 'Transaction:list',
    'clients': 'ClientProfile:list',
    'client_manage': 'ClientProfile:create',
    'customer_rewards': 'CustomerReward:list',
    'rooms': 'RoomTable:list',
    'room_manage': 'RoomTable:check_in',
    'inventory': 'InventoryLevel:list',
    'inventory_manage': 'InventoryLevel:restock',
    'payments': 'Payment:list',
    'shifts': 'CashierShift:list',
    'loyalty': 'LoyaltyProgram:list',
    'catalog': 'Item:list',
    'catalog_manage': 'Item:create',
    'users': 'UserProfile:list',
    'user_manage': 'UserProfile:create',
    # "Administration" means running the operation. A probe like Branch:list or
    # Attendance:list is useless here — a cashier passes both, so the nav would
    # offer Administration to the front desk. Reading the receipt ledger is
    # granted to management/finance and not to front-of-house roles.
    'administration': 'TransactionItem:list',
    'audit': 'AuditLog:list',
    'documentation': None,  # the in-app handbook is open to every role
}


def role_allows(role, action_key):
    """The same grant/deny decision :class:`RoleBasedPermission` makes."""
    allowed = ROLE_ACTIONS.get(role, set())
    if '*' in allowed:
        return action_key not in DENIED_ACTIONS.get(role, frozenset())
    return action_key in allowed


def ui_capabilities_for(role):
    """The capability names the SPA may show for ``role``."""
    return sorted(
        capability
        for capability, probe in UI_CAPABILITY_PROBES.items()
        if probe is None or role_allows(role, probe)
    )


def role_choices():
    """``UserAccess`` roles, as data — the SPA builds its dropdowns from this."""
    from api.access.models import UserAccess  # local import: app-loading order

    return [{'value': value, 'label': label} for value, label in UserAccess.ROLE_CHOICES]


# ============================================================
# ROLE GUIDE (login-screen preview + in-app "My access" panel)
# ------------------------------------------------------------
# A human-readable summary of each role, generated from the same live matrix
# as the probes above: which pages appear and which actions are listed follows
# ``ui_capabilities_for`` automatically. The wording map is display vocabulary,
# not policy. The only per-role statements kept here are the tab the role
# should land on after sign-in and how its scope is phrased.
# ============================================================
CAPABILITY_GUIDE = {
    'dashboard': {'label': 'Dashboard', 'verb': 'view the performance dashboard'},
    'sales': {'label': 'Sales & POS', 'verb': 'ring up sales, checkout and void'},
    'clients': {'label': 'Clients', 'verb': 'look up clients and their history'},
    'client_manage': {'label': None, 'verb': 'add and edit client records'},
    'customer_rewards': {'label': 'Customer Rewards', 'verb': 'claim rewards for customers'},
    'rooms': {'label': 'Room Status', 'verb': 'watch live room activity'},
    'room_manage': {'label': None, 'verb': 'check rooms in and out'},
    'inventory': {'label': 'Inventory', 'verb': 'view stock levels'},
    'inventory_manage': {'label': None, 'verb': 'receive stock'},
    'payments': {'label': None, 'verb': 'review payments'},
    'shifts': {'label': None, 'verb': 'open and close a cashier shift'},
    'loyalty': {'label': None, 'verb': 'see loyalty programs'},
    'catalog': {'label': 'Catalog', 'verb': 'browse services and products'},
    'catalog_manage': {'label': None, 'verb': 'add and edit catalog items'},
    'users': {'label': 'User Profiling', 'verb': 'see the staff directory'},
    'user_manage': {'label': None, 'verb': 'add and manage staff accounts'},
    'administration': {'label': 'Administration', 'verb': 'run business administration'},
    'audit': {'label': 'Audit Logs', 'verb': 'read the security audit trail'},
    'documentation': {'label': 'Documentation', 'verb': None},
}

# Nav order the guide lists pages in — mirrors the SPA sidebar, not alphabetical.
GUIDE_NAV_ORDER = [
    'dashboard', 'sales', 'clients', 'customer_rewards', 'administration',
    'users', 'rooms', 'inventory', 'audit', 'documentation', 'catalog',
]

# Tab the role should land on after sign-in + how its scope is phrased.
ROLE_GUIDE_META = {
    'SUPERADMIN': ('dashboard', 'the platform itself — every business, business types and access grants.'),
    'OWNER': ('dashboard', 'every business of the company; switch businesses from the header picker.'),
    'COMPANY_ADMIN': ('dashboard', 'every business of the company, except user management and business types.'),
    'ACCOUNTANT': ('administration', 'the money of every business; no selling or floor duties.'),
    'BUSINESS_MANAGER': ('administration', 'one business, only the branches ticked on its grant (empty ticks = all branches).'),
    'SUPERVISOR': ('dashboard', 'one business like a Business Manager, but the catalog cannot be added to or pruned.'),
    'CASHIER': ('sales', 'its own register; sales, clients and rooms of its branch only.'),
    'STAFF': ('rooms', 'its own branch — clients, rooms and its own attendance; no sales or stock values.'),
}

GUIDE_LANDING_LABELS = {
    'dashboard': 'Dashboard',
    'sales': 'Sales & POS',
    'rooms': 'Room Status',
    'administration': 'Administration',
}


def role_guide_for(role):
    """What ``role`` can see, can do, and where it belongs after sign-in."""
    code = ROLE_ALIASES.get(role, role)
    caps = ui_capabilities_for(code)
    sees = [
        CAPABILITY_GUIDE[cap]['label']
        for cap in GUIDE_NAV_ORDER
        if cap in caps and CAPABILITY_GUIDE.get(cap, {}).get('label')
    ]
    does = [
        guide['verb']
        for cap, guide in CAPABILITY_GUIDE.items()
        if cap in caps and guide['verb']
    ]
    landing, scope = ROLE_GUIDE_META.get(
        code, ('dashboard', 'ask an administrator what this account covers.')
    )
    return {
        'role': code,
        'label': code.replace('_', ' ').title(),
        'capabilities': caps,
        'sees': sees,
        'does': does,
        'lands_on': landing,
        'lands_on_label': GUIDE_LANDING_LABELS.get(landing, 'Dashboard'),
        'scope': scope,
    }


def all_role_guides():
    """Guides keyed by role code, in ``ROLE_CHOICES`` order.

    A mapping (not a list) is the wire contract: the SPA looks a guide up by
    the signed-in role code, and the OpenAPI schema declares this response an
    object.  Insertion order still follows ``ROLE_CHOICES``.
    """
    from api.access.models import UserAccess  # local import: app-loading order

    return {code: role_guide_for(code) for code, _label in UserAccess.ROLE_CHOICES}
