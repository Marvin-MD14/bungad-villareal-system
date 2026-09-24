# backend/api/permissions.py

from rest_framework.permissions import BasePermission


ROLE_ACTIONS = {
    'SUPERADMIN': {'*'},
    'OWNER': {
        # VSS Services
        'VSSService:list', 'VSSService:retrieve', 'VSSService:categories', 'VSSService:stats',
        # VReal Products
        'VRealProduct:list', 'VRealProduct:retrieve', 'VRealProduct:categories', 'VRealProduct:stats',
        # BB Products
        'BBProduct:list', 'BBProduct:retrieve',
        # Panganan Menu
        'PangananMenu:list', 'PangananMenu:retrieve', 'PangananMenu:categories',
        # KB Items
        'KBItem:list', 'KBItem:retrieve',
        # Auto Spa
        'AutoSpaService:list', 'AutoSpaService:retrieve',
        # Branch
        'Branch:list', 'Branch:retrieve', 'Branch:staffing', 'Branch:stats',
        # Product
        'Product:list', 'Product:retrieve', 'Product:low_stock', 'Product:by_category',
        # Branch Inventory
        'BranchInventory:list', 'BranchInventory:retrieve', 'BranchInventory:by_branch',
        # Client
        'ClientProfile:list', 'ClientProfile:retrieve', 'ClientProfile:search',
        'ClientProfile:transactions', 'ClientProfile:feedback', 'ClientProfile:rewards',
        # Room
        'RoomTable:list', 'RoomTable:retrieve', 'RoomTable:available', 'RoomTable:occupied',
        # Transaction
        'Transaction:list', 'Transaction:retrieve', 'Transaction:today', 'Transaction:stats',
        # Dashboard
        'DashboardStats:summary', 'DashboardStats:branch_comparison',
        # User Profile
        'UserProfile:list', 'UserProfile:retrieve',
        # Attendance
        'Attendance:list', 'Attendance:retrieve', 'Attendance:today', 'Attendance:my_records',
        # Customer Feedback
        'CustomerFeedback:list', 'CustomerFeedback:retrieve', 'CustomerFeedback:stats',
        # Expense
        'Expense:list', 'Expense:retrieve', 'Expense:summary',
        # Audit Log
        'AuditLog:list', 'AuditLog:retrieve', 'AuditLog:recent',
        # Branch Catalog
        'BranchCatalog:by_branch',
        # Customer Rewards
        'CustomerReward:list', 'CustomerReward:retrieve', 'CustomerReward:by_customer',
        'CustomerTier:by_customer',
        # Reward Claims
        'RewardClaim:list', 'RewardClaim:retrieve',
    },
    'BRANCH_ADMIN': {'*'},
    'CASHIER': {
        # VSS Services
        'VSSService:list', 'VSSService:retrieve', 'VSSService:preview',
        'VSSService:categories', 'VSSService:stats',
        # VReal Products
        'VRealProduct:list', 'VRealProduct:retrieve', 'VRealProduct:preview',
        'VRealProduct:categories', 'VRealProduct:stats',
        # BB Products
        'BBProduct:list', 'BBProduct:retrieve',
        # Panganan Menu
        'PangananMenu:list', 'PangananMenu:retrieve', 'PangananMenu:categories',
        # KB Items
        'KBItem:list', 'KBItem:retrieve',
        # Auto Spa
        'AutoSpaService:list', 'AutoSpaService:retrieve',
        # Product
        'Product:list', 'Product:retrieve', 'Product:low_stock', 'Product:by_category',
        # Branch Inventory
        'BranchInventory:list', 'BranchInventory:retrieve', 'BranchInventory:by_branch',
        # Branch
        'Branch:list', 'Branch:retrieve',
        # Client
        'ClientProfile:list', 'ClientProfile:retrieve', 'ClientProfile:create',
        'ClientProfile:search', 'ClientProfile:transactions', 'ClientProfile:feedback',
        'ClientProfile:rewards',
        # Room
        'RoomTable:list', 'RoomTable:retrieve', 'RoomTable:available',
        'RoomTable:occupied', 'RoomTable:check_in', 'RoomTable:check_out',
        # Transaction
        'Transaction:list', 'Transaction:retrieve', 'Transaction:create',
        'Transaction:today', 'Transaction:stats', 'Transaction:checkout',
        # Dashboard
        'DashboardStats:summary',
        # Attendance
        'Attendance:today', 'Attendance:my_records', 'Attendance:check_in', 'Attendance:check_out',
        # Customer Feedback
        'CustomerFeedback:list', 'CustomerFeedback:retrieve', 'CustomerFeedback:create',
        # Expense (view only)
        'Expense:list', 'Expense:retrieve',
        # Branch Catalog (para sa POS)
        'BranchCatalog:by_branch',
        # Customer Rewards
        'CustomerReward:list', 'CustomerReward:retrieve', 'CustomerReward:claim',
        'CustomerReward:by_customer', 'CustomerTier:by_customer',
    },
    'STAFF': {
        # VSS Services
        'VSSService:list', 'VSSService:retrieve', 'VSSService:preview',
        'VSSService:categories', 'VSSService:stats',
        # VReal Products
        'VRealProduct:list', 'VRealProduct:retrieve', 'VRealProduct:preview',
        'VRealProduct:categories', 'VRealProduct:stats',
        # BB Products
        'BBProduct:list', 'BBProduct:retrieve',
        # Panganan Menu
        'PangananMenu:list', 'PangananMenu:retrieve', 'PangananMenu:categories',
        # Client
        'ClientProfile:list', 'ClientProfile:retrieve', 'ClientProfile:search',
        # Room
        'RoomTable:list', 'RoomTable:retrieve', 'RoomTable:available',
        'RoomTable:occupied', 'RoomTable:check_in', 'RoomTable:check_out',
        # Dashboard
        'DashboardStats:summary',
        # Attendance
        'Attendance:today', 'Attendance:my_records', 'Attendance:check_in', 'Attendance:check_out',
        # Branch Catalog (para sa POS view)
        'BranchCatalog:by_branch',
        # Customer Rewards (view only)
        'CustomerReward:list', 'CustomerReward:retrieve', 'CustomerReward:by_customer',
        'CustomerTier:by_customer',
    },
}


def get_user_role(user):
    """Return the role code of a user."""
    if hasattr(user, 'profile'):
        return user.profile.role

    role = user.groups.values_list('name', flat=True).first()
    legacy_roles = {
        'Superadmin': 'SUPERADMIN',
        'Owner': 'OWNER',
        'Admin': 'BRANCH_ADMIN',
        'Cashier': 'CASHIER',
        'Therapist': 'STAFF',
    }
    if role in legacy_roles:
        return legacy_roles[role]
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

        if '*' in allowed_actions:
            # Branch Admin restrictions: cannot create/delete branches
            if role == 'BRANCH_ADMIN' and view.__class__.__name__ == 'BranchViewSet':
                return getattr(view, 'action', None) in {'list', 'retrieve', 'staffing', 'stats'}
            # Branch Admin cannot create/delete UserProfiles (only view)
            if role == 'BRANCH_ADMIN' and view.__class__.__name__ == 'UserProfileViewSet':
                return getattr(view, 'action', None) in {'list', 'retrieve', 'me'}
            # Branch Admin can manage everything else in scope
            return True

        resource = view.__class__.__name__.replace('ViewSet', '')
        action = getattr(view, 'action', None)

        # Handle custom actions (e.g., list, retrieve, today, stats)
        if action:
            return f'{resource}:{action}' in allowed_actions

        # Handle default method-based permissions
        if request.method == 'GET':
            return f'{resource}:list' in allowed_actions or f'{resource}:retrieve' in allowed_actions
        elif request.method == 'POST':
            return f'{resource}:create' in allowed_actions
        elif request.method in ('PUT', 'PATCH'):
            return f'{resource}:update' in allowed_actions
        elif request.method == 'DELETE':
            return f'{resource}:destroy' in allowed_actions

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