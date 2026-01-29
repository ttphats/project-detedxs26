import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, Layout, LayoutSection, Seat } from '@/lib/db';

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function generateSeatKey(sectionCode: string, row: string, col: number): string {
  return `${sectionCode}-${row}-${col}`;
}

interface GeneratedSeat {
  section_code: string;
  row: string;
  col: number;
  seat_key: string;
}

function generateSeatsFromSection(section: LayoutSection): GeneratedSeat[] {
  const seats: GeneratedSeat[] = [];
  const { rows_count, cols_count, seat_count, section_code } = section;
  const maxSeats = seat_count || (rows_count * cols_count);
  let seatIndex = 0;

  for (let r = 0; r < rows_count && seatIndex < maxSeats; r++) {
    const rowLabel = ROW_LABELS[r] || `R${r + 1}`;
    for (let c = 0; c < cols_count && seatIndex < maxSeats; c++) {
      seats.push({
        section_code,
        row: rowLabel,
        col: c + 1,
        seat_key: generateSeatKey(section_code, rowLabel, c + 1)
      });
      seatIndex++;
    }
  }
  return seats;
}

// GET /api/admin/layouts/[id]/validate - Validate layout before publish
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Get layout
    const layout = await queryOne<Layout>('SELECT * FROM layouts WHERE id = ?', [id]);
    if (!layout) {
      return NextResponse.json({ success: false, error: 'Layout not found' }, { status: 404 });
    }

    // 2. Get sections
    const sections = await query<LayoutSection>(
      'SELECT * FROM layout_sections WHERE layout_id = ? ORDER BY sort_order',
      [id]
    );

    // 3. Generate new seats from sections
    const newSeats: GeneratedSeat[] = [];
    for (const section of sections) {
      newSeats.push(...generateSeatsFromSection(section));
    }
    const newSeatKeys = new Set(newSeats.map(s => s.seat_key));

    // 4. Get existing seats for event
    const existingSeats = await query<Seat>(
      `SELECT * FROM seats WHERE event_id = ? AND status != 'REMOVED'`,
      [layout.event_id]
    );

    // 5. Analyze impact
    const seatsBySection = new Map<string, { total: number; booked: number; reserved: number; available: number }>();
    
    for (const seat of existingSeats) {
      const sectionCode = seat.section_code || seat.section || 'UNKNOWN';
      if (!seatsBySection.has(sectionCode)) {
        seatsBySection.set(sectionCode, { total: 0, booked: 0, reserved: 0, available: 0 });
      }
      const stats = seatsBySection.get(sectionCode)!;
      stats.total++;
      if (seat.status === 'SOLD') stats.booked++;
      else if (seat.status === 'RESERVED') stats.reserved++;
      else if (seat.status === 'AVAILABLE') stats.available++;
    }

    // 6. Calculate changes
    const oldSeatKeys = new Set(existingSeats.map(s => s.seat_key).filter(Boolean));
    const seatsToKeep = existingSeats.filter(s => s.seat_key && newSeatKeys.has(s.seat_key));
    const seatsToRemove = existingSeats.filter(s => !s.seat_key || !newSeatKeys.has(s.seat_key));
    const seatsToAdd = newSeats.filter(s => !oldSeatKeys.has(s.seat_key));

    const bookedSeatsToRemove = seatsToRemove.filter(s => s.status === 'SOLD');
    const reservedSeatsToRemove = seatsToRemove.filter(s => s.status === 'RESERVED');

    // 7. Validation warnings
    const warnings: string[] = [];
    const errors: string[] = [];

    if (bookedSeatsToRemove.length > 0) {
      warnings.push(`${bookedSeatsToRemove.length} SOLD seats will be marked as REMOVED (data preserved)`);
    }
    if (reservedSeatsToRemove.length > 0) {
      warnings.push(`${reservedSeatsToRemove.length} RESERVED seats will be marked as REMOVED`);
    }
    if (sections.length === 0) {
      errors.push('No sections defined. Add at least one section before publishing.');
    }

    // 8. Section stats for UI
    const sectionStats = sections.map(section => {
      const existingStats = seatsBySection.get(section.section_code) || { total: 0, booked: 0, reserved: 0, available: 0 };
      const newSeatCount = section.seat_count || (section.rows_count * section.cols_count);
      return {
        id: section.id,
        name: section.name,
        section_code: section.section_code,
        newSeatCount,
        existingTotal: existingStats.total,
        existingBooked: existingStats.booked,
        existingReserved: existingStats.reserved,
        existingAvailable: existingStats.available
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        canPublish: errors.length === 0,
        errors,
        warnings,
        summary: {
          totalNewSeats: newSeats.length,
          totalExistingSeats: existingSeats.length,
          seatsToKeep: seatsToKeep.length,
          seatsToRemove: seatsToRemove.length,
          seatsToAdd: seatsToAdd.length,
          bookedSeatsAffected: bookedSeatsToRemove.length,
          reservedSeatsAffected: reservedSeatsToRemove.length
        },
        sectionStats
      }
    });
  } catch (error: any) {
    console.error('Validate layout error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

