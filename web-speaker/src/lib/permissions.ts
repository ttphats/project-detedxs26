/**
 * Permission Guard System
 * Role-based access control for TEDx Ticketing Platform
 */

import { JWTPayload } from './auth';
import { ForbiddenError } from './utils';

// Role hierarchy (higher index = more permissions)
export const ROLES = {
  USER: 'USER',
  STAFF: 'STAFF',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type RoleName = keyof typeof ROLES;

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<RoleName, number> = {
  USER: 0,
  STAFF: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

// Permission definitions
export const PERMISSIONS = {
  // Event permissions
  EVENT_VIEW: 'event:view',
  EVENT_CREATE: 'event:create',
  EVENT_UPDATE: 'event:update',
  EVENT_DELETE: 'event:delete',
  EVENT_PUBLISH: 'event:publish',

  // Seat/Layout permissions
  SEAT_VIEW: 'seat:view',
  SEAT_CREATE: 'seat:create',
  SEAT_UPDATE: 'seat:update',
  SEAT_DELETE: 'seat:delete',
  SEAT_LAYOUT_PUBLISH: 'seat_layout:publish',

  // Payment permissions
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_CONFIRM: 'payment:confirm',
  PAYMENT_REJECT: 'payment:reject',
  PAYMENT_REFUND: 'payment:refund',

  // Order permissions
  ORDER_VIEW: 'order:view',
  ORDER_VIEW_ALL: 'order:view_all',
  ORDER_CANCEL: 'order:cancel',

  // Email permissions
  EMAIL_VIEW: 'email:view',
  EMAIL_RESEND: 'email:resend',
  EMAIL_TEMPLATE_MANAGE: 'email:template_manage',

  // User permissions
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_MANAGE_ROLES: 'user:manage_roles',

  // Audit log permissions
  AUDIT_VIEW_OWN: 'audit:view_own',
  AUDIT_VIEW_ALL: 'audit:view_all',

  // Check-in permissions
  CHECKIN_PERFORM: 'checkin:perform',
  CHECKIN_VIEW: 'checkin:view',

  // Settings permissions
  SETTING_VIEW: 'setting:view',
  SETTING_UPDATE: 'setting:update',

  // Speaker permissions
  SPEAKER_VIEW: 'speaker:view',
  SPEAKER_CREATE: 'speaker:create',
  SPEAKER_UPDATE: 'speaker:update',
  SPEAKER_DELETE: 'speaker:delete',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role-Permission mapping
const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  USER: [
    PERMISSIONS.EVENT_VIEW,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.AUDIT_VIEW_OWN,
  ],
  STAFF: [
    PERMISSIONS.EVENT_VIEW,
    PERMISSIONS.SEAT_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_VIEW_ALL,
    PERMISSIONS.CHECKIN_PERFORM,
    PERMISSIONS.CHECKIN_VIEW,
    PERMISSIONS.AUDIT_VIEW_OWN,
    PERMISSIONS.SPEAKER_VIEW,
  ],
  ADMIN: [
    // All STAFF permissions plus:
    ...Object.values(PERMISSIONS).filter(p => 
      !p.startsWith('user:') && 
      p !== PERMISSIONS.SETTING_UPDATE &&
      p !== PERMISSIONS.USER_MANAGE_ROLES
    ),
  ],
  SUPER_ADMIN: Object.values(PERMISSIONS), // All permissions
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(roleName: string, permission: Permission): boolean {
  const role = roleName as RoleName;
  if (!ROLE_PERMISSIONS[role]) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Check if user has required permission, throw ForbiddenError if not
 */
export function requirePermission(user: JWTPayload, permission: Permission): void {
  if (!hasPermission(user.roleName, permission)) {
    throw new ForbiddenError(`Permission denied: ${permission}`);
  }
}

/**
 * Check if user has any of the required permissions
 */
export function hasAnyPermission(roleName: string, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(roleName, p));
}

/**
 * Check if user has all of the required permissions
 */
export function hasAllPermissions(roleName: string, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(roleName, p));
}

/**
 * Check if role A has higher or equal privilege than role B
 */
export function hasHigherOrEqualRole(roleA: string, roleB: string): boolean {
  const levelA = ROLE_HIERARCHY[roleA as RoleName] ?? -1;
  const levelB = ROLE_HIERARCHY[roleB as RoleName] ?? -1;
  return levelA >= levelB;
}

/**
 * Require minimum role level
 */
export function requireMinRole(user: JWTPayload, minRole: RoleName): void {
  if (!hasHigherOrEqualRole(user.roleName, minRole)) {
    throw new ForbiddenError(`Minimum role required: ${minRole}`);
  }
}

/**
 * Check if user can view audit logs
 */
export function canViewAuditLogs(user: JWTPayload, targetUserId?: string): boolean {
  // SUPER_ADMIN and ADMIN can view all
  if (hasPermission(user.roleName, PERMISSIONS.AUDIT_VIEW_ALL)) {
    return true;
  }
  // STAFF can only view their own or check-in related
  if (user.roleName === 'STAFF') {
    return targetUserId === user.userId;
  }
  // USER can only view their own
  return targetUserId === user.userId;
}

