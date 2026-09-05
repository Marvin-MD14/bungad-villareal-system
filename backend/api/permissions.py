from rest_framework.permissions import BasePermission


ROLE_ACTIONS = {
    'SUPERADMIN': {'*'},
    'OWNER': {
        'VSSService:list', 'VSSService:retrieve', 'VSSService:categories', 'VSSService:stats',
        'VRealProduct:list', 'VRealProduct:retrieve', 'VRealProduct:categories', 'VRealProduct:stats',
        'BBProduct:list', 'BBProduct:retrieve',
        'PangananMenu:list', 'PangananMenu:retrieve', 'PangananMenu:categories',
        'KBItem:list', 'KBItem:retrieve',
        'AutoSpaService:list', 'AutoSpaService:retrieve',
        'Branch:list', 'Branch:retrieve',
        'Product:list', 'Product:retrieve', 'Product:low_stock', 'Product:by_category',
        'BranchInventory:list', 'BranchInventory:retrieve', 'BranchInventory:by_branch',
        'ClientProfile:list', 'ClientProfile:retrieve', 'ClientProfile:search', 'ClientProfile:transactions',
        'RoomTable:list', 'RoomTable:retrieve', 'RoomTable:available', 'RoomTable:occupied',
        'Transaction:list', 'Transaction:retrieve', 'Transaction:today', 'Transaction:stats',
        'DashboardStats:summary',
        'UserProfile:list', 'UserProfile:retrieve',
    },
    'BRANCH_ADMIN': {'*'},
    'CASHIER': {
        'VSSService:list', 'VSSService:retrieve', 'VSSService:preview',
        'VSSService:categories', 'VSSService:stats',
        'VRealProduct:list', 'VRealProduct:retrieve', 'VRealProduct:preview',
        'VRealProduct:categories', 'VRealProduct:stats',
        'BBProduct:list', 'BBProduct:retrieve',
        'PangananMenu:list', 'PangananMenu:retrieve', 'PangananMenu:categories',
        'Product:list', 'Product:retrieve', 'Product:low_stock', 'Product:by_category',
        'BranchInventory:list', 'BranchInventory:retrieve', 'BranchInventory:by_branch',
        'Branch:list', 'Branch:retrieve',
        'ClientProfile:list', 'ClientProfile:retrieve', 'ClientProfile:create', 'ClientProfile:search',
        'ClientProfile:transactions',
        'RoomTable:list', 'RoomTable:retrieve', 'RoomTable:available',
        'RoomTable:occupied', 'RoomTable:check_in', 'RoomTable:check_out',
        'Transaction:list', 'Transaction:retrieve', 'Transaction:create',
        'Transaction:today', 'Transaction:stats',
        'Transaction:checkout',
        'DashboardStats:summary',
    },
    'STAFF': {
        'VSSService:list', 'VSSService:retrieve', 'VSSService:preview',
        'VSSService:categories', 'VSSService:stats',
        'VRealProduct:list', 'VRealProduct:retrieve', 'VRealProduct:preview',
        'VRealProduct:categories', 'VRealProduct:stats',
        'BBProduct:list', 'BBProduct:retrieve',
        'PangananMenu:list', 'PangananMenu:retrieve', 'PangananMenu:categories',
        'ClientProfile:list', 'ClientProfile:retrieve', 'ClientProfile:search',
        'RoomTable:list', 'RoomTable:retrieve', 'RoomTable:available',
        'RoomTable:occupied', 'RoomTable:check_in', 'RoomTable:check_out',
        'DashboardStats:summary',
    },
}


def get_user_role(user):
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
            if role == 'BRANCH_ADMIN' and view.__class__.__name__ == 'BranchViewSet':
                return getattr(view, 'action', None) in {'list', 'retrieve'}
            if role == 'BRANCH_ADMIN' and view.__class__.__name__ == 'UserProfileViewSet':
                return getattr(view, 'action', None) in {'list', 'retrieve'}
            return True

        resource = view.__class__.__name__.replace('ViewSet', '')
        action = getattr(view, 'action', None)
        return f'{resource}:{action}' in allowed_actions
