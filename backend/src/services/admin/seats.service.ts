import { prisma } from '../../db/prisma.js';
import { randomUUID } from 'crypto';

export interface ListSeatsInput {
  eventId?: string;
  status?: string;
  seatType?: string;
  row?: string;
}

export interface CreateSeatInput {
  seat_number?: string;
  row: string;
  col: string;
  section?: string;
  seat_type?: string;
  price?: number;
  position_x?: number;
  position_y?: number;
}

export interface UpdateSeatInput {
  status?: string;
  price?: number;
  seat_type?: string;
}

/**
 * List seats with filters
 */
export async function listSeats(input: ListSeatsInput) {
  const where: any = {};

  if (input.eventId) where.eventId = input.eventId;
  if (input.status) where.status = input.status;
  if (input.seatType) where.seatType = input.seatType;
  if (input.row) where.row = input.row;

  const seats = await prisma.seat.findMany({
    where,
    include: {
      event: { select: { id: true, name: true } },
    },
    orderBy: [{ row: 'asc' }, { col: 'asc' }],
  });

  // Get events for filter dropdown
  const events = await prisma.event.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate stats
  const stats = {
    total: seats.length,
    available: seats.filter((s) => s.status === 'AVAILABLE').length,
    reserved: seats.filter((s) => s.status === 'RESERVED').length,
    sold: seats.filter((s) => s.status === 'SOLD').length,
    locked: seats.filter((s) => s.status === 'LOCKED').length,
  };

  return { seats, events, stats };
}

/**
 * Get seat by ID
 */
export async function getSeatById(id: string) {
  return prisma.seat.findUnique({
    where: { id },
    include: {
      event: { select: { id: true, name: true } },
    },
  });
}

/**
 * Create seats for event
 */
export async function createSeats(eventId: string, seats: CreateSeatInput[]) {
  const createdSeats = [];

  for (const seat of seats) {
    const id = randomUUID();
    const created = await prisma.seat.create({
      data: {
        id,
        eventId,
        seatNumber: seat.seat_number || `${seat.row}${seat.col}`,
        row: seat.row,
        col: seat.col,
        section: seat.section || 'MAIN',
        seatType: seat.seat_type || 'STANDARD',
        price: seat.price || 0,
        status: 'AVAILABLE',
        positionX: seat.position_x,
        positionY: seat.position_y,
      },
    });
    createdSeats.push(created);
  }

  return createdSeats;
}

/**
 * Update single seat
 */
export async function updateSeat(id: string, input: UpdateSeatInput) {
  const data: any = {};

  if (input.status !== undefined) data.status = input.status;
  if (input.price !== undefined) data.price = input.price;
  if (input.seat_type !== undefined) data.seatType = input.seat_type;

  return prisma.seat.update({ where: { id }, data });
}

/**
 * Bulk update seats
 */
export async function bulkUpdateSeats(seatIds: string[], input: UpdateSeatInput) {
  const data: any = {};

  if (input.status !== undefined) data.status = input.status;
  if (input.price !== undefined) data.price = input.price;

  await prisma.seat.updateMany({
    where: { id: { in: seatIds } },
    data,
  });

  return { updated: seatIds.length };
}

/**
 * Delete seats (only if not SOLD)
 */
export async function deleteSeats(seatIds: string[]) {
  // Check for sold seats
  const soldSeats = await prisma.seat.count({
    where: { id: { in: seatIds }, status: 'SOLD' },
  });

  if (soldSeats > 0) {
    throw new Error('Cannot delete sold seats');
  }

  await prisma.seat.deleteMany({
    where: { id: { in: seatIds } },
  });

  return { deleted: seatIds.length };
}

