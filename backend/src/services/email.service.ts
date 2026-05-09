import { Resend } from 'resend';
import { config } from '../config/env.js';
import { prisma } from '../db/prisma.js';

// Initialize Resend client
const resend = config.email.provider === 'resend' && config.email.resendApiKey
  ? new Resend(config.email.resendApiKey)
  : null;

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Send email using configured provider
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const { to, subject, html, text } = options;

  if (config.email.provider === 'mock') {
    console.log(`📧 [MOCK EMAIL] To: ${to}, Subject: ${subject}`);
    return { success: true, emailId: `mock-${Date.now()}` };
  }

  if (!resend) {
    console.error('❌ Resend not configured');
    return { success: false, error: 'Email provider not configured' };
  }

  try {
    const result = await resend.emails.send({
      from: config.email.from,
      to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('❌ Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log(`✅ Email sent to ${to}, ID: ${result.data?.id}`);
    return { success: true, emailId: result.data?.id };
  } catch (error: any) {
    console.error('❌ Send email error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get email template by purpose
 */
export async function getTemplateByPurpose(purpose: string) {
  return prisma.emailTemplate.findFirst({
    where: {
      purpose,
      isActive: true,
      isDefault: true,
    },
  });
}

/**
 * Get email template by ID
 */
export async function getTemplateById(templateId: string) {
  return prisma.emailTemplate.findUnique({
    where: { id: templateId },
  });
}

/**
 * Replace template variables with actual data
 */
export function replaceVariables(template: string, data: Record<string, any>): string {
  let result = template;

  // Debug: Log data being passed
  if (data.ticketUrl) {
    console.log('[TEMPLATE] ticketUrl value:', data.ticketUrl);
  }

  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    const stringValue = String(value ?? '');

    // Debug: Log replacement for ticketUrl
    if (key === 'ticketUrl') {
      console.log('[TEMPLATE] Replacing {{ticketUrl}} with:', stringValue);
    }

    result = result.replace(regex, stringValue);
  }

  return result;
}

/**
 * Extract variables from template
 */
export function extractVariables(template: string): string[] {
  const regex = /\{\{\s*(\w+)\s*\}\}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
}

export interface SendEmailByPurposeOptions {
  purpose: string;
  to: string;
  data: Record<string, any>;
  orderId?: string;
  triggeredBy?: string;
  allowDuplicate?: boolean;
  businessEvent?: string;
}

/**
 * Send email by purpose (uses default template for that purpose)
 */
export async function sendEmailByPurpose(options: SendEmailByPurposeOptions): Promise<EmailResult> {
  const { purpose, to, data, orderId, triggeredBy, allowDuplicate } = options;

  // Get template
  const template = await getTemplateByPurpose(purpose);
  if (!template) {
    console.warn(`⚠️ No active template found for purpose: ${purpose}`);
    return { success: false, error: `No template for purpose: ${purpose}` };
  }

  // Check anti-spam (unless allowDuplicate)
  if (!allowDuplicate && orderId) {
    const recentEmail = await prisma.emailLog.findFirst({
      where: {
        orderId,
        purpose,
        status: 'SENT',
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // 5 minutes
      },
    });

    if (recentEmail) {
      return { success: false, skipped: true, error: 'Email already sent recently' };
    }
  }

  // Replace variables
  const subject = replaceVariables(template.subject, data);
  const html = replaceVariables(template.htmlContent, data);
  const text = template.textContent ? replaceVariables(template.textContent, data) : undefined;

  // Send email
  const result = await sendEmail({ to, subject, html, text });

  // Log email
  await prisma.emailLog.create({
    data: {
      orderId,
      templateId: template.id,
      purpose,
      to,
      subject,
      htmlContent: html,
      status: result.success ? 'SENT' : 'FAILED',
      error: result.error,
      metadata: JSON.stringify({ triggeredBy, emailId: result.emailId }),
    },
  });

  return result;
}

