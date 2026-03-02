# Permissions

> Role-based access control, resource-level authorization, and audit logging powered by the `PermissionEngine` in `lib/platform/permissions.ts`.

---

## Table of Contents

- [Overview](#overview)
- [Role Hierarchy](#role-hierarchy)
- [Permission Strings](#permission-strings)
- [Permission Resolution](#permission-resolution)
- [Role Limits](#role-limits)
- [Resource Permissions](#resource-permissions)
- [Component Permission Guards](#component-permission-guards)
- [Route Guards](#route-guards)
- [API Permission Validation](#api-permission-validation)
- [Audit Logging](#audit-logging)
- [Permission Helper API](#permission-helper-api)

---

## Overview

Apex Terminal implements a hierarchical RBAC system with 7 roles, 50+ granular permission strings, resource-level access control, and a full audit trail. The `PermissionEngine` resolves permissions through role inheritance, caches resolved permission sets per user, and provides guard functions for use in components, routes, and API calls.

Permissions cover five domains: **viewing** (`view:*`), **trading** (`trade:*`), **resource management** (`order:*`, `portfolio:*`, `alert:*`, etc.), **social** (`social:*`), and **administration** (`admin:*`, `system:*`, `api:*`).

---

## Role Hierarchy

Roles inherit upward — each role includes all permissions from the roles it extends:

```
viewer → basic → trader → premium → professional → admin → super_admin
```

| Role | Description | Inherits From |
|------|-------------|---------------|
| `viewer` | Read-only public data access | — |
| `basic` | Basic spot trading, limited alerts and watchlists | `viewer` |
| `trader` | Full trading, margin/crypto/forex, screeners, custom indicators | `basic` |
| `premium` | Options, futures, sharing, social features, higher limits | `trader` |
| `professional` | Dark pool access, API keys, scheduled reports, system export/import | `premium` |
| `admin` | User management, system settings, feature flags | `professional` |
| `super_admin` | Role management, billing, audit access | `admin` |

---

## Permission Strings

Permissions follow a `domain:action` or `domain:resource:action` pattern:

### Viewing

`view:dashboard`, `view:chart`, `view:portfolio`, `view:watchlist`, `view:screener`, `view:orders`, `view:reports`, `view:news`, `view:settings`, `view:admin`, `view:analytics`

### Trading

`trade:spot`, `trade:margin`, `trade:options`, `trade:futures`, `trade:crypto`, `trade:forex`, `trade:darkpool`

### Order Management

`order:create`, `order:modify`, `order:cancel`, `order:cancel_all`

### Portfolio

`portfolio:view`, `portfolio:manage`, `portfolio:export`, `portfolio:create`, `portfolio:delete`

### Reports

`report:view`, `report:create`, `report:export`, `report:schedule`

### User Content

`alert:create/modify/delete`, `watchlist:create/modify/delete/share`, `drawing:create/modify/delete/share`, `indicator:custom/import`, `layout:save/share/manage`, `screener:create/save/export`

### Social

`social:post`, `social:comment`, `social:follow`

### API & System

`api:read`, `api:write`, `api:admin`, `admin:users/roles/settings/billing/flags/audit`, `system:export/import/backup`

---

## Permission Resolution

The engine resolves permissions recursively through the inheritance chain with cycle detection:

```typescript
function resolveRolePermissions(role: Role, visited = new Set<Role>()): Set<Permission> {
  if (visited.has(role)) return new Set();
  visited.add(role);

  const def = ROLE_DEFINITIONS[role];
  const permissions = new Set<Permission>(def.permissions);

  if (def.inherits) {
    for (const parentRole of def.inherits) {
      resolveRolePermissions(parentRole, visited).forEach(p => permissions.add(p));
    }
  }

  return permissions;
}
```

Resolved permissions are cached per user ID. The cache invalidates when roles are assigned or removed.

---

## Role Limits

Each role defines resource limits that scale with tier:

| Limit | viewer | basic | trader | premium | professional | admin |
|-------|--------|-------|--------|---------|-------------|-------|
| Max Positions | 0 | 10 | 50 | 200 | 1,000 | — |
| Max Watchlists | 1 | 3 | 10 | 50 | 200 | — |
| Max Alerts | 0 | 5 | 25 | 100 | 500 | — |
| Max Layouts | 1 | 3 | 10 | 50 | 200 | — |
| API Rate Limit | 100 | 500 | 2,000 | 5,000 | 20,000 | 50,000 |

When a user holds multiple roles, the engine returns the highest limit across all roles:

```typescript
const maxAlerts = engine.getLimit('maxAlerts'); // highest across user's roles
```

---

## Resource Permissions

Beyond role-based permissions, individual resources support fine-grained access grants:

```typescript
engine.grantResourcePermission(
  'portfolio',        // resource type
  'portfolio_abc',    // resource ID
  'user_42',          // target user
  ['read', 'write'],  // permissions: read | write | delete | share | admin
  Date.now() + 86400_000  // optional expiry
);

engine.hasResourcePermission('portfolio', 'portfolio_abc', 'write', 'user_42'); // true
```

Admin and super_admin roles bypass resource permission checks entirely. Expired grants are detected at check time and treated as denied.

Supported resource types: `portfolio`, `watchlist`, `order`, `alert`, `drawing`, `indicator`, `layout`, `report`, `screener`, `strategy`.

---

## Component Permission Guards

The `createPermissionGuard()` factory produces a convenience API for use in React components:

```typescript
const guard = createPermissionGuard(engine);

function TradingPanel() {
  if (!guard.canTrade('options')) {
    return <UpgradePrompt feature="Options Trading" requiredRole="premium" />;
  }

  return <OptionsChain />;
}

function Sidebar() {
  return (
    <nav>
      <Link to="/chart">{t('view:chart')}</Link>
      {guard.can('view:screener') && <Link to="/screener">Screener</Link>}
      {guard.canAccessAdmin() && <Link to="/admin">Admin</Link>}
      {guard.canExport() && <ExportButton />}
    </nav>
  );
}
```

The guard also exposes limit checks:

```typescript
const maxAlerts = guard.getLimit('maxAlerts');
if (currentAlertCount >= maxAlerts) {
  showUpgradeModal('Alert limit reached');
}
```

---

## Route Guards

Routes are protected using the `requirePermission()` method which throws a `PermissionError` if the check fails:

```typescript
// In route loader or middleware
function protectedLoader(permission: Permission) {
  return () => {
    engine.requirePermission(permission);
    return fetchData();
  };
}

// Route definition
{ path: '/admin', loader: protectedLoader('view:admin'), element: <AdminDashboard /> }
{ path: '/reports', loader: protectedLoader('report:view'), element: <Reports /> }
```

The `PermissionError` carries `missingPermissions` for the error boundary to render an appropriate upgrade prompt.

---

## API Permission Validation

Outbound API requests are validated against `api:read` / `api:write` permissions:

```typescript
const check = engine.validateApiPermission('POST', '/api/v1/orders');
// Checks 'api:read' + 'api:write' for write methods (POST, PUT, PATCH, DELETE)
// Checks 'api:read' only for read methods (GET, HEAD, OPTIONS)

if (!check.allowed) {
  throw new PermissionError(check.reason, check.missingPermissions!);
}
```

---

## Audit Logging

Every permission check is recorded with the result. The audit log is capped at 1,000 entries in memory:

```typescript
const denied = engine.getAuditLog({
  userId: 'user_42',
  result: 'denied',
  limit: 50,
});

// Subscribe to real-time audit events
const unsub = engine.onAudit((entry) => {
  if (entry.result === 'denied') {
    reportSecurityEvent(entry);
  }
});
```

Each entry records: `action`, `resource`, `resourceId`, `userId`, `result` (allowed/denied), `permissions`, `timestamp`, and optional `metadata`.

---

## Permission Helper API

| Method | Description |
|--------|-------------|
| `hasPermission(p)` | Check single permission for current user |
| `hasAnyPermission([p1, p2])` | True if user has at least one |
| `hasAllPermissions([p1, p2])` | True if user has all |
| `checkPermission(p)` | Returns `PermissionCheck` with reason and missing list |
| `guard(p)` / `guardAll` / `guardAny` | Aliases for component use |
| `requirePermission(p)` | Throws `PermissionError` if denied |
| `getLimit(name)` | Get highest limit across user's roles |
| `grantResourcePermission(...)` | Grant resource-level access to another user |
| `hasResourcePermission(...)` | Check resource-level access |
| `validateApiPermission(method, path)` | Validate API call permissions |
