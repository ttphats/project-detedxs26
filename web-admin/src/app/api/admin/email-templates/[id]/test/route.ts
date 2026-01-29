import { NextRequest, NextResponse } from 'next/server';
import { queryOne, EmailTemplate } from '@/lib/db';
import { Resend } from 'resend';

// Sample data for test email
const sampleData: Record<string, string> = {
  orderCode: "TDX-2026-TEST123",
  customerName: "Nguyễn Văn Test",
  customerEmail: "test@email.com",
  eventName: "TEDxFPTUniversityHCMC 2026",
  eventDate: "15/03/2026",
  eventTime: "18:00",
  eventLocation: "Nhà hát Thành phố Hồ Chí Minh",
  seats: "A1, A2, A3",
  totalAmount: "7,500,000 ₫",
  paymentDeadline: "20/02/2026 23:59",
  bankName: "Vietcombank",
  bankAccount: "1234567890",
  bankAccountName: "TEDX FPT UNIVERSITY HCMC",
  transferContent: "TDX-2026-TEST123",
  qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TDX-2026-TEST123",
  ticketUrl: "https://tedxfptuhcm.com/ticket/TDX-2026-TEST123",
};

// Replace variables in content
function replaceVariables(content: string): string {
  let result = content;
  Object.entries(sampleData).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, value);
  });
  return result;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Get template
    const template = await queryOne<EmailTemplate>(
      'SELECT * FROM email_templates WHERE id = ?',
      [id]
    );

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Replace variables with sample data
    const subject = replaceVariables(template.subject) + " [TEST]";
    const htmlContent = replaceVariables(template.html_content);

    // Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { success: false, error: 'RESEND_API_KEY not configured' },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const emailFrom = process.env.EMAIL_FROM || "TEDxFPT University HCMC <onboarding@resend.dev>";

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: email,
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log('📧 Test email sent:', data?.id, 'to:', email);

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email}`,
      emailId: data?.id
    });
  } catch (error: any) {
    console.error('Send test email error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send test email' },
      { status: 500 }
    );
  }
}

