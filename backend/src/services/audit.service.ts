import { prisma } from '../db/prisma.js';
import { JWTPayload } from '../types/index.js';

export interface AuditLogInput {
  userId: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  changes?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        userRole: input.userRole,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        oldValue: input.oldValue ? JSON.stringify(input.oldValue) : null,
        newValue: input.newValue ? JSON.stringify(input.newValue) : null,
        changes: input.changes ? JSON.stringify(input.changes) : null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break main flow
  }
}

/**
 * Log payment action
 */
export async function logPaymentAction(
  user: JWTPayload,
  action: 'CONFIRM' | 'REJECT',
  orderId: string,
  data: {
    orderNumber: string;
    oldStatus: string;
    newStatus: string;
    amount?: number;
    reason?: string;
  },
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await createAuditLog({
    userId: user.userId,
    userRole: user.roleName,
    action,
    entity: 'PAYMENT',
    entityId: orderId,
    oldValue: { status: data.oldStatus },
    newValue: { status: data.newStatus, reason: data.reason },
    metadata: {
      orderNumber: data.orderNumber,
      amount: data.amount,
    },
    ipAddress,
    userAgent,
  });
}

/**
 * Log email action
 */
export async function logEmailAction(
  user: JWTPayload,
  action: 'SEND' | 'RESEND_EMAIL',
  orderId: string,
  data: {
    orderNumber: string;
    customerEmail: string;
    success: boolean;
    error?: string;
  },
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await createAuditLog({
    userId: user.userId,
    userRole: user.roleName,
    action,
    entity: 'EMAIL',
    entityId: orderId,
    metadata: {
      orderNumber: data.orderNumber,
      customerEmail: data.customerEmail,
      success: data.success,
      error: data.error,
    },
    ipAddress,
    userAgent,
  });
}

