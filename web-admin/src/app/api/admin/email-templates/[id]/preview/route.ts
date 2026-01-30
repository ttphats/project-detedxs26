import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { EmailPurpose, MOCK_DATA } from '@/lib/email/types';

interface DBEmailTemplate {
  id: string;
  purpose: string;
  name: string;
  subject: string;
  html_content: string;
}

// Render template with variables
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

// GET /api/admin/email-templates/[id]/preview
// Preview template with mock data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const template = await queryOne<DBEmailTemplate>(
      'SELECT * FROM email_templates WHERE id = ?',
      [id]
    );

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // Get mock data for this purpose
    const mockData = MOCK_DATA[template.purpose as EmailPurpose] || {};

    // Render template
    const renderedHtml = renderTemplate(template.html_content, mockData);
    const renderedSubject = renderTemplate(template.subject, mockData);

    // Check if client wants JSON or HTML
    const accept = request.headers.get('accept') || '';
    if (accept.includes('application/json')) {
      return NextResponse.json({
        success: true,
        data: {
          subject: renderedSubject,
          html: renderedHtml,
          mockData,
        },
      });
    }

    // Return HTML directly for iframe preview
    return new NextResponse(renderedHtml, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: unknown) {
    console.error('Preview email template error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to preview template' },
      { status: 500 }
    );
  }
}

// POST /api/admin/email-templates/[id]/preview
// Preview template with custom data
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { data: customData, htmlContent } = body;

    let html = htmlContent;
    let subject = '';

    // If no custom HTML provided, fetch from database
    if (!html) {
      const template = await queryOne<DBEmailTemplate>(
        'SELECT * FROM email_templates WHERE id = ?',
        [id]
      );

      if (!template) {
        return NextResponse.json(
          { success: false, error: 'Template not found' },
          { status: 404 }
        );
      }

      html = template.html_content;
      subject = template.subject;
    }

    // Use mock data if no custom data provided
    const template = await queryOne<DBEmailTemplate>(
      'SELECT purpose FROM email_templates WHERE id = ?',
      [id]
    );
    const mockData = template 
      ? MOCK_DATA[template.purpose as EmailPurpose] || {}
      : {};
    
    const finalData = { ...mockData, ...customData };

    // Render template
    const renderedHtml = renderTemplate(html, finalData);
    const renderedSubject = renderTemplate(subject, finalData);

    return NextResponse.json({
      success: true,
      data: {
        subject: renderedSubject,
        html: renderedHtml,
      },
    });
  } catch (error: unknown) {
    console.error('Preview email template error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to preview template' },
      { status: 500 }
    );
  }
}

