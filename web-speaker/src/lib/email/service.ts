// Email Service - Send email by purpose with active template
// IMPLEMENTS NO SPAM FLOW - Only sends when admin takes action
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { EmailPurpose, SendEmailParams, REQUIRED_VARIABLES, BUSINESS_EVENTS } from './types';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'TEDxFPTUniversityHCMC <onboarding@resend.dev>';

/**
 * Check if email was already sent for this purpose + order
 * Anti-spam: prevents duplicate emails
 */
export async function hasEmailBeenSent(orderId: string, purpose: EmailPurpose): Promise<boolean> {
  if (!orderId) return false;

  const existing = await prisma.emailLog.findFirst({
    where: {
      orderId,
      purpose,
      status: 'SENT',
    },
  });

  return !!existing;
}

/**
 * Render template with variables
 * Replaces {{variable}} with actual values
 */
function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key];
    if (value === undefined || value === null) {
      return match; // Keep placeholder if no value
    }
    if (typeof value === 'number') {
      return new Intl.NumberFormat('vi-VN').format(value);
    }
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Extract variables from template
 * Finds all {{variable}} patterns
 */
export function extractVariables(html: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match;
  while ((match = regex.exec(html)) !== null) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

/**
 * Validate template has required variables
 */
export function validateTemplateVariables(purpose: EmailPurpose, variables: string[]): string[] {
  const required = REQUIRED_VARIABLES[purpose] || [];
  return required.filter(v => !variables.includes(v));
}

/**
 * Get active template for a purpose (LEGACY - still uses purpose field in logs)
 * Note: DB no longer has 'purpose' column, but we still use purpose for email_logs tracking
 */
export async function getActiveTemplate(purpose: EmailPurpose) {
  // Since we removed purpose from email_templates, find template by name containing purpose keyword
  // This is a fallback for legacy code - new code should use getTemplatesByCategory or getTemplateById
  return prisma.emailTemplate.findFirst({
    where: {
      isActive: true,
      name: {
        contains: purpose.replace(/_/g, ' '),
      },
    },
  });
}

/**
 * Get active templates by category
 */
export async function getTemplatesByCategory(category: string, activeOnly = true) {
  return prisma.emailTemplate.findMany({
    where: {
      category,
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get template by ID
 */
export async function getTemplateById(templateId: string) {
  return prisma.emailTemplate.findUnique({
    where: { id: templateId },
  });
}

/**
 * Send email by purpose - NO SPAM FLOW
 *
 * ANTI-SPAM RULES:
 * - Only sends when admin takes action (triggered by businessEvent)
 * - Prevents duplicate emails per order+purpose (unless allowDuplicate=true)
 * - Logs all email attempts with audit trail
 *
 * Flow:
 * 1. Check anti-spam (if orderId provided and allowDuplicate=false)
 * 2. Load active template for purpose
 * 3. Validate required variables
 * 4. Render HTML with data
 * 5. Send via Resend (or mock in development)
 * 6. Log to email_logs with businessEvent and triggeredBy
 */
export async function sendEmailByPurpose(params: SendEmailParams): Promise<{
  success: boolean;
  emailId?: string;
  error?: string;
  skipped?: boolean; // True if email was skipped due to anti-spam
}> {
  const {
    purpose,
    to,
    data,
    metadata,
    businessEvent,
    orderId,
    triggeredBy,
    allowDuplicate = false
  } = params;

  // 1. ANTI-SPAM CHECK: Don't send duplicate emails for same order+purpose
  if (orderId && !allowDuplicate) {
    const alreadySent = await hasEmailBeenSent(orderId, purpose);
    if (alreadySent) {
      console.log(`[ANTI-SPAM] Email ${purpose} already sent for order ${orderId}. Skipping.`);
      return {
        success: false,
        error: `Email ${purpose} đã được gửi cho đơn hàng này. Sử dụng "Gửi lại" nếu cần.`,
        skipped: true
      };
    }
  }

  // 2. Get active template
  const template = await getActiveTemplate(purpose);
  if (!template) {
    // NO ERROR - just skip if no template (as per requirements)
    console.log(`[EMAIL] No active template for ${purpose}. Skipping.`);
    return { success: false, error: `No active template for purpose: ${purpose}` };
  }

  // 3. Validate required variables
  const templateVars = extractVariables(template.htmlContent);
  const missingVars = validateTemplateVariables(purpose, templateVars);
  // Check if data has required vars
  const missingData = REQUIRED_VARIABLES[purpose]?.filter(v => data[v] === undefined) || [];
  if (missingData.length > 0) {
    return { success: false, error: `Missing required data: ${missingData.join(', ')}` };
  }

  // 4. Render template
  const subject = renderTemplate(template.subject, data);
  const html = renderTemplate(template.htmlContent, data);

  // 5. Send email
  let emailId: string | undefined;
  let error: string | undefined;
  let status: 'SENT' | 'FAILED' = 'SENT';

  // Check if in mock mode (development or no API key)
  const isMockMode = process.env.EMAIL_MOCK === 'true' || !process.env.RESEND_API_KEY;

  if (isMockMode) {
    console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
    console.log(`[MOCK EMAIL] BusinessEvent: ${businessEvent || 'N/A'}, OrderId: ${orderId || 'N/A'}, TriggeredBy: ${triggeredBy || 'N/A'}`);
    emailId = `mock-${Date.now()}`;
  } else {
    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      });
      emailId = result.data?.id;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      status = 'FAILED';
    }
  }

  // 6. Log to database with NO SPAM fields
  await prisma.emailLog.create({
    data: {
      purpose,
      businessEvent: businessEvent || null,
      templateId: template.id,
      orderId: orderId || null,
      to,
      subject,
      htmlContent: html,
      status,
      provider: isMockMode ? 'mock' : 'resend',
      providerId: emailId,
      triggeredBy: triggeredBy || null,
      error,
      metadata: metadata ? JSON.stringify(metadata) : null,
      sentAt: status === 'SENT' ? new Date() : null,
    },
  });

  console.log(`[EMAIL] ${status}: ${purpose} to ${to} | Event: ${businessEvent || 'N/A'} | Order: ${orderId || 'N/A'} | By: ${triggeredBy || 'SYSTEM'}`);

  return {
    success: status === 'SENT',
    emailId,
    error,
  };
}

/**
 * NEW FLOW: Send email using specific template ID
 * Used when admin selects template from modal
 */
export interface SendEmailByTemplateParams {
  templateId: string;
  to: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  businessEvent?: string;
  orderId?: string;
  triggeredBy?: string;
  allowDuplicate?: boolean;
}

export async function sendEmailByTemplate(params: SendEmailByTemplateParams): Promise<{
  success: boolean;
  emailId?: string;
  error?: string;
  skipped?: boolean;
}> {
  const {
    templateId,
    to,
    data,
    metadata,
    businessEvent,
    orderId,
    triggeredBy,
    allowDuplicate = false
  } = params;

  // 1. Get template by ID
  const template = await getTemplateById(templateId);
  if (!template) {
    return { success: false, error: 'Template không tồn tại' };
  }

  // 2. ANTI-SPAM CHECK: Don't send duplicate emails for same order+template
  if (orderId && !allowDuplicate) {
    const existing = await prisma.emailLog.findFirst({
      where: {
        orderId,
        templateId,
        status: 'SENT',
      },
    });
    if (existing) {
      return {
        success: false,
        error: 'Email đã được gửi cho đơn hàng này với template này.',
        skipped: true
      };
    }
  }

  // 3. Render template
  const subject = renderTemplate(template.subject, data);
  const html = renderTemplate(template.htmlContent, data);

  // 4. Send email
  let emailId: string | undefined;
  let error: string | undefined;
  let status: 'SENT' | 'FAILED' = 'SENT';

  const isMockMode = process.env.EMAIL_MOCK === 'true' || !process.env.RESEND_API_KEY;

  if (isMockMode) {
    console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`);
    console.log(`[MOCK EMAIL] Template: ${template.name}, Category: ${template.category}`);
    emailId = `mock-${Date.now()}`;
  } else {
    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      });
      emailId = result.data?.id;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      status = 'FAILED';
    }
  }

  // 5. Log to database
  await prisma.emailLog.create({
    data: {
      purpose: template.category, // Use category as purpose for logs
      businessEvent: businessEvent || null,
      templateId: template.id,
      orderId: orderId || null,
      to,
      subject,
      htmlContent: html,
      status,
      provider: isMockMode ? 'mock' : 'resend',
      providerId: emailId,
      triggeredBy: triggeredBy || null,
      error,
      metadata: metadata ? JSON.stringify(metadata) : null,
      sentAt: status === 'SENT' ? new Date() : null,
    },
  });

  console.log(`[EMAIL] ${status}: Template "${template.name}" to ${to} | Order: ${orderId || 'N/A'} | By: ${triggeredBy || 'SYSTEM'}`);

  return {
    success: status === 'SENT',
    emailId,
    error,
  };
}
