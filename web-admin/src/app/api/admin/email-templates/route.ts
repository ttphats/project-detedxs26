import { NextRequest, NextResponse } from 'next/server';
import { query, execute, queryOne, EmailTemplate } from '@/lib/db';
import { randomUUID } from 'crypto';

// GET /api/admin/email-templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const templates = await query<EmailTemplate>(
      'SELECT * FROM email_templates ORDER BY created_at DESC'
    );

    return NextResponse.json({
      success: true,
      data: templates.map(t => ({
        ...t,
        variables: t.variables ? JSON.parse(t.variables) : []
      }))
    });
  } catch (error: any) {
    console.error('Get email templates error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/admin/email-templates - Create new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, subject, html_content, text_content, variables, is_active } = body;

    if (!name || !subject || !html_content) {
      return NextResponse.json(
        { success: false, error: 'Name, subject, and HTML content are required' },
        { status: 400 }
      );
    }

    // Check if template with same name exists
    const existing = await queryOne<EmailTemplate>(
      'SELECT id FROM email_templates WHERE name = ?',
      [name]
    );

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Template with this name already exists' },
        { status: 409 }
      );
    }

    const id = randomUUID();
    await execute(
      `INSERT INTO email_templates (id, name, subject, html_content, text_content, variables, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id,
        name,
        subject,
        html_content,
        text_content || null,
        JSON.stringify(variables || []),
        is_active !== false ? 1 : 0
      ]
    );

    const template = await queryOne<EmailTemplate>(
      'SELECT * FROM email_templates WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      data: template,
      message: 'Template created successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create email template error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}

