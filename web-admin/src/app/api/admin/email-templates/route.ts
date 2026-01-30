import { NextRequest, NextResponse } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { randomUUID } from 'crypto';
import { extractVariables } from '@/lib/email/service';

// Template categories
const TEMPLATE_CATEGORIES = ['ORDER', 'EVENT', 'NOTIFICATION', 'GENERAL'] as const;
type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];

interface DBEmailTemplate {
  id: string;
  name: string;
  category: string;
  description: string | null;
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

function formatTemplate(t: DBEmailTemplate) {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
    subject: t.subject,
    htmlContent: t.html_content,
    textContent: t.text_content,
    variables: t.variables ? JSON.parse(t.variables) : [],
    isActive: Boolean(t.is_active),
    version: t.version,
    createdBy: t.created_by,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

// GET /api/admin/email-templates - List all templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let sql = 'SELECT * FROM email_templates WHERE 1=1';
    const params: unknown[] = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (activeOnly) {
      sql += ' AND is_active = 1';
    }

    sql += ' ORDER BY category, name, version DESC';

    const templates = await query<DBEmailTemplate>(sql, params);

    return NextResponse.json({
      success: true,
      data: templates.map(formatTemplate),
      categories: TEMPLATE_CATEGORIES,
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
    const { name, category = 'GENERAL', description, subject, htmlContent, textContent } = body;

    // Validate required fields
    if (!name || !subject || !htmlContent) {
      return NextResponse.json(
        { success: false, error: 'Name, subject, and HTML content are required' },
        { status: 400 }
      );
    }

    // Validate category is valid
    if (!TEMPLATE_CATEGORIES.includes(category as TemplateCategory)) {
      return NextResponse.json(
        { success: false, error: `Invalid category: ${category}. Valid: ${TEMPLATE_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Auto-extract variables from HTML
    const variables = extractVariables(htmlContent);

    // Get max version for this template name
    const maxVersionResult = await queryOne<{ maxVersion: number }>(
      'SELECT MAX(version) as maxVersion FROM email_templates WHERE name LIKE ?',
      [`${name}%`]
    );
    const version = (maxVersionResult?.maxVersion || 0) + 1;

    const id = randomUUID();
    await execute(
      `INSERT INTO email_templates (id, name, category, description, subject, html_content, text_content, variables, is_active, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
      [
        id,
        name,
        category,
        description || null,
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
      data: template ? formatTemplate(template) : null,
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

