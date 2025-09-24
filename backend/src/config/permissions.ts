/**
 * Permission Configuration for RepairCoin Admin System
 * 
 * Three-tier role structure:
 * - Super Admin: Full control, can create and remove admins
 * - Admin: Full control, but cannot create new admins
 * - Moderator: Read-only access
 */

export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

export enum Permission {
  // Admin Management
  CREATE_ADMIN = 'create_admin',
  DELETE_ADMIN = 'delete_admin',
  UPDATE_ADMIN = 'update_admin',
  VIEW_ADMINS = 'view_admins',
  
  // Customer Management
  VIEW_CUSTOMERS = 'view_customers',
  UPDATE_CUSTOMER = 'update_customer',
  SUSPEND_CUSTOMER = 'suspend_customer',
  MINT_TOKENS = 'mint_tokens',
  
  // Shop Management
  VIEW_SHOPS = 'view_shops',
  CREATE_SHOP = 'create_shop',
  UPDATE_SHOP = 'update_shop',
  APPROVE_SHOP = 'approve_shop',
  SUSPEND_SHOP = 'suspend_shop',
  SELL_RCN = 'sell_rcn',
  
  // Treasury Management
  VIEW_TREASURY = 'view_treasury',
  MANAGE_TREASURY = 'manage_treasury',
  
  // Analytics
  VIEW_ANALYTICS = 'view_analytics',
  
  // System Management
  PAUSE_CONTRACT = 'pause_contract',
  SYSTEM_MAINTENANCE = 'system_maintenance',
  
  // Activity Logs
  VIEW_LOGS = 'view_logs',
  
  // Webhook Management
  VIEW_WEBHOOKS = 'view_webhooks',
  MANAGE_WEBHOOKS = 'manage_webhooks'
}

// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  [AdminRole.SUPER_ADMIN]: [
    // Has ALL permissions
    Permission.CREATE_ADMIN,
    Permission.DELETE_ADMIN,
    Permission.UPDATE_ADMIN,
    Permission.VIEW_ADMINS,
    Permission.VIEW_CUSTOMERS,
    Permission.UPDATE_CUSTOMER,
    Permission.SUSPEND_CUSTOMER,
    Permission.MINT_TOKENS,
    Permission.VIEW_SHOPS,
    Permission.CREATE_SHOP,
    Permission.UPDATE_SHOP,
    Permission.APPROVE_SHOP,
    Permission.SUSPEND_SHOP,
    Permission.SELL_RCN,
    Permission.VIEW_TREASURY,
    Permission.MANAGE_TREASURY,
    Permission.VIEW_ANALYTICS,
    Permission.PAUSE_CONTRACT,
    Permission.SYSTEM_MAINTENANCE,
    Permission.VIEW_LOGS,
    Permission.VIEW_WEBHOOKS,
    Permission.MANAGE_WEBHOOKS
  ],
  
  [AdminRole.ADMIN]: [
    // Full control except admin creation/deletion
    Permission.UPDATE_ADMIN, // Can update but not create/delete
    Permission.VIEW_ADMINS,
    Permission.VIEW_CUSTOMERS,
    Permission.UPDATE_CUSTOMER,
    Permission.SUSPEND_CUSTOMER,
    Permission.MINT_TOKENS,
    Permission.VIEW_SHOPS,
    Permission.CREATE_SHOP,
    Permission.UPDATE_SHOP,
    Permission.APPROVE_SHOP,
    Permission.SUSPEND_SHOP,
    Permission.SELL_RCN,
    Permission.VIEW_TREASURY,
    Permission.MANAGE_TREASURY,
    Permission.VIEW_ANALYTICS,
    Permission.PAUSE_CONTRACT,
    Permission.SYSTEM_MAINTENANCE,
    Permission.VIEW_LOGS,
    Permission.VIEW_WEBHOOKS,
    Permission.MANAGE_WEBHOOKS
  ],
  
  [AdminRole.MODERATOR]: [
    // Read-only access
    Permission.VIEW_ADMINS,
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_SHOPS,
    Permission.VIEW_TREASURY,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_LOGS,
    Permission.VIEW_WEBHOOKS
  ]
};

// Helper function to check if a role has a specific permission
export function hasPermission(role: AdminRole | string, permission: Permission): boolean {
  // Super admin always has all permissions
  if (role === AdminRole.SUPER_ADMIN || role === 'super_admin') {
    return true;
  }
  
  const roleKey = role as AdminRole;
  const permissions = ROLE_PERMISSIONS[roleKey];
  
  if (!permissions) {
    return false;
  }
  
  return permissions.includes(permission);
}

// Helper function to get role from permissions array (for backward compatibility)
export function getRoleFromPermissions(permissions: string[], isSuperAdmin?: boolean): AdminRole {
  // If explicitly marked as super admin
  if (isSuperAdmin) {
    return AdminRole.SUPER_ADMIN;
  }
  
  // Check if permissions include 'all' (legacy super admin)
  if (permissions.includes('all')) {
    return AdminRole.SUPER_ADMIN;
  }
  
  // Check if permissions include admin management
  if (permissions.includes('create_admin') || permissions.includes('delete_admin')) {
    return AdminRole.SUPER_ADMIN;
  }
  
  // Check if permissions include write operations
  const writePermissions = [
    'update_customer', 'suspend_customer', 'mint_tokens',
    'create_shop', 'update_shop', 'approve_shop', 'suspend_shop',
    'sell_rcn', 'manage_treasury', 'pause_contract'
  ];
  
  if (permissions.some(p => writePermissions.includes(p))) {
    return AdminRole.ADMIN;
  }
  
  // Default to moderator for read-only permissions
  return AdminRole.MODERATOR;
}

// Convert role to permissions array (for database storage)
export function roleToPermissions(role: AdminRole): string[] {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.map(p => p.toString()) : [];
}

// Middleware helper to check permissions
export function requirePermission(permission: Permission) {
  return (req: any, res: any, next: any) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get role from user data
    const role = user.role || getRoleFromPermissions(user.permissions || [], user.isSuperAdmin);
    
    if (!hasPermission(role, permission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: permission,
        userRole: role
      });
    }
    
    next();
  };
}