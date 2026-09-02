import {FastifyRequest, FastifyReply} from 'fastify'
import * as orderService from '../services/order.service.js'
import * as settingsService from '../services/settings.service.js'
import {successResponse} from '../utils/helpers.js'
import {BadRequestError} from '../utils/errors.js'
import {findMissingOrderInfo} from '../utils/order-completeness.js'

async function assertTicketSalesOpen() {
  // Local checkout stays usable even if an admin previewed the closed state.
  if (process.env.NODE_ENV !== 'production') return
  const {salesOpen} = await settingsService.getTicketSalesConfig()
  if (!salesOpen) {
    throw new BadRequestError('Ticket sales are not open yet.')
  }
}

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

  await assertTicketSalesOpen()

  const result = await orderService.createPendingOrder({eventId, seatIds, sessionId, promoCode})

  return reply.send(successResponse(result))
}

// POST /orders/create-pending-by-type
// Ticket-class booking: multi-type cart OR single type + quantity.
// Backend auto-assigns available seats. No seat map needed.
export async function createPendingOrderByType(
  request: FastifyRequest<{
    Body: {
      eventId: string
      sessionId: string
      promoCode?: string
      promotionId?: string
      // Multi-type cart (preferred)
      items?: Array<{ticketTypeId: string; quantity: number}>
      // Legacy single-type (backward compatible)
      ticketTypeId?: string
      quantity?: number
    }
  }>,
  reply: FastifyReply
) {
  const {eventId, sessionId, promoCode, promotionId, items, ticketTypeId, quantity} = request.body

  if (!eventId || !sessionId) {
    throw new BadRequestError('Missing required fields: eventId, sessionId')
  }

  // Normalize to items[] — multi-type cart or legacy single type
  let normalizedItems: Array<{ticketTypeId: string; quantity: number}> = []
  if (items && Array.isArray(items) && items.length > 0) {
    normalizedItems = items
      .filter((i) => i?.ticketTypeId && Number(i.quantity) > 0)
      .map((i) => ({ticketTypeId: i.ticketTypeId, quantity: Math.floor(Number(i.quantity))}))
  } else if (ticketTypeId && quantity) {
    normalizedItems = [{ticketTypeId, quantity: Math.floor(Number(quantity))}]
  }

  if (normalizedItems.length === 0) {
    throw new BadRequestError('Cart is empty. Provide items[] or ticketTypeId + quantity.')
  }

  await assertTicketSalesOpen()

  const result = await orderService.createPendingOrderByTicketType({
    eventId,
    sessionId,
    promoCode,
    promotionId,
    items: normalizedItems,
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
      attendees?: Array<{orderItemId?: string; name: string; email: string; phone: string}>
    }
  }>,
  reply: FastifyReply
) {
  const {orderNumber, accessToken, customerName, customerEmail, customerPhone, attendees} =
    request.body

  if (!orderNumber || !accessToken) {
    throw new BadRequestError('Missing required fields')
  }

  // An order with gaps is not a valid order. Enforced here as well as in the
  // browser because the client gate is only a courtesy — this endpoint is
  // reachable directly, and a half-filled order costs an organiser a manual
  // chase, or leaves a holder with no ticket email at all.
  const missing = findMissingOrderInfo(
    {name: customerName, email: customerEmail, phone: customerPhone},
    attendees ?? []
  )
  if (missing.length > 0) {
    throw new BadRequestError(`Order is incomplete: ${missing.join(', ')}`)
  }

  const result = await orderService.confirmPayment({
    orderNumber,
    accessToken,
    customerName,
    customerEmail,
    customerPhone,
    attendees,
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
