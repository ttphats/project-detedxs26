import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, EmailTemplate } from '@/lib/db';

// GET /api/admin/email-templates/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
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

    return NextResponse.json({
      success: true,
      data: {
        ...template,
        variables: template.variables ? JSON.parse(template.variables) : []
      }
    });
  } catch (error: any) {
    console.error('Get email template error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/email-templates/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, subject, html_content, text_content, variables, is_active } = body;

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

    const updates: string[] = [];
    const params_arr: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params_arr.push(name);
    }
    if (subject !== undefined) {
      updates.push('subject = ?');
      params_arr.push(subject);
    }
    if (html_content !== undefined) {
      updates.push('html_content = ?');
      params_arr.push(html_content);
    }
    if (text_content !== undefined) {
      updates.push('text_content = ?');
      params_arr.push(text_content);
    }
    if (variables !== undefined) {
      updates.push('variables = ?');
      params_arr.push(JSON.stringify(variables));
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params_arr.push(is_active ? 1 : 0);
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

    const updated = await queryOne<EmailTemplate>(
      'SELECT * FROM email_templates WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Template updated successfully'
    });
  } catch (error: any) {
    console.error('Update email template error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update template' },
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

    await execute('DELETE FROM email_templates WHERE id = ?', [id]);

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete email template error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}

