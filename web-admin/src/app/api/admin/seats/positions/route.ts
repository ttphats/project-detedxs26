import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';

// PUT /api/admin/seats/positions - Update seat positions
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { positions } = body;

    if (!positions || !Array.isArray(positions) || positions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Positions array is required' },
        { status: 400 }
      );
    }

    // Update each seat position
    for (const pos of positions) {
      if (!pos.id || pos.x === undefined || pos.y === undefined) {
        continue;
      }
      await execute(
        'UPDATE seats SET position_x = ?, position_y = ?, updated_at = NOW() WHERE id = ?',
        [Math.round(pos.x), Math.round(pos.y), pos.id]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${positions.length} seat positions`
    });
  } catch (error: any) {
    console.error('Update seat positions error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update seat positions' },
      { status: 500 }
    );
  }
}

