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

/**
 * Send order notification email to dev/admin notification recipients.
 * Triggered when a new pending order is created (before payment).
 */
export async function sendOrderNotificationToDevs(orderInfo: {
  orderNumber: string;
  eventName: string;
  seats: { seatNumber: string; seatType: string; price: number }[];
  totalAmount: number;
  discountAmount?: number | null;
  promoCode?: string | null;
}): Promise<void> {
  // Lazy import to avoid circular dependency
  const { getNotificationEmails } = await import('./settings.service.js');

  const emails = await getNotificationEmails();
  if (emails.length === 0) {
    console.log('[NOTIFICATION] No notification emails configured, skipping');
    return;
  }

  const seatsList = orderInfo.seats
    .map((s) => `${s.seatNumber} (${s.seatType}) - ${Number(s.price).toLocaleString('vi-VN')}đ`)
    .join('<br/>');

  const now = new Date();
  const timestamp = now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const discountHtml = orderInfo.discountAmount
    ? `<tr>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#6b7280;">Giảm giá / Discount</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;color:#16a34a;font-weight:bold;">
          -${Number(orderInfo.discountAmount).toLocaleString('vi-VN')}đ
          ${orderInfo.promoCode ? `(${orderInfo.promoCode})` : ''}
        </td>
      </tr>`
    : '';

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:24px;border-radius:12px 12px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:20px;">🎫 Đơn hàng mới / New Order</h2>
        <p style="color:#fecaca;margin:8px 0 0;font-size:14px;">${timestamp}</p>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;width:40%;">Mã đơn / Order #</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;color:#dc2626;">${orderInfo.orderNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Sự kiện / Event</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;">${orderInfo.eventName}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Ghế / Seats (${orderInfo.seats.length})</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;">${seatsList}</td>
          </tr>
          ${discountHtml}
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Tổng tiền / Total</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:18px;font-weight:bold;color:#dc2626;">
              ${Number(orderInfo.totalAmount).toLocaleString('vi-VN')}đ
            </td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;">Trạng thái / Status</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;">
              <span style="background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;">
                ⏳ PENDING - Chờ thanh toán
              </span>
            </td>
          </tr>
        </table>
        <p style="color:#9ca3af;font-size:12px;margin:16px 0 0;text-align:center;">
          Email tự động từ hệ thống TEDx Ticketing / Automated notification from TEDx Ticketing System
        </p>
      </div>
    </div>
  `;

  const subject = `🎫 [TEDx] Đơn hàng mới #${orderInfo.orderNumber} - ${orderInfo.seats.length} ghế - ${Number(orderInfo.totalAmount).toLocaleString('vi-VN')}đ`;

  // Send to all notification emails (fire-and-forget, don't block order creation)
  for (const email of emails) {
    sendEmail({ to: email, subject, html }).then((result) => {
      if (result.success) {
        console.log(`[NOTIFICATION] ✅ Sent order notification to ${email}`);
      } else {
        console.error(`[NOTIFICATION] ❌ Failed to send to ${email}:`, result.error);
      }
    }).catch((err) => {
      console.error(`[NOTIFICATION] ❌ Error sending to ${email}:`, err);
    });
  }
}

