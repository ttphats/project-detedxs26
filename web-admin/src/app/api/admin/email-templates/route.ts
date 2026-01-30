import { NextRequest, NextResponse } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { randomUUID } from 'crypto';
import { EMAIL_PURPOSE, EmailPurpose, REQUIRED_VARIABLES } from '@/lib/email/types';
import { extractVariables } from '@/lib/email/service';

interface DBEmailTemplate {
  id: string;
  purpose: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  variables: string | null;
  is_active: number | boolean;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/admin/email-templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get('purpose');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let sql = 'SELECT * FROM email_templates WHERE 1=1';
    const params: unknown[] = [];

    if (purpose) {
      sql += ' AND purpose = ?';
      params.push(purpose);
    }

    if (activeOnly) {
      sql += ' AND is_active = 1';
    }

    sql += ' ORDER BY purpose, version DESC';

    const templates = await query<DBEmailTemplate>(sql, params);

    return NextResponse.json({
      success: true,
      data: templates.map(t => ({
        id: t.id,
        purpose: t.purpose,
        name: t.name,
        subject: t.subject,
        htmlContent: t.html_content,
        textContent: t.text_content,
        variables: t.variables ? JSON.parse(t.variables) : [],
        isActive: Boolean(t.is_active),
        version: t.version,
        createdBy: t.created_by,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      purposes: Object.values(EMAIL_PURPOSE),
    });
  } catch (error: unknown) {
    console.error('Get email templates error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/admin/email-templates - Create new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { purpose, name, subject, htmlContent, textContent } = body;

    // Validate required fields
    if (!purpose || !name || !subject || !htmlContent) {
      return NextResponse.json(
        { success: false, error: 'Purpose, name, subject, and HTML content are required' },
        { status: 400 }
      );
    }

    // Validate purpose is valid
    if (!Object.values(EMAIL_PURPOSE).includes(purpose as EmailPurpose)) {
      return NextResponse.json(
        { success: false, error: `Invalid purpose: ${purpose}` },
        { status: 400 }
      );
    }

    // Auto-extract variables from HTML
    const variables = extractVariables(htmlContent);

    // Check required variables for purpose
    const requiredVars = REQUIRED_VARIABLES[purpose as EmailPurpose] || [];
    const missingVars = requiredVars.filter(v => !variables.includes(v));
    if (missingVars.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Template is missing required variables for ${purpose}: ${missingVars.join(', ')}`,
        missingVariables: missingVars,
      }, { status: 400 });
    }

    // Get max version for this purpose
    const maxVersionResult = await queryOne<{ maxVersion: number }>(
      'SELECT MAX(version) as maxVersion FROM email_templates WHERE purpose = ?',
      [purpose]
    );
    const version = (maxVersionResult?.maxVersion || 0) + 1;

    const id = randomUUID();
    await execute(
      `INSERT INTO email_templates (id, purpose, name, subject, html_content, text_content, variables, is_active, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
      [
        id,
        purpose,
        name,
        subject,
        htmlContent,
        textContent || null,
        JSON.stringify(variables),
        version,
      ]
    );

    const template = await queryOne<DBEmailTemplate>(
      'SELECT * FROM email_templates WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      data: template ? {
        id: template.id,
        purpose: template.purpose,
        name: template.name,
        subject: template.subject,
        htmlContent: template.html_content,
        variables: template.variables ? JSON.parse(template.variables) : [],
        isActive: Boolean(template.is_active),
        version: template.version,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
      } : null,
      message: 'Template created successfully',
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create email template error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create template' },
      { status: 500 }
    );
  }
}

