import { NextRequest, NextResponse } from 'next/server';
import { query, execute, LayoutSection } from '@/lib/db';
import { randomUUID } from 'crypto';

// GET /api/admin/layouts/[id]/sections
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sections = await query<LayoutSection>(
      'SELECT * FROM layout_sections WHERE layout_id = ? ORDER BY sort_order',
      [id]
    );
    return NextResponse.json({ success: true, data: sections });
  } catch (error: any) {
    console.error('Get sections error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Generate section code from name
function generateSectionCode(name: string, id: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-');
  return `${cleaned}-${id.substring(0, 4)}`;
}

// POST /api/admin/layouts/[id]/sections - Add section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: layoutId } = await params;
    const body = await request.json();
    const {
      name, rows_count, cols_count, seat_count, seat_type, price,
      x, y, width, height, rotation, sort_order
    } = body;

    const sectionId = randomUUID();
    const sectionName = name || 'Section';
    const sectionCode = generateSectionCode(sectionName, sectionId);

    await execute(
      `INSERT INTO layout_sections
       (id, layout_id, section_code, name, rows_count, cols_count, seat_count, seat_type, price, x, y, width, height, rotation, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sectionId, layoutId, sectionCode,
        sectionName,
        rows_count || 3,
        cols_count || 4,
        seat_count || null,
        seat_type || 'STANDARD',
        price || 0,
        x || 0.1,
        y || 0.1,
        width || 0.2,
        height || 0.15,
        rotation || 0,
        sort_order || 0
      ]
    );

    return NextResponse.json({
      success: true,
      data: { id: sectionId, section_code: sectionCode },
      message: 'Section added successfully'
    });
  } catch (error: any) {
    console.error('Add section error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/admin/layouts/[id]/sections - Update section (or bulk update)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    
    // Bulk update: sections array
    if (body.sections && Array.isArray(body.sections)) {
      for (const section of body.sections) {
        await execute(
          `UPDATE layout_sections SET 
           name = ?, rows_count = ?, cols_count = ?, seat_count = ?, seat_type = ?, price = ?,
           x = ?, y = ?, width = ?, height = ?, rotation = ?, sort_order = ?, updated_at = NOW()
           WHERE id = ?`,
          [
            section.name, section.rows_count, section.cols_count, section.seat_count,
            section.seat_type, section.price, section.x, section.y, section.width,
            section.height, section.rotation || 0, section.sort_order || 0, section.id
          ]
        );
      }
      return NextResponse.json({
        success: true,
        message: `Updated ${body.sections.length} sections`
      });
    }

    // Single section update
    const { sectionId, ...updateData } = body;
    if (!sectionId) {
      return NextResponse.json(
        { success: false, error: 'Section ID required' },
        { status: 400 }
      );
    }

    const fields = Object.keys(updateData);
    if (fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    const setClauses = fields.map(f => `${f} = ?`).join(', ');
    const values = [...Object.values(updateData), sectionId];

    await execute(
      `UPDATE layout_sections SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return NextResponse.json({ success: true, message: 'Section updated' });
  } catch (error: any) {
    console.error('Update section error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/layouts/[id]/sections?sectionId=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get('sectionId');

    if (!sectionId) {
      return NextResponse.json(
        { success: false, error: 'Section ID required' },
        { status: 400 }
      );
    }

    await execute('DELETE FROM layout_sections WHERE id = ?', [sectionId]);

    return NextResponse.json({ success: true, message: 'Section deleted' });
  } catch (error: any) {
    console.error('Delete section error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

