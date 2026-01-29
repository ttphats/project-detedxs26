import { NextRequest, NextResponse } from 'next/server';
import { query, execute, queryOne, getPool } from '@/lib/db';
import { randomUUID } from 'crypto';

interface LayoutVersion {
  id: string;
  event_id: string;
  version_name: string;
  layout_config: string;
  seats_data: string;
  status: 'DRAFT' | 'PUBLISHED';
  is_active: boolean;
}

interface SeatData {
  id?: string; // Optional - if exists, update; if not, create
  row: string;
  col: number;
  side: 'left' | 'right';
  type: 'VIP' | 'STANDARD' | 'ECONOMY' | 'DISABLED';
  seat_number: string;
}

// POST /api/admin/layout-versions/[id]/publish - Publish version and sync to seats
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = getPool();
  const connection = await pool.getConnection();
  
  try {
    const { id } = await params;
    
    // Start transaction
    await connection.beginTransaction();

    // Get version
    const [versions] = await connection.execute(
      'SELECT * FROM seat_layout_versions WHERE id = ?',
      [id]
    );
    const version = (versions as any[])[0] as LayoutVersion;

    if (!version) {
      await connection.rollback();
      return NextResponse.json(
        { success: false, error: 'Version not found' },
        { status: 404 }
      );
    }

    const eventId = version.event_id;
    const seatsData: SeatData[] = typeof version.seats_data === 'string' 
      ? JSON.parse(version.seats_data) 
      : version.seats_data;

    // Get ticket types for price mapping
    const [ticketTypesResult] = await connection.execute(
      'SELECT name, price FROM ticket_types WHERE event_id = ?',
      [eventId]
    );
    const ticketTypes = ticketTypesResult as { name: string; price: number }[];
    const priceMap: Record<string, number> = {};
    ticketTypes.forEach(tt => {
      priceMap[tt.name.toUpperCase()] = Number(tt.price);
    });

    // 1. Deactivate current active version for this event
    await connection.execute(
      'UPDATE seat_layout_versions SET is_active = FALSE WHERE event_id = ? AND is_active = TRUE',
      [eventId]
    );

    // 2. Mark this version as published and active
    await connection.execute(
      `UPDATE seat_layout_versions 
       SET status = 'PUBLISHED', is_active = TRUE, published_at = NOW(), updated_at = NOW() 
       WHERE id = ?`,
      [id]
    );

    // 3. Get current seats (to preserve SOLD status)
    const [currentSeatsResult] = await connection.execute(
      'SELECT id, seat_number, status FROM seats WHERE event_id = ?',
      [eventId]
    );
    const currentSeats = currentSeatsResult as { id: string; seat_number: string; status: string }[];
    const soldSeats = new Map<string, string>(); // seat_number -> id
    currentSeats.forEach(s => {
      if (s.status === 'SOLD') {
        soldSeats.set(s.seat_number, s.id);
      }
    });

    // 4. Delete non-sold seats
    await connection.execute(
      "DELETE FROM seats WHERE event_id = ? AND status != 'SOLD'",
      [eventId]
    );

    // 5. Insert/update seats from layout
    let createdCount = 0;
    let skippedCount = 0;

    for (const seat of seatsData) {
      if (seat.type === 'DISABLED') continue; // Skip disabled seats

      const seatNumber = seat.seat_number || `${seat.row}${seat.col}`;
      const seatType = seat.type;
      const price = priceMap[seatType] || 0;
      const section = seat.side === 'left' ? 'LEFT' : 'RIGHT';

      // Check if this seat was sold
      if (soldSeats.has(seatNumber)) {
        skippedCount++;
        continue; // Keep sold seat, don't overwrite
      }

      const seatId = randomUUID();
      await connection.execute(
        `INSERT INTO seats (id, event_id, seat_number, row, col, section, seat_type, price, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', NOW(), NOW())`,
        [seatId, eventId, seatNumber, seat.row, seat.col, section, seatType, price]
      );
      createdCount++;
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: `Đã publish và đồng bộ ${createdCount} ghế. ${skippedCount} ghế đã bán được giữ nguyên.`,
      data: {
        created: createdCount,
        skipped: skippedCount,
        total: seatsData.filter(s => s.type !== 'DISABLED').length
      }
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Publish layout version error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to publish layout version' },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}

