import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { lockSeat, getSeatLock } from '@/lib/redis';
import { getAuthUser } from '@/lib/auth';
import { successResponse, errorResponse, UnauthorizedError, ConflictError, NotFoundError } from '@/lib/utils';

const lockSeatsSchema = z.object({
  eventId: z.string().uuid(),
  seatIds: z.array(z.string().uuid()).min(1).max(10), // Max 10 seats per transaction
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const user = await getAuthUser(authHeader);

    if (!user) {
      throw new UnauthorizedError();
    }

    // Parse and validate input
    const body = await request.json();
    const input = lockSeatsSchema.parse(body);

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
    });

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (event.status !== 'PUBLISHED') {
      throw new ConflictError('Event is not available for booking');
    }

    // Get seats from database
    const seats = await prisma.seat.findMany({
      where: {
        id: { in: input.seatIds },
        eventId: input.eventId,
      },
    });

    if (seats.length !== input.seatIds.length) {
      throw new NotFoundError('One or more seats not found');
    }

    // Check if any seat is disabled or already sold
    const unavailableSeats = seats.filter(
      (seat) => seat.isDisabled || seat.status === 'SOLD'
    );

    if (unavailableSeats.length > 0) {
      throw new ConflictError(
        `Seats ${unavailableSeats.map((s) => s.seatNumber).join(', ')} are not available`
      );
    }

    // Attempt to lock seats in Redis (atomic operation)
    const lockResults = await Promise.all(
      seats.map(async (seat) => {
        // Check if seat is already locked
        const existingLock = await getSeatLock(input.eventId, seat.id);

        if (existingLock) {
          // If locked by same user, allow (extend lock)
          if (existingLock === user.userId) {
            return { seatId: seat.id, locked: true, extended: true };
          }
          return { seatId: seat.id, locked: false, reason: 'Already locked by another user' };
        }

        // Try to acquire lock
        const locked = await lockSeat(input.eventId, seat.id, user.userId);

        return { seatId: seat.id, locked, extended: false };
      })
    );

    // Check if all seats were locked successfully
    const failedLocks = lockResults.filter((r) => !r.locked);

    if (failedLocks.length > 0) {
      // Release any successfully locked seats
      const successfulLocks = lockResults.filter((r) => r.locked && !r.extended);
      await Promise.all(
        successfulLocks.map((r) => {
          const seat = seats.find((s) => s.id === r.seatId);
          return prisma.seat.update({
            where: { id: r.seatId },
            data: { status: 'AVAILABLE' },
          });
        })
      );

      throw new ConflictError(
        `Failed to lock seats: ${failedLocks.map((f) => {
          const seat = seats.find((s) => s.id === f.seatId);
          return seat?.seatNumber;
        }).join(', ')}`
      );
    }

    // Update seat status in database to LOCKED
    await prisma.$transaction(
      seats.map((seat) =>
        prisma.seat.update({
          where: { id: seat.id },
          data: { status: 'LOCKED' },
        })
      )
    );

    return NextResponse.json(
      successResponse(
        {
          lockedSeats: seats.map((seat) => ({
            id: seat.id,
            seatNumber: seat.seatNumber,
            price: seat.price,
          })),
          expiresIn: 300, // 5 minutes
        },
        'Seats locked successfully'
      )
    );
  } catch (error: any) {
    console.error('Lock seats error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponse(error.errors[0].message),
        { status: 400 }
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 401 }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 404 }
      );
    }

    if (error instanceof ConflictError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 409 }
      );
    }

    return NextResponse.json(
      errorResponse('Internal server error'),
      { status: 500 }
    );
  }
}

