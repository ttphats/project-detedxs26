import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';

interface DBEmailTemplate {
  id: string;
  purpose: string;
  name: string;
  is_active: number | boolean;
  version: number;
}

// POST /api/admin/email-templates/[id]/activate
// Activate a template (deactivates other templates with same purpose)
export async function POST(
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

    // Already active
    if (template.is_active) {
      return NextResponse.json({
        success: true,
        message: 'Template is already active',
      });
    }

    // Deactivate all templates with the same purpose
    await execute(
      'UPDATE email_templates SET is_active = 0, updated_at = NOW() WHERE purpose = ?',
      [template.purpose]
    );

    // Activate this template
    await execute(
      'UPDATE email_templates SET is_active = 1, updated_at = NOW() WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      message: `Template "${template.name}" v${template.version} activated for ${template.purpose}`,
    });
  } catch (error: unknown) {
    console.error('Activate email template error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to activate template' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/email-templates/[id]/activate
// Deactivate a template
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

    // Already inactive
    if (!template.is_active) {
      return NextResponse.json({
        success: true,
        message: 'Template is already inactive',
      });
    }

    // Deactivate
    await execute(
      'UPDATE email_templates SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      message: `Template "${template.name}" deactivated`,
    });
  } catch (error: unknown) {
    console.error('Deactivate email template error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to deactivate template' },
      { status: 500 }
    );
  }
}

