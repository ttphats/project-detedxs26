/**
 * Audit Logger Service
 * Centralized logging for all important system actions
 */

import { prisma } from './prisma';
import { JWTPayload } from './auth';

// Action types
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'CONFIRM'
  | 'REJECT'
  | 'PUBLISH'
  | 'UNPUBLISH'
  | 'LOGIN'
  | 'LOGOUT'
  | 'REGISTER'
  | 'RESEND_EMAIL'
  | 'CHECK_IN'
  | 'CANCEL'
  | 'REFUND'
  | 'LOCK_SEAT'
  | 'RELEASE_SEAT'
  | 'CHANGE_STATUS'
  | 'CHANGE_SETTING'
  | 'REORDER';

// Entity types
export type AuditEntity =
  | 'EVENT'
  | 'PAYMENT'
  | 'ORDER'
  | 'TICKET'
  | 'SEAT'
  | 'SEAT_LAYOUT'
  | 'EMAIL'
  | 'USER'
  | 'SETTING'
  | 'SPEAKER'
  | 'TIMELINE';

export interface AuditLogInput {
  user: JWTPayload | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  device?: DeviceInfo;
}

/**
 * Create an audit log entry
 * This should only be called from server-side code (API routes, server actions)
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    // Merge device info into metadata
    const metadata = {
      ...input.metadata,
      ...(input.device && { device: input.device }),
    };

    await prisma.auditLog.create({
      data: {
        userId: input.user?.userId || null,
        userRole: input.user?.roleName || null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId || null,
        oldValue: input.oldValue ? JSON.stringify(input.oldValue) : null,
        newValue: input.newValue ? JSON.stringify(input.newValue) : null,
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
      },
    });
  } catch (error) {
    // Log error but don't throw - audit logging should not break main flow
    console.error('[AuditLogger] Failed to create audit log:', error);
  }
}

/**
 * Parse device info from user agent string
 */
export interface DeviceInfo {
  os: string;
  browser: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown';
}

function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows nt 10')) os = 'Windows 10/11';
  else if (ua.includes('windows nt 6.3')) os = 'Windows 8.1';
  else if (ua.includes('windows nt 6.2')) os = 'Windows 8';
  else if (ua.includes('windows nt 6.1')) os = 'Windows 7';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os x')) {
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/i);
    os = match ? `macOS ${match[1].replace('_', '.')}` : 'macOS';
  }
  else if (ua.includes('android')) {
    const match = userAgent.match(/android (\d+\.?\d*)/i);
    os = match ? `Android ${match[1]}` : 'Android';
  }
  else if (ua.includes('iphone os') || ua.includes('ipad')) {
    const match = userAgent.match(/OS (\d+[._]\d+)/i);
    os = match ? `iOS ${match[1].replace('_', '.')}` : 'iOS';
  }
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('ubuntu')) os = 'Ubuntu';

  // Detect Browser
  let browser = 'Unknown';
  if (ua.includes('edg/')) {
    const match = userAgent.match(/Edg\/(\d+)/i);
    browser = match ? `Edge ${match[1]}` : 'Edge';
  }
  else if (ua.includes('chrome') && !ua.includes('chromium')) {
    const match = userAgent.match(/Chrome\/(\d+)/i);
    browser = match ? `Chrome ${match[1]}` : 'Chrome';
  }
  else if (ua.includes('firefox')) {
    const match = userAgent.match(/Firefox\/(\d+)/i);
    browser = match ? `Firefox ${match[1]}` : 'Firefox';
  }
  else if (ua.includes('safari') && !ua.includes('chrome')) {
    const match = userAgent.match(/Version\/(\d+)/i);
    browser = match ? `Safari ${match[1]}` : 'Safari';
  }
  else if (ua.includes('opera') || ua.includes('opr/')) {
    browser = 'Opera';
  }

  // Detect Device Type
  let deviceType: DeviceInfo['deviceType'] = 'Desktop';
  if (ua.includes('mobile') || ua.includes('iphone') || (ua.includes('android') && !ua.includes('tablet'))) {
    deviceType = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'Tablet';
  }

  return { os, browser, deviceType };
}

/**
 * Helper to extract request info for audit logging
 */
export function getRequestInfo(request: Request): {
  ipAddress: string;
  userAgent: string;
  device: DeviceInfo;
} {
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const device = parseUserAgent(userAgent);

  return {
    ipAddress: request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown',
    userAgent,
    device,
  };
}

/**
 * Log event actions
 */
export async function logEventAction(
  user: JWTPayload,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PUBLISH' | 'UNPUBLISH',
  eventId: string,
  oldValue?: Record<string, any>,
  newValue?: Record<string, any>,
  request?: Request
) {
  const reqInfo = request ? getRequestInfo(request) : {};
  await createAuditLog({
    user,
    action,
    entity: 'EVENT',
    entityId: eventId,
    oldValue,
    newValue,
    ...reqInfo,
  });
}

/**
 * Log payment actions
 */
export async function logPaymentAction(
  user: JWTPayload,
  action: 'CONFIRM' | 'REJECT' | 'REFUND',
  orderId: string,
  details: {
    orderNumber: string;
    amount?: number;
    reason?: string;
    transactionId?: string;
  },
  request?: Request
) {
  const reqInfo = request ? getRequestInfo(request) : {};
  await createAuditLog({
    user,
    action,
    entity: 'PAYMENT',
    entityId: orderId,
    newValue: details,
    metadata: { orderNumber: details.orderNumber },
    ...reqInfo,
  });
}

/**
 * Log seat layout actions
 */
export async function logSeatLayoutAction(
  user: JWTPayload,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PUBLISH',
  layoutId: string,
  details: { eventId: string; name: string; totalSeats?: number },
  request?: Request
) {
  const reqInfo = request ? getRequestInfo(request) : {};
  await createAuditLog({
    user,
    action,
    entity: 'SEAT_LAYOUT',
    entityId: layoutId,
    newValue: details,
    ...reqInfo,
  });
}

/**
 * Log email actions
 */
export async function logEmailAction(
  user: JWTPayload,
  action: 'RESEND_EMAIL',
  orderId: string,
  details: { orderNumber: string; customerEmail: string; success: boolean; error?: string },
  request?: Request
) {
  const reqInfo = request ? getRequestInfo(request) : {};
  await createAuditLog({
    user,
    action,
    entity: 'EMAIL',
    entityId: orderId,
    newValue: details,
    ...reqInfo,
  });
}

