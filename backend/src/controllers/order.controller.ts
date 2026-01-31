import { FastifyRequest, FastifyReply } from 'fastify';
import * as orderService from '../services/order.service.js';
import { successResponse } from '../utils/helpers.js';
import { BadRequestError } from '../utils/errors.js';

// POST /orders/create-pending
export async function createPendingOrder(
  request: FastifyRequest<{
    Body: { eventId: string; seatIds: string[]; sessionId: string };
  }>,
  reply: FastifyReply
) {
  const { eventId, seatIds, sessionId } = request.body;

  if (!eventId || !seatIds?.length || !sessionId) {
    throw new BadRequestError('Missing required fields');
  }

  const result = await orderService.createPendingOrder({ eventId, seatIds, sessionId });

  return reply.send(successResponse(result));
}

// POST /orders/confirm-payment
export async function confirmPayment(
  request: FastifyRequest<{
    Body: {
      orderNumber: string;
      accessToken: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
    };
  }>,
  reply: FastifyReply
) {
  const { orderNumber, accessToken, customerName, customerEmail, customerPhone } = request.body;

  if (!orderNumber || !accessToken || !customerName || !customerEmail || !customerPhone) {
    throw new BadRequestError('Missing required fields');
  }

  const result = await orderService.confirmPayment({
    orderNumber,
    accessToken,
    customerName,
    customerEmail,
    customerPhone,
  });

  return reply.send(
    successResponse({
      orderNumber: result.orderNumber,
      status: result.status,
      message: 'Đang chờ admin xác nhận thanh toán',
    })
  );
}

