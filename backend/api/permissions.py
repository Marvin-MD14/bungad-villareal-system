# backend/api/permissions.py

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
# SUPERADMIN  - everything.
# OWNER       - organization-wide, READ-ONLY + analytics. Owner accounts
#               cannot mutate operational data (tests enforce this).
# BRANCH_ADMIN- everything *within their branch scope*, except the
#               organization-level actions listed in BRANCH_ADMIN_DENIED.
# CASHIER     - front-of-house operations: catalogs, clients, rooms,
#               checkout/void, rewards claiming, own attendance.
# STAFF       - customer/room/attendance focused read + room assignments.
#               Staff do not see transactions, expenses or inventory values.
# ============================================================

ROLE_ACTIONS = {
    'SUPERADMIN': {'*'},
    'OWNER': {
        # --- VSS Services (read) ---
        'VSSService:list', 'VSSService:retrieve', 'VSSService:categories', 'VSSService:stats',
        # --- VReal Products (read) ---
        'VRealProduct:list', 'VRealProduct:retrieve', 'VRealProduct:categories', 'VRealProduct:stats',
        # --- BB Products (read) ---
        'BBProduct:list', 'BBProduct:retrieve',
        # --- Panganan Menu (read) ---
        'PangananMenu:list', 'PangananMenu:retrieve', 'PangananMenu:categories',
        # --- KB Items / Auto Spa (read) ---
        'KBItem:list', 'KBItem:retrieve',
        'AutoSpaService:list', 'AutoSpaService:retrieve',
        # --- Branch ---
        'Branch:list', 'Branch:retrieve', 'Branch:staffing', 'Branch:stats',
        # --- Product / inventory (read only) ---
        'Product:list', 'Product:retrieve', 'Product:low_stock', 'Product:by_category',
        'BranchInventory:list', 'BranchInventory:retrieve', 'BranchInventory:by_branch',
        # --- Unified catalog (read only) ---
        'Item:list', 'Item:retrieve',
        'Category:list', 'Category:retrieve',
        'BusinessItem:list', 'BusinessItem:retrieve',
        'InventoryLevel:list', 'InventoryLevel:retrieve',
        'StockMovement:list', 'StockMovement:retrieve',
        # --- Businesses & access (read only) ---
        'Business:list', 'Business:retrieve',
        'BusinessType:list', 'BusinessType:retrieve',
        'UserAccess:list', 'UserAccess:retrieve',
        # --- Client (read only, org-wide) ---
        'ClientProfile:list', 'ClientProfile:retrieve', 'ClientProfile:search',
        'ClientProfile:find_by_phone', 'ClientProfile:transactions',
        'ClientProfile:feedback', 'ClientProfile:rewards', 'ClientProfile:tier_info',
        # --- Room (read only: Owner is not a front-desk role) ---
        'RoomTable:list', 'RoomTable:retrieve', 'RoomTable:available', 'RoomTable:occupied',
        # --- Transaction (read only) ---
        'Transaction:list', 'Transaction:retrieve', 'Transaction:today', 'Transaction:stats',
        # --- Daily Sales (read only) ---
        'DailySales:list', 'DailySales:retrieve',
        # --- Dashboard ---
        'DashboardStats:summary', 'DashboardStats:branch_comparison',
        # --- User Profile ---
        'UserProfile:list', 'UserProfile:retrieve', 'UserProfile:me',
        # --- Attendance ---
        'Attendance:list', 'Attendance:retrieve', 'Attendance:today', 'Attendance:my_records',
        # --- Customer Feedback ---
        'CustomerFeedback:list', 'CustomerFeedback:retrieve', 'CustomerFeedback:stats',
        # --- Expense ---
        'Expense:list', 'Expense:retrieve', 'Expense:summary',
        # --- Audit Log ---
        'AuditLog:list', 'AuditLog:retrieve', 'AuditLog:recent',
        # --- Branch Catalog ---
        'BranchCatalog:by_branch',
        # --- Customer Rewards ---
        'CustomerReward:list', 'CustomerReward:retrieve', 'CustomerReward:by_customer',
        'CustomerTier:by_customer',
        # --- Reward Claims / notifications / detection ---
        'RewardClaim:list', 'RewardClaim:retrieve',
        'Notification:customer_alerts',
        'CustomerDetection:detect',
    },
    'BRANCH_ADMIN': {'*'},
    'CASHIER': {
        # --- Catalogs (read + pricing preview) ---
        'VSSService:list', 'VSSService:retrieve', 'VSSService:preview',
        'VSSService:categories', 'VSSService:stats',
        'VRealProduct:list', 'VRealProduct:retrieve', 'VRealProduct:preview',
        'VRealProduct:categories', 'VRealProduct:stats',
        'BBProduct:list', 'BBProduct:retrieve',
        'PangananMenu:list', 'PangananMenu:retrieve', 'PangananMenu:categories',
        'KBItem:list', 'KBItem:retrieve',
        'AutoSpaService:list', 'AutoSpaService:retrieve',
        # --- Product / inventory (read + receiving) ---
        'Product:list', 'Product:retrieve', 'Product:low_stock', 'Product:by_category',
        'BranchInventory:list', 'BranchInventory:retrieve', 'BranchInventory:by_branch',
        'BranchInventory:restock',
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
    },
    'STAFF': {
        # --- Catalogs (read) ---
        'VSSService:list', 'VSSService:retrieve', 'VSSService:preview',
        'VSSService:categories', 'VSSService:stats',
        'VRealProduct:list', 'VRealProduct:retrieve', 'VRealProduct:preview',
        'VRealProduct:categories', 'VRealProduct:stats',
        'BBProduct:list', 'BBProduct:retrieve',
        'PangananMenu:list', 'PangananMenu:retrieve', 'PangananMenu:categories',
        'KBItem:list', 'KBItem:retrieve',
        'AutoSpaService:list', 'AutoSpaService:retrieve',
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
    },
}

# Actions a wildcard role (currently BRANCH_ADMIN) must NOT perform:
# branch-level admins are scoped to their own branch and cannot change the
# organization structure or compare branches against each other.
BRANCH_ADMIN_DENIED_ACTIONS = {
    'Branch:create', 'Branch:update', 'Branch:partial_update', 'Branch:destroy',
    'UserProfile:create', 'UserProfile:update', 'UserProfile:partial_update',
    'UserProfile:destroy',
    'DashboardStats:branch_comparison',
    # Privilege escalation guards: access grants and org structure are company-level.
    'UserAccess:create', 'UserAccess:update', 'UserAccess:partial_update', 'UserAccess:destroy',
    'Business:create', 'Business:update', 'Business:partial_update', 'Business:destroy',
    'BusinessType:create', 'BusinessType:update', 'BusinessType:partial_update', 'BusinessType:destroy',
}


# Group names that may exist from earlier data sets or fixtures. Both the
# role codes used by UserProfile.ROLE_CHOICES and the display names used by
# the frontend / legacy groups resolve to the same canonical code.
ROLE_ALIASES = {
    'SUPERADMIN': 'SUPERADMIN',
    'Superadmin': 'SUPERADMIN',
    'OWNER': 'OWNER',
    'Owner': 'OWNER',
    'BRANCH_ADMIN': 'BRANCH_ADMIN',
    'Branch Admin': 'BRANCH_ADMIN',
    'Admin': 'BRANCH_ADMIN',
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
    """Return the canonical role code of a user.

    The UserProfile is authoritative; group membership is only a fallback for
    accounts created before profiles existed (and for unit-test users).
    """
    profile = getattr(user, 'profile', None)
    if profile is not None:
        return profile.role

    group_name = user.groups.values_list('name', flat=True).first()
    if group_name in ROLE_ALIASES:
        return ROLE_ALIASES[group_name]

    if user.is_superuser:
        return 'SUPERADMIN'
    if user.is_staff:
        return 'OWNER'
    return 'STAFF'


class RoleBasedPermission(BasePermission):
    message = 'Your user role does not have access to this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        role = get_user_role(request.user)
        allowed_actions = ROLE_ACTIONS.get(role, set())
        resource = view.__class__.__name__.replace('ViewSet', '')
        action = getattr(view, 'action', None) or METHOD_ACTIONS.get(request.method)

        if not action:
            return False

        action_key = f'{resource}:{action}'

        if '*' in allowed_actions:
            denied = BRANCH_ADMIN_DENIED_ACTIONS if role == 'BRANCH_ADMIN' else frozenset()
            return action_key not in denied

        if action_key in allowed_actions:
            return True

        # Read fallback for detail routes that do not expose a router action
        # (e.g. plain APIViews): GET is allowed when either list or retrieve is.
        if action in ('list', 'retrieve') and request.method == 'GET':
            return f'{resource}:list' in allowed_actions or f'{resource}:retrieve' in allowed_actions

        return False


class IsSuperAdmin(BasePermission):
    """Allow access only to Superadmin and Owner roles."""
    message = 'Only Superadmin or Owner can perform this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return get_user_role(request.user) in {'SUPERADMIN', 'OWNER'}


class IsBranchAdminOrAbove(BasePermission):
    """Allow access to Branch Admin, Owner, and Superadmin."""
    message = 'Only Branch Admin or above can perform this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return get_user_role(request.user) in {'SUPERADMIN', 'OWNER', 'BRANCH_ADMIN'}