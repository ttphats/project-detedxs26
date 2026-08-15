import { Resend } from 'resend';
import { config } from './env';
import { prisma } from './prisma';
import { sendEmailByPurpose as sendByPurpose } from './email/service';
import { EmailPurpose } from './email/types';

// Create Resend client
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    if (!config.email.resend.apiKey) {
      throw new Error('RESEND_API_KEY is required');
    }
    resendClient = new Resend(config.email.resend.apiKey);
  }
  return resendClient;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // Log email attempt
    const emailLog = await prisma.emailLog.create({
      data: {
        purpose: 'LEGACY', // Legacy emails sent via old sendEmail function
        to: params.to,
        subject: params.subject,
        htmlContent: params.html,
        status: 'PENDING',
        provider: config.email.provider,
      },
    });

    // Mock mode - just log
    if (config.isMock || config.email.provider === 'mock') {
      console.log('📧 [MOCK EMAIL]');
      console.log('From:', config.email.from);
      console.log('To:', params.to);
      console.log('Subject:', params.subject);
      console.log('HTML length:', params.html.length);

      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: 'SENT',
          providerId: `mock-${Date.now()}`,
          sentAt: new Date(),
        },
      });

      return { success: true, id: `mock-${Date.now()}` };
    }

    // Send email via Resend
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: config.email.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Update log
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: 'SENT',
        providerId: data?.id,
        sentAt: new Date(),
      },
    });

    console.log('📧 Email sent via Resend:', data?.id);
    return { success: true, id: data?.id };
  } catch (error: any) {
    console.error('Failed to send email:', error);

    // Log failure
    try {
      await prisma.emailLog.create({
        data: {
          purpose: 'LEGACY',
          to: params.to,
          subject: params.subject,
          htmlContent: params.html,
          status: 'FAILED',
          provider: config.email.provider,
          error: error.message,
        },
      });
    } catch (logError) {
      console.error('Failed to log email error:', logError);
    }

    return { success: false, error: error.message };
  }
}

export async function sendEmailFromTemplate(
  templateName: string,
  to: string,
  variables: Record<string, string>
): Promise<{ success: boolean; id?: string; error?: string }> {
  const template = await prisma.emailTemplate.findFirst({
    where: { name: templateName, isActive: true },
  });

  if (!template) {
    return { success: false, error: `Template "${templateName}" not found or inactive` };
  }

  // Replace variables in subject and HTML
  let subject = template.subject;
  let html = template.htmlContent;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replace(new RegExp(placeholder, 'g'), value);
    html = html.replace(new RegExp(placeholder, 'g'), value);
  }

  return sendEmail({ to, subject, html });
}


/**
 * Send email by purpose using database template
 * This is the NEW recommended way to send emails
 */
export async function sendEmailByPurpose(
  purpose: EmailPurpose,
  to: string,
  data: Record<string, unknown>,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; id?: string; error?: string }> {
  const result = await sendByPurpose({ purpose, to, data, metadata });
  return {
    success: result.success,
    id: result.emailId,
    error: result.error,
  };
}

/**
 * Send payment pending email
 */
export async function sendPaymentPendingEmail(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  totalAmount: number;
  paymentDeadline: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  transferContent: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const totalAmountFormatted = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(params.totalAmount);

  return sendEmailByPurpose('PAYMENT_PENDING', params.to, {
    customerName: params.customerName,
    orderNumber: params.orderNumber,
    totalAmount: totalAmountFormatted,
    paymentDeadline: params.paymentDeadline,
    bankName: params.bankName,
    accountNumber: params.accountNumber,
    accountName: params.accountName,
    transferContent: params.transferContent,
  });
}

/**
 * Send payment confirmed email
 */
export async function sendPaymentConfirmedEmail(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  totalAmount: number;
  eventName: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const totalAmountFormatted = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(params.totalAmount);

  return sendEmailByPurpose('PAYMENT_CONFIRMED', params.to, {
    customerName: params.customerName,
    orderNumber: params.orderNumber,
    totalAmount: totalAmountFormatted,
    eventName: params.eventName,
  });
}

/**
 * Send payment rejected email
 */
export async function sendPaymentRejectedEmail(params: {
  to: string;
  customerName: string;
  orderNumber: string;
  reason: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  return sendEmailByPurpose('PAYMENT_REJECTED', params.to, {
    customerName: params.customerName,
    orderNumber: params.orderNumber,
    reason: params.reason,
  });
}

