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
 * Send ticket confirmation email using database template
 * This function now uses the new template system with sendEmailByPurpose
 */
export async function sendTicketEmail(params: {
  to: string;
  customerName: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  orderNumber: string;
  seats: Array<{ seatNumber: string; seatType: string; section?: string; row?: string; price: number }>;
  totalAmount: number;
  qrCodeUrl: string;
  ticketUrl: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  // Parse event date to extract time
  const eventDateTime = new Date(params.eventDate);
  const formattedDate = eventDateTime.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = eventDateTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Format amount as VND
  const totalAmountFormatted = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(params.totalAmount);

  // Try to use template from database first
  const result = await sendByPurpose({
    purpose: 'TICKET_CONFIRMED',
    to: params.to,
    data: {
      customerName: params.customerName,
      eventName: params.eventName,
      eventDate: formattedDate,
      eventTime: formattedTime,
      eventVenue: params.eventVenue,
      orderNumber: params.orderNumber,
      ticketUrl: params.ticketUrl,
      qrCodeUrl: params.qrCodeUrl,
      totalAmount: totalAmountFormatted,
      seatInfo: params.seats.map(s => `${s.seatNumber} (${s.seatType})`).join(', '),
    },
    metadata: {
      orderId: params.orderNumber,
      seatsCount: params.seats.length,
    },
  });

  // If template not found, fallback to hardcoded template
  if (!result.success && result.error?.includes('No active template')) {
    console.log('[EMAIL] No active template found, using fallback hardcoded template');
    const { generateFullTicketEmail } = await import('./email-templates/ticket-confirmation');

    const html = generateFullTicketEmail({
      customerName: params.customerName,
      eventName: params.eventName,
      eventDate: formattedDate,
      eventTime: formattedTime,
      eventVenue: params.eventVenue,
      orderNumber: params.orderNumber,
      seats: params.seats,
      totalAmount: params.totalAmount,
      qrCodeUrl: params.qrCodeUrl,
      ticketUrl: params.ticketUrl,
    });

    return sendEmail({
      to: params.to,
      subject: `🎫 Vé điện tử TEDx - ${params.eventName} | ${params.orderNumber}`,
      html,
    });
  }

  return {
    success: result.success,
    id: result.emailId,
    error: result.error,
  };
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

