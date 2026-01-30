import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { randomUUID } from 'crypto';
import { extractVariables } from '@/lib/email/service';

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

// GET /api/admin/email-templates/[id]
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

    return NextResponse.json({
      success: true,
      data: formatTemplate(template),
    });
  } catch (error: unknown) {
    console.error('Get email template error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/email-templates/[id]
// If template is active, clone it as new version instead of editing directly
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, category, description, subject, htmlContent, textContent } = body;

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

    // If template is active, clone it as new version
    if (template.is_active) {
      // Get max version for this template name
      const maxVersionResult = await queryOne<{ maxVersion: number }>(
        'SELECT MAX(version) as maxVersion FROM email_templates WHERE name LIKE ?',
        [`${template.name}%`]
      );
      const newVersion = (maxVersionResult?.maxVersion || 0) + 1;

      // Clone as new draft
      const newId = randomUUID();
      const newHtmlContent = htmlContent ?? template.html_content;
      const newVariables = extractVariables(newHtmlContent);

      await execute(
        `INSERT INTO email_templates (id, name, category, description, subject, html_content, text_content, variables, is_active, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
        [
          newId,
          (name ?? template.name) + ` v${newVersion}`,
          category ?? template.category,
          description ?? template.description,
          subject ?? template.subject,
          newHtmlContent,
          textContent ?? template.text_content,
          JSON.stringify(newVariables),
          newVersion,
        ]
      );

      const newTemplate = await queryOne<DBEmailTemplate>(
        'SELECT * FROM email_templates WHERE id = ?',
        [newId]
      );

      return NextResponse.json({
        success: true,
        data: newTemplate ? formatTemplate(newTemplate) : null,
        message: 'Active template cloned as new draft version',
        cloned: true,
      });
    }

    // Not active - update directly
    const updates: string[] = [];
    const params_arr: unknown[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params_arr.push(name);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params_arr.push(category);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params_arr.push(description);
    }
    if (subject !== undefined) {
      updates.push('subject = ?');
      params_arr.push(subject);
    }
    if (htmlContent !== undefined) {
      updates.push('html_content = ?');
      params_arr.push(htmlContent);
      // Auto-update variables
      const vars = extractVariables(htmlContent);
      updates.push('variables = ?');
      params_arr.push(JSON.stringify(vars));
    }
    if (textContent !== undefined) {
      updates.push('text_content = ?');
      params_arr.push(textContent);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    updates.push('updated_at = NOW()');
    params_arr.push(id);

    await execute(
      `UPDATE email_templates SET ${updates.join(', ')} WHERE id = ?`,
      params_arr
    );

    const updated = await queryOne<DBEmailTemplate>(
      'SELECT * FROM email_templates WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      data: updated ? formatTemplate(updated) : null,
      message: 'Template updated successfully',
    });
  } catch (error: unknown) {
    console.error('Update email template error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/email-templates/[id]
export async function DELETE(
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

    // Don't allow deleting active template
    if (template.is_active) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete an active template. Deactivate it first.' },
        { status: 400 }
      );
    }

    await execute('DELETE FROM email_templates WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error: unknown) {
    console.error('Delete email template error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete template' },
      { status: 500 }
    );
  }
}

