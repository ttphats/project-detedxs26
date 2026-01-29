import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, getPool, Layout, LayoutSection, Seat, GeneratedSeat } from '@/lib/db';
import { randomUUID } from 'crypto';

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Generate seat key: stable identifier for a seat
function generateSeatKey(sectionCode: string, row: string, col: number): string {
  return `${sectionCode}-${row}-${col}`;
}

// Generate seats from section configuration
function generateSeatsFromSection(section: LayoutSection): GeneratedSeat[] {
  const seats: GeneratedSeat[] = [];
  const { rows_count, cols_count, seat_count, section_code, name, seat_type, price } = section;
  const maxSeats = seat_count || (rows_count * cols_count);
  let seatIndex = 0;

  for (let r = 0; r < rows_count && seatIndex < maxSeats; r++) {
    const rowLabel = ROW_LABELS[r] || `R${r + 1}`;
    for (let c = 0; c < cols_count && seatIndex < maxSeats; c++) {
      const colNum = c + 1;
      const seatKey = generateSeatKey(section_code, rowLabel, colNum);
      const seatNumber = `${name}-${rowLabel}${colNum}`;

      seats.push({
        section_code,
        row: rowLabel,
        col: colNum,
        seat_key: seatKey,
        seat_number: seatNumber,
        seat_type,
        price
      });
      seatIndex++;
    }
  }
  return seats;
}

// Compare old seats vs new seats
function compareSeats(oldSeats: Seat[], newSeats: GeneratedSeat[]) {
  const oldSeatMap = new Map(oldSeats.filter(s => s.seat_key).map(s => [s.seat_key!, s]));
  const newSeatMap = new Map(newSeats.map(s => [s.seat_key, s]));

  const toKeep: Seat[] = [];
  const toRemove: Seat[] = [];
  const toAdd: GeneratedSeat[] = [];

  // Check old seats
  for (const [key, seat] of oldSeatMap) {
    if (newSeatMap.has(key)) {
      toKeep.push(seat);
    } else {
      toRemove.push(seat);
    }
  }

  // Check new seats
  for (const [key, seat] of newSeatMap) {
    if (!oldSeatMap.has(key)) {
      toAdd.push(seat);
    }
  }

  return { toKeep, toRemove, toAdd };
}

// POST /api/admin/layouts/[id]/publish - Safe publish with seat preservation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    const { id } = await params;
    await conn.beginTransaction();

    // 1. Get layout to publish
    const [layoutRows] = await conn.execute<any[]>(
      'SELECT * FROM layouts WHERE id = ?',
      [id]
    );
    const layout = layoutRows[0] as Layout | undefined;

    if (!layout) {
      await conn.rollback();
      return NextResponse.json({ success: false, error: 'Layout not found' }, { status: 404 });
    }

    if (layout.status !== 'DRAFT') {
      await conn.rollback();
      return NextResponse.json({ success: false, error: 'Only DRAFT layouts can be published' }, { status: 400 });
    }

    // 2. Get sections from DRAFT layout
    const [sectionRows] = await conn.execute<any[]>(
      'SELECT * FROM layout_sections WHERE layout_id = ? ORDER BY sort_order',
      [id]
    );
    const sections = sectionRows as LayoutSection[];

    if (sections.length === 0) {
      await conn.rollback();
      return NextResponse.json({ success: false, error: 'No sections in layout. Add sections first.' }, { status: 400 });
    }

    // 3. Generate NEW seats from sections
    const newSeats: GeneratedSeat[] = [];
    for (const section of sections) {
      newSeats.push(...generateSeatsFromSection(section));
    }

    // 4. Fetch existing seats for this event (excluding REMOVED)
    const [oldSeatRows] = await conn.execute<any[]>(
      `SELECT * FROM seats WHERE event_id = ? AND status != 'REMOVED'`,
      [layout.event_id]
    );
    const oldSeats = oldSeatRows as Seat[];

    // 5. Compare seats
    const { toKeep, toRemove, toAdd } = compareSeats(oldSeats, newSeats);

    // 6. Validation: Check if any BOOKED/RESERVED seats would be removed
    const bookedSeatsToRemove = toRemove.filter(s => s.status === 'SOLD' || s.status === 'RESERVED');
    if (bookedSeatsToRemove.length > 0) {
      // These seats will be marked as REMOVED, not deleted
      console.warn(`Warning: ${bookedSeatsToRemove.length} booked/reserved seats will be marked as REMOVED`);
    }

    // 7. Process seat changes

    // CASE 1: Seats to keep - Update section info if changed
    for (const seat of toKeep) {
      const newSeat = newSeats.find(ns => ns.seat_key === seat.seat_key);
      if (newSeat) {
        await conn.execute(
          `UPDATE seats SET
           seat_type = ?, price = ?, section = ?, seat_number = ?,
           layout_id = ?, updated_at = NOW()
           WHERE id = ?`,
          [newSeat.seat_type, newSeat.price, newSeat.section_code, newSeat.seat_number, id, seat.id]
        );
      }
    }

    // CASE 2: Seats to remove
    for (const seat of toRemove) {
      if (seat.status === 'SOLD' || seat.status === 'RESERVED') {
        // Mark as REMOVED but preserve data
        await conn.execute(
          `UPDATE seats SET status = 'REMOVED', updated_at = NOW() WHERE id = ?`,
          [seat.id]
        );
      } else {
        // Delete AVAILABLE/LOCKED seats
        await conn.execute('DELETE FROM seats WHERE id = ?', [seat.id]);
      }
    }

    // CASE 3: New seats to add
    for (const seat of toAdd) {
      const seatId = randomUUID();
      await conn.execute(
        `INSERT INTO seats
         (id, event_id, seat_number, \`row\`, col, section, section_code, seat_key, seat_type, price, status, layout_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?)`,
        [
          seatId, layout.event_id, seat.seat_number, seat.row, seat.col,
          seat.section_code, seat.section_code, seat.seat_key,
          seat.seat_type, seat.price, id
        ]
      );
    }

    // 8. Archive current PUBLIC layout (if exists)
    await conn.execute(
      `UPDATE layouts SET status = 'ARCHIVED', updated_at = NOW()
       WHERE event_id = ? AND status = 'PUBLIC' AND id != ?`,
      [layout.event_id, id]
    );

    // 9. Get next version number
    const [versionRows] = await conn.execute<any[]>(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM layouts WHERE event_id = ?',
      [layout.event_id]
    );
    const nextVersion = versionRows[0]?.next_version || 1;

    // 10. Update layout status to PUBLIC with new version
    await conn.execute(
      `UPDATE layouts SET status = 'PUBLIC', version = ?, updated_at = NOW() WHERE id = ?`,
      [nextVersion, id]
    );

    // 11. Update event available_seats (only count non-REMOVED, non-SOLD seats)
    const [availableRows] = await conn.execute<any[]>(
      `SELECT COUNT(*) as count FROM seats WHERE event_id = ? AND status = 'AVAILABLE'`,
      [layout.event_id]
    );
    const availableSeats = availableRows[0]?.count || 0;

    const [totalRows] = await conn.execute<any[]>(
      `SELECT COUNT(*) as count FROM seats WHERE event_id = ? AND status != 'REMOVED'`,
      [layout.event_id]
    );
    const totalSeats = totalRows[0]?.count || 0;

    await conn.execute(
      `UPDATE events SET available_seats = ?, max_capacity = ?, updated_at = NOW() WHERE id = ?`,
      [availableSeats, totalSeats, layout.event_id]
    );

    await conn.commit();

    return NextResponse.json({
      success: true,
      message: `Layout v${nextVersion} published successfully!`,
      data: {
        version: nextVersion,
        totalSeats,
        availableSeats,
        sectionsCount: sections.length,
        seatsKept: toKeep.length,
        seatsRemoved: toRemove.length,
        seatsAdded: toAdd.length,
        bookedSeatsPreserved: bookedSeatsToRemove.length
      }
    });
  } catch (error: any) {
    await conn.rollback();
    console.error('Publish layout error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to publish layout' },
      { status: 500 }
    );
  } finally {
    conn.release();
  }
}

