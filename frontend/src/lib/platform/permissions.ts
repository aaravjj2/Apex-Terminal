// Platform Permissions - RBAC, Resource Guards & Audit

export type Permission =
  | 'view:dashboard' | 'view:chart' | 'view:portfolio' | 'view:watchlist'
  | 'view:screener' | 'view:orders' | 'view:reports' | 'view:news'
  | 'view:settings' | 'view:admin' | 'view:analytics'
  | 'trade:spot' | 'trade:margin' | 'trade:options' | 'trade:futures'
  | 'trade:crypto' | 'trade:forex' | 'trade:darkpool'
  | 'order:create' | 'order:modify' | 'order:cancel' | 'order:cancel_all'
  | 'portfolio:view' | 'portfolio:manage' | 'portfolio:export'
  | 'portfolio:create' | 'portfolio:delete'
  | 'report:view' | 'report:create' | 'report:export' | 'report:schedule'
  | 'alert:create' | 'alert:modify' | 'alert:delete'
  | 'watchlist:create' | 'watchlist:modify' | 'watchlist:delete' | 'watchlist:share'
  | 'drawing:create' | 'drawing:modify' | 'drawing:delete' | 'drawing:share'
  | 'indicator:custom' | 'indicator:import'
  | 'layout:save' | 'layout:share' | 'layout:manage'
  | 'screener:create' | 'screener:save' | 'screener:export'
  | 'social:post' | 'social:comment' | 'social:follow'
  | 'api:read' | 'api:write' | 'api:admin'
  | 'admin:users' | 'admin:roles' | 'admin:settings' | 'admin:billing'
  | 'admin:flags' | 'admin:audit'
  | 'system:export' | 'system:import' | 'system:backup';

export type Role = 'viewer' | 'basic' | 'trader' | 'premium' | 'professional' | 'admin' | 'super_admin';

export type ResourceType =
  | 'portfolio' | 'watchlist' | 'order' | 'alert' | 'drawing'
  | 'indicator' | 'layout' | 'report' | 'screener' | 'strategy';

export interface RoleDefinition {
  id: Role;
  name: string;
  description: string;
  permissions: Permission[];
  inherits?: Role[];
  maxPositions?: number;
  maxWatchlists?: number;
  maxAlerts?: number;
  maxLayouts?: number;
  apiRateLimit?: number;
}

export interface ResourcePermission {
  resourceType: ResourceType;
  resourceId: string;
  userId: string;
  permissions: ('read' | 'write' | 'delete' | 'share' | 'admin')[];
  grantedBy?: string;
  grantedAt: number;
  expiresAt?: number;
}

export interface PermissionCheck {
  allowed: boolean;
  reason: string;
  missingPermissions?: Permission[];
}

export interface AuditEntry {
  action: string;
  resource: string;
  resourceId?: string;
  userId: string;
  result: 'allowed' | 'denied';
  permissions: Permission[];
  timestamp: number;
  ip?: string;
  metadata?: Record<string, unknown>;
}

// --- Role Definitions ---

const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  viewer: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to public data',
    permissions: [
      'view:dashboard', 'view:chart', 'view:news',
    ],
    maxPositions: 0,
    maxWatchlists: 1,
    maxAlerts: 0,
    maxLayouts: 1,
    apiRateLimit: 100,
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    description: 'Basic trading access',
    permissions: [
      'view:portfolio', 'view:watchlist', 'view:orders',
      'trade:spot', 'order:create', 'order:cancel',
      'portfolio:view', 'alert:create',
      'watchlist:create', 'watchlist:modify',
      'drawing:create', 'drawing:modify', 'drawing:delete',
      'layout:save',
    ],
    inherits: ['viewer'],
    maxPositions: 10,
    maxWatchlists: 3,
    maxAlerts: 5,
    maxLayouts: 3,
    apiRateLimit: 500,
  },
  trader: {
    id: 'trader',
    name: 'Trader',
    description: 'Full trading capabilities',
    permissions: [
      'view:screener', 'view:reports',
      'trade:margin', 'trade:crypto', 'trade:forex',
      'order:modify', 'order:cancel_all',
      'portfolio:manage', 'portfolio:export',
      'report:view', 'alert:modify', 'alert:delete',
      'watchlist:delete',
      'screener:create', 'screener:save',
      'indicator:custom',
    ],
    inherits: ['basic'],
    maxPositions: 50,
    maxWatchlists: 10,
    maxAlerts: 25,
    maxLayouts: 10,
    apiRateLimit: 2000,
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Premium features and higher limits',
    permissions: [
      'trade:options', 'trade:futures',
      'portfolio:create', 'portfolio:delete',
      'report:create', 'report:export',
      'watchlist:share', 'drawing:share',
      'layout:share',
      'screener:export',
      'indicator:import',
      'social:post', 'social:comment', 'social:follow',
    ],
    inherits: ['trader'],
    maxPositions: 200,
    maxWatchlists: 50,
    maxAlerts: 100,
    maxLayouts: 50,
    apiRateLimit: 5000,
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Professional-grade tools and API access',
    permissions: [
      'view:analytics',
      'trade:darkpool',
      'report:schedule',
      'layout:manage',
      'api:read', 'api:write',
      'system:export', 'system:import',
    ],
    inherits: ['premium'],
    maxPositions: 1000,
    maxWatchlists: 200,
    maxAlerts: 500,
    maxLayouts: 200,
    apiRateLimit: 20000,
  },
  admin: {
    id: 'admin',
    name: 'Administrator',
    description: 'System administration',
    permissions: [
      'view:admin', 'view:settings',
      'admin:users', 'admin:settings', 'admin:flags',
      'api:admin', 'system:backup',
    ],
    inherits: ['professional'],
    apiRateLimit: 50000,
  },
  super_admin: {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Full system access',
    permissions: [
      'admin:roles', 'admin:billing', 'admin:audit',
    ],
    inherits: ['admin'],
    apiRateLimit: 100000,
  },
};

// --- Permission Resolution ---

function resolveRolePermissions(role: Role, visited = new Set<Role>()): Set<Permission> {
  if (visited.has(role)) return new Set();
  visited.add(role);

  const def = ROLE_DEFINITIONS[role];
  if (!def) return new Set();

  const permissions = new Set<Permission>(def.permissions);

  if (def.inherits) {
    for (const parentRole of def.inherits) {
      const parentPerms = resolveRolePermissions(parentRole, visited);
      parentPerms.forEach(p => permissions.add(p));
    }
  }

  return permissions;
}

// --- Permissions Engine ---

export class PermissionEngine {
  private userRoles = new Map<string, Role[]>();
  private resourcePermissions: ResourcePermission[] = [];
  private auditLog: AuditEntry[] = [];
  private maxAuditEntries = 1000;
  private currentUserId: string | null = null;
  private permissionCache = new Map<string, Set<Permission>>();
  private listeners = new Set<(entry: AuditEntry) => void>();

  constructor() {
    this.loadState();
  }

  // --- User Management ---

  setCurrentUser(userId: string, roles: Role[]): void {
    this.currentUserId = userId;
    this.userRoles.set(userId, roles);
    this.permissionCache.delete(userId);
    this.persistState();
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  assignRole(userId: string, role: Role): void {
    const roles = this.userRoles.get(userId) || [];
    if (!roles.includes(role)) {
      roles.push(role);
      this.userRoles.set(userId, roles);
      this.permissionCache.delete(userId);
      this.persistState();
    }
  }

  removeRole(userId: string, role: Role): void {
    const roles = this.userRoles.get(userId) || [];
    this.userRoles.set(userId, roles.filter(r => r !== role));
    this.permissionCache.delete(userId);
    this.persistState();
  }

  getUserRoles(userId?: string): Role[] {
    return this.userRoles.get(userId || this.currentUserId || '') || [];
  }

  getRoleDefinition(role: Role): RoleDefinition {
    return ROLE_DEFINITIONS[role];
  }

  getAllRoles(): RoleDefinition[] {
    return Object.values(ROLE_DEFINITIONS);
  }

  // --- Permission Checking ---

  getUserPermissions(userId?: string): Set<Permission> {
    const uid = userId || this.currentUserId || '';
    if (this.permissionCache.has(uid)) return this.permissionCache.get(uid)!;

    const roles = this.userRoles.get(uid) || [];
    const allPermissions = new Set<Permission>();

    for (const role of roles) {
      const rolePerms = resolveRolePermissions(role);
      rolePerms.forEach(p => allPermissions.add(p));
    }

    this.permissionCache.set(uid, allPermissions);
    return allPermissions;
  }

  hasPermission(permission: Permission, userId?: string): boolean {
    const uid = userId || this.currentUserId;
    if (!uid) return false;
    const perms = this.getUserPermissions(uid);
    const allowed = perms.has(permission);

    this.addAuditEntry({
      action: 'check_permission',
      resource: permission,
      userId: uid,
      result: allowed ? 'allowed' : 'denied',
      permissions: [permission],
      timestamp: Date.now(),
    });

    return allowed;
  }

  hasAnyPermission(permissions: Permission[], userId?: string): boolean {
    const uid = userId || this.currentUserId;
    if (!uid) return false;
    const perms = this.getUserPermissions(uid);
    return permissions.some(p => perms.has(p));
  }

  hasAllPermissions(permissions: Permission[], userId?: string): boolean {
    const uid = userId || this.currentUserId;
    if (!uid) return false;
    const perms = this.getUserPermissions(uid);
    return permissions.every(p => perms.has(p));
  }

  checkPermission(permission: Permission, userId?: string): PermissionCheck {
    const uid = userId || this.currentUserId;
    if (!uid) {
      return { allowed: false, reason: 'No authenticated user', missingPermissions: [permission] };
    }

    const perms = this.getUserPermissions(uid);
    if (perms.has(permission)) {
      return { allowed: true, reason: 'Permission granted via role' };
    }

    const roles = this.getUserRoles(uid);
    return {
      allowed: false,
      reason: `User roles (${roles.join(', ')}) do not include permission: ${permission}`,
      missingPermissions: [permission],
    };
  }

  checkMultiplePermissions(permissions: Permission[], userId?: string): PermissionCheck {
    const uid = userId || this.currentUserId;
    if (!uid) {
      return { allowed: false, reason: 'No authenticated user', missingPermissions: permissions };
    }

    const perms = this.getUserPermissions(uid);
    const missing = permissions.filter(p => !perms.has(p));

    if (missing.length === 0) {
      return { allowed: true, reason: 'All permissions granted' };
    }

    return {
      allowed: false,
      reason: `Missing permissions: ${missing.join(', ')}`,
      missingPermissions: missing,
    };
  }

  // --- Resource Permissions ---

  grantResourcePermission(
    resourceType: ResourceType,
    resourceId: string,
    targetUserId: string,
    permissions: ResourcePermission['permissions'],
    expiresAt?: number
  ): void {
    const existing = this.resourcePermissions.findIndex(
      rp => rp.resourceType === resourceType && rp.resourceId === resourceId && rp.userId === targetUserId
    );

    const rp: ResourcePermission = {
      resourceType,
      resourceId,
      userId: targetUserId,
      permissions,
      grantedBy: this.currentUserId || undefined,
      grantedAt: Date.now(),
      expiresAt,
    };

    if (existing >= 0) {
      this.resourcePermissions[existing] = rp;
    } else {
      this.resourcePermissions.push(rp);
    }

    this.persistState();
  }

  revokeResourcePermission(resourceType: ResourceType, resourceId: string, targetUserId: string): void {
    this.resourcePermissions = this.resourcePermissions.filter(
      rp => !(rp.resourceType === resourceType && rp.resourceId === resourceId && rp.userId === targetUserId)
    );
    this.persistState();
  }

  hasResourcePermission(
    resourceType: ResourceType,
    resourceId: string,
    permission: ResourcePermission['permissions'][number],
    userId?: string
  ): boolean {
    const uid = userId || this.currentUserId;
    if (!uid) return false;

    const roles = this.getUserRoles(uid);
    if (roles.includes('admin') || roles.includes('super_admin')) return true;

    const rp = this.resourcePermissions.find(
      r => r.resourceType === resourceType && r.resourceId === resourceId && r.userId === uid
    );

    if (!rp) return false;
    if (rp.expiresAt && Date.now() > rp.expiresAt) return false;

    return rp.permissions.includes(permission);
  }

  getResourcePermissions(resourceType: ResourceType, resourceId: string): ResourcePermission[] {
    return this.resourcePermissions.filter(
      rp => rp.resourceType === resourceType && rp.resourceId === resourceId
    );
  }

  // --- Role Limits ---

  getLimit(limitName: keyof Pick<RoleDefinition, 'maxPositions' | 'maxWatchlists' | 'maxAlerts' | 'maxLayouts' | 'apiRateLimit'>, userId?: string): number {
    const roles = this.getUserRoles(userId);
    let maxLimit = 0;

    for (const role of roles) {
      const def = ROLE_DEFINITIONS[role];
      const val = def[limitName];
      if (val !== undefined && val > maxLimit) maxLimit = val;
    }

    return maxLimit;
  }

  // --- Permission Guards ---

  guard(permission: Permission): boolean {
    return this.hasPermission(permission);
  }

  guardAll(permissions: Permission[]): boolean {
    return this.hasAllPermissions(permissions);
  }

  guardAny(permissions: Permission[]): boolean {
    return this.hasAnyPermission(permissions);
  }

  requirePermission(permission: Permission): void {
    if (!this.hasPermission(permission)) {
      const check = this.checkPermission(permission);
      throw new PermissionError(check.reason, check.missingPermissions || []);
    }
  }

  requireAllPermissions(permissions: Permission[]): void {
    const check = this.checkMultiplePermissions(permissions);
    if (!check.allowed) {
      throw new PermissionError(check.reason, check.missingPermissions || []);
    }
  }

  // --- Audit ---

  private addAuditEntry(entry: AuditEntry): void {
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
    }
    this.listeners.forEach(fn => fn(entry));
  }

  getAuditLog(options?: {
    userId?: string;
    resource?: string;
    result?: 'allowed' | 'denied';
    limit?: number;
  }): AuditEntry[] {
    let filtered = [...this.auditLog];

    if (options?.userId) filtered = filtered.filter(e => e.userId === options.userId);
    if (options?.resource) filtered = filtered.filter(e => e.resource === options.resource);
    if (options?.result) filtered = filtered.filter(e => e.result === options.result);
    if (options?.limit) filtered = filtered.slice(-options.limit);

    return filtered;
  }

  onAudit(callback: (entry: AuditEntry) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // --- API Validation ---

  validateApiPermission(method: string, _path: string): PermissionCheck {
    const readMethods = ['GET', 'HEAD', 'OPTIONS'];
    const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    if (readMethods.includes(method.toUpperCase())) {
      return this.checkPermission('api:read');
    }

    if (writeMethods.includes(method.toUpperCase())) {
      return this.checkMultiplePermissions(['api:read', 'api:write']);
    }

    return { allowed: false, reason: 'Unknown HTTP method', missingPermissions: [] };
  }

  // --- Persistence ---

  private persistState(): void {
    try {
      const state = {
        userRoles: Array.from(this.userRoles.entries()),
        resourcePermissions: this.resourcePermissions,
        currentUserId: this.currentUserId,
      };
      localStorage.setItem('permissions_state', JSON.stringify(state));
    } catch { /* noop */ }
  }

  private loadState(): void {
    try {
      const raw = localStorage.getItem('permissions_state');
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state.userRoles) {
        for (const [userId, roles] of state.userRoles) {
          this.userRoles.set(userId, roles as Role[]);
        }
      }
      if (state.resourcePermissions) {
        this.resourcePermissions = state.resourcePermissions;
      }
      if (state.currentUserId) {
        this.currentUserId = state.currentUserId;
      }
    } catch { /* noop */ }
  }

  clearState(): void {
    this.userRoles.clear();
    this.resourcePermissions = [];
    this.permissionCache.clear();
    this.auditLog = [];
    this.currentUserId = null;
    try { localStorage.removeItem('permissions_state'); } catch { /* noop */ }
  }

  destroy(): void {
    this.listeners.clear();
    this.permissionCache.clear();
  }
}

// --- Permission Error ---

export class PermissionError extends Error {
  public readonly missingPermissions: Permission[];

  constructor(message: string, missingPermissions: Permission[]) {
    super(message);
    this.name = 'PermissionError';
    this.missingPermissions = missingPermissions;
  }
}

// --- Helper: Component Permission Guard ---

export function createPermissionGuard(engine: PermissionEngine) {
  return {
    can(permission: Permission): boolean {
      return engine.guard(permission);
    },

    canAll(permissions: Permission[]): boolean {
      return engine.guardAll(permissions);
    },

    canAny(permissions: Permission[]): boolean {
      return engine.guardAny(permissions);
    },

    canTrade(type: 'spot' | 'margin' | 'options' | 'futures' | 'crypto' | 'forex' | 'darkpool'): boolean {
      return engine.guard(`trade:${type}` as Permission);
    },

    canManagePortfolio(): boolean {
      return engine.guardAll(['portfolio:view', 'portfolio:manage']);
    },

    canAccessAdmin(): boolean {
      return engine.guard('view:admin');
    },

    canExport(): boolean {
      return engine.guardAny(['portfolio:export', 'report:export', 'screener:export', 'system:export']);
    },

    getLimit(name: 'maxPositions' | 'maxWatchlists' | 'maxAlerts' | 'maxLayouts' | 'apiRateLimit'): number {
      return engine.getLimit(name);
    },
  };
}
