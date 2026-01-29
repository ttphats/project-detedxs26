import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSeatLock, unlockSeats } from '@/lib/redis';
import { successResponse, errorResponse, NotFoundError, ConflictError, BadRequestError } from '@/lib/utils';
import { generateOrderNumber, addMinutes } from '@/lib/utils';

const createOrderSchema = z.object({
  eventId: z.string().uuid(),
  seatIds: z.array(z.string().uuid()).min(1).max(10),
  customerName: z.string().min(2, 'Name must be at least 2 characters'),
  customerEmail: z.string().email('Invalid email format'),
  customerPhone: z.string().min(10, 'Phone number must be at least 10 digits'),
});

/**
 * POST /api/orders
 * 
 * User creates order (PENDING status)
 * Returns ORDER_CODE for bank transfer
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate input
    const body = await request.json();
    const input = createOrderSchema.parse(body);

    // Verify event exists and is published
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
    });

    if (!event) {
      throw new NotFoundError('Event not found');
    }

    if (event.status !== 'PUBLISHED') {
      throw new ConflictError('Event is not available for booking');
    }

    // Get seats
    const seats = await prisma.seat.findMany({
      where: {
        id: { in: input.seatIds },
        eventId: input.eventId,
      },
    });

    if (seats.length !== input.seatIds.length) {
      throw new NotFoundError('One or more seats not found');
    }

    // Check if seats are available
    const unavailableSeats = seats.filter(
      (seat) => seat.isDisabled || seat.status === 'SOLD'
    );

    if (unavailableSeats.length > 0) {
      throw new ConflictError(
        `Seats ${unavailableSeats.map((s) => s.seatNumber).join(', ')} are not available`
      );
    }

    // Verify seats are locked (optional - can skip if no Redis)
    // This prevents race conditions
    const lockedSeats = await Promise.all(
      seats.map(async (seat) => {
        const lock = await getSeatLock(input.eventId, seat.id);
        return { seat, lock };
      })
    );

    // Calculate total amount
    const totalAmount = seats.reduce((sum, seat) => sum + Number(seat.price), 0);

    // Generate order number (this will be the ORDER_CODE)
    const orderNumber = generateOrderNumber();

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          eventId: input.eventId,
          totalAmount,
          status: 'PENDING',
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          expiresAt: addMinutes(new Date(), 30), // 30 minutes to complete payment
        },
      });

      // Create order items
      await tx.orderItem.createMany({
        data: seats.map((seat) => ({
          orderId: newOrder.id,
          seatId: seat.id,
          price: seat.price,
          seatNumber: seat.seatNumber,
          seatType: seat.seatType,
        })),
      });

      // Create payment record (PENDING)
      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          paymentMethod: 'BANK_TRANSFER',
          amount: totalAmount,
          status: 'PENDING',
        },
      });

      // Mark seats as RESERVED (not SOLD yet)
      await tx.seat.updateMany({
        where: { id: { in: input.seatIds } },
        data: { status: 'RESERVED' },
      });

      return newOrder;
    });

    // Release Redis locks (seats are now RESERVED in DB)
    unlockSeats(input.eventId, input.seatIds).catch((err) => {
      console.error('Failed to release seat locks:', err);
    });

    // Return order details with bank transfer instructions
    return NextResponse.json(
      successResponse(
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalAmount: Number(order.totalAmount),
          status: order.status,
          expiresAt: order.expiresAt,
          seats: seats.map((seat) => ({
            seatNumber: seat.seatNumber,
            seatType: seat.seatType,
            price: Number(seat.price),
          })),
          bankTransferInfo: {
            bankName: 'Vietcombank',
            accountNumber: '1234567890',
            accountName: 'TEDxFPTUniversityHCMC',
            amount: Number(order.totalAmount),
            transferContent: order.orderNumber, // ORDER_CODE
            note: `Vui lòng chuyển khoản đúng số tiền và ghi rõ nội dung: ${order.orderNumber}`,
          },
        },
        'Order created successfully. Please complete bank transfer within 30 minutes.'
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create order error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponse(error.errors[0].message),
        { status: 400 }
      );
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 404 }
      );
    }

    if (error instanceof ConflictError || error instanceof BadRequestError) {
      return NextResponse.json(
        errorResponse(error.message),
        { status: 409 }
      );
    }

    return NextResponse.json(
      errorResponse('Failed to create order'),
      { status: 500 }
    );
  }
}

