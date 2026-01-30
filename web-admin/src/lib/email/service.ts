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
 * Get active template for a purpose
 */
export async function getActiveTemplate(purpose: EmailPurpose) {
  return prisma.emailTemplate.findFirst({
    where: {
      purpose,
      isActive: true,
    },
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

