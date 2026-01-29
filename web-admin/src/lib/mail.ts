import { Resend } from 'resend';
import { config } from './env';
import { prisma } from './prisma';

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
  const template = await prisma.emailTemplate.findUnique({
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

export async function sendTicketEmail(params: {
  to: string;
  customerName: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  orderNumber: string;
  seats: Array<{ seatNumber: string; seatType: string; price: number }>;
  totalAmount: number;
  qrCodeUrl: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const seatsHtml = params.seats
    .map(
      (seat) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${seat.seatNumber}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${seat.seatType}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">$${seat.price.toFixed(2)}</td>
    </tr>
  `
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Your TEDx Ticket</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #e62b1e; color: white; padding: 20px; text-align: center;">
    <h1 style="margin: 0;">TEDx Ticket Confirmation</h1>
  </div>
  
  <div style="padding: 20px; background: #f9f9f9;">
    <h2>Hello ${params.customerName},</h2>
    <p>Thank you for your purchase! Your tickets for <strong>${params.eventName}</strong> are confirmed.</p>
    
    <div style="background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #e62b1e;">
      <h3 style="margin-top: 0;">Event Details</h3>
      <p><strong>Event:</strong> ${params.eventName}</p>
      <p><strong>Date:</strong> ${params.eventDate}</p>
      <p><strong>Venue:</strong> ${params.eventVenue}</p>
      <p><strong>Order Number:</strong> ${params.orderNumber}</p>
    </div>

    <h3>Your Seats</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background: #e62b1e; color: white;">
          <th style="padding: 10px; text-align: left;">Seat</th>
          <th style="padding: 10px; text-align: left;">Type</th>
          <th style="padding: 10px; text-align: left;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${seatsHtml}
      </tbody>
      <tfoot>
        <tr style="background: #f0f0f0; font-weight: bold;">
          <td colspan="2" style="padding: 10px; border: 1px solid #ddd;">Total</td>
          <td style="padding: 10px; border: 1px solid #ddd;">$${params.totalAmount.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="text-align: center; margin: 30px 0;">
      <img src="${params.qrCodeUrl}" alt="QR Code" style="max-width: 200px;" />
      <p style="font-size: 12px; color: #666;">Present this QR code at the event entrance</p>
    </div>

    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      If you have any questions, please contact us at support@tedxfptuhcm.com
    </p>
  </div>

  <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
    <p>© 2026 TEDxFPTUniversityHCMC. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: params.to,
    subject: `Your TEDx Ticket - ${params.eventName}`,
    html,
  });
}

