import { NextRequest, NextResponse } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';

interface DBEmailTemplate {
  id: string;
  name: string;
  purpose: string | null;
  is_default: number | boolean;
}

/**
 * POST /api/admin/email-templates/:id/set-default
 * 
 * Set a template as default for its purpose.
 * Only one template can be default per purpose.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the template
    const template = await queryOne<DBEmailTemplate>(
      'SELECT id, name, purpose, is_default FROM email_templates WHERE id = ?',
      [id]
    );

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    if (!template.purpose) {
      return NextResponse.json(
        { success: false, error: 'Template must have a purpose to be set as default' },
        { status: 400 }
      );
    }

    // Check if already default
    if (template.is_default) {
      return NextResponse.json({
        success: true,
        message: 'Template is already the default',
        data: { id, purpose: template.purpose, isDefault: true },
      });
    }

    // Remove default from other templates with same purpose
    await execute(
      'UPDATE email_templates SET is_default = FALSE WHERE purpose = ? AND id != ?',
      [template.purpose, id]
    );

    // Set this template as default
    await execute(
      'UPDATE email_templates SET is_default = TRUE WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      message: `Template set as default for purpose: ${template.purpose}`,
      data: { id, purpose: template.purpose, isDefault: true },
    });
  } catch (error: unknown) {
    console.error('Set default template error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to set default' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/email-templates/:id/set-default
 * 
 * Remove default status from a template.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await execute(
      'UPDATE email_templates SET is_default = FALSE WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      message: 'Default status removed',
      data: { id, isDefault: false },
    });
  } catch (error: unknown) {
    console.error('Remove default template error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to remove default' },
      { status: 500 }
    );
  }
}

