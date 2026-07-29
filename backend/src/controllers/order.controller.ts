import {FastifyRequest, FastifyReply} from 'fastify'
import * as orderService from '../services/order.service.js'
import {successResponse} from '../utils/helpers.js'
import {BadRequestError} from '../utils/errors.js'

// POST /orders/create-pending
export async function createPendingOrder(
  request: FastifyRequest<{
    Body: {eventId: string; seatIds: string[]; sessionId: string; promoCode?: string}
  }>,
  reply: FastifyReply
) {
  const {eventId, seatIds, sessionId, promoCode} = request.body

  if (!eventId || !seatIds?.length || !sessionId) {
    throw new BadRequestError('Missing required fields')
  }

  const result = await orderService.createPendingOrder({eventId, seatIds, sessionId, promoCode})

  return reply.send(successResponse(result))
}

// POST /orders/create-pending-by-type
// Ticket-class-only booking: user selects ticket type + quantity,
// backend auto-assigns available seats. No seat map needed.
export async function createPendingOrderByType(
  request: FastifyRequest<{
    Body: {
      eventId: string
      ticketTypeId: string
      quantity: number
      sessionId: string
      promoCode?: string
    }
  }>,
  reply: FastifyReply
) {
  const {eventId, ticketTypeId, quantity, sessionId, promoCode} = request.body

  if (!eventId || !ticketTypeId || !sessionId || !quantity) {
    throw new BadRequestError('Missing required fields: eventId, ticketTypeId, quantity, sessionId')
  }

  const result = await orderService.createPendingOrderByTicketType({
    eventId,
    ticketTypeId,
    quantity,
    sessionId,
    promoCode,
  })

  return reply.send(successResponse(result))
}

// POST /orders/confirm-payment
export async function confirmPayment(
  request: FastifyRequest<{
    Body: {
      orderNumber: string
      accessToken: string
      customerName: string
      customerEmail: string
      customerPhone: string
    }
  }>,
  reply: FastifyReply
) {
  const {orderNumber, accessToken, customerName, customerEmail, customerPhone} = request.body

  if (!orderNumber || !accessToken || !customerName || !customerEmail || !customerPhone) {
    throw new BadRequestError('Missing required fields')
  }

  const result = await orderService.confirmPayment({
    orderNumber,
    accessToken,
    customerName,
    customerEmail,
    customerPhone,
  })

  return reply.send(
    successResponse({
      orderNumber: result.orderNumber,
      status: result.status,
      message: 'Đang chờ admin xác nhận thanh toán',
    })
  )
}

// GET /orders/:orderNumber
export async function getOrderByNumber(
  request: FastifyRequest<{
    Params: {orderNumber: string}
    Querystring: {token: string}
  }>,
  reply: FastifyReply
) {
  const {orderNumber} = request.params
  const {token} = request.query

  if (!orderNumber || !token) {
    throw new BadRequestError('Missing order number or token')
  }

  const order = await orderService.getOrderByNumber(orderNumber, token)

  return reply.send(successResponse(order))
}

// GET /orders/check-pending - Check if session has pending order
export async function checkPendingOrder(
  request: FastifyRequest<{
    Querystring: {eventId: string; sessionId: string}
  }>,
  reply: FastifyReply
) {
  const {eventId, sessionId} = request.query

  if (!eventId || !sessionId) {
    throw new BadRequestError('Missing eventId or sessionId')
  }

  const order = await orderService.checkPendingOrderBySession(eventId, sessionId)

  return reply.send(successResponse(order))
}

// POST /orders/:orderNumber/cancel - Cancel pending order
export async function cancelPendingOrder(
  request: FastifyRequest<{
    Params: {orderNumber: string}
    Querystring: {token: string}
  }>,
  reply: FastifyReply
) {
  const {orderNumber} = request.params
  const {token} = request.query

  if (!orderNumber || !token) {
    throw new BadRequestError('Missing orderNumber or token')
  }

  const result = await orderService.cancelPendingOrder(orderNumber, token)

  return reply.send(successResponse(result))
}
