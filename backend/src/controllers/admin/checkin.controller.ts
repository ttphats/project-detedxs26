import {FastifyRequest, FastifyReply} from 'fastify'
import {z} from 'zod'
import * as checkinService from '../../services/admin/checkin.service.js'
import {UnauthorizedError, ForbiddenError, BadRequestError} from '../../utils/errors.js'
import {requireAdmin} from '../../utils/auth.js'

// Accept ticket unit code (TKT-xxx) OR legacy orderNumber
const checkInSchema = z.object({
  // Preferred: unique per-ticket code
  ticketCode: z.string().min(1).optional(),
  // Alias used by some scanners / UI fields
  code: z.string().min(1).optional(),
  // Legacy order-level check-in
  orderNumber: z.string().min(1).optional(),
}).refine((b) => !!(b.ticketCode || b.code || b.orderNumber), {
  message: 'ticketCode or orderNumber is required',
})

const checkInStatusSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required'),
})

const statsSchema = z.object({
  eventId: z.string().min(1, 'Invalid event ID'),
})

/**
 * POST /api/admin/check-in
 * Body: { ticketCode: "TKT-..." } preferred
 *    or { orderNumber: "TKH..." } legacy (checks in ALL remaining units)
 */
export async function checkIn(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user
  if (!user) throw new UnauthorizedError()

  // Verify user is admin/staff (throws if not)
  try {
    requireAdmin(user)
  } catch {
    throw new ForbiddenError('Only admin and staff can perform check-in')
  }

  const body = checkInSchema.parse(request.body)
  const scanValue = body.ticketCode || body.code || body.orderNumber || ''

  // Who scanned, from where — recorded against every scan, successful or not.
  const result = await checkinService.checkIn(scanValue, {
    userId: user.userId,
    roleName: user.roleName,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  })

  return reply.send({
    success: true,
    data: result.order,
    message: result.message,
    mode: (result as {mode?: string}).mode,
  })
}

/**
 * GET /api/admin/check-in/status/:orderNumber
 * Get check-in status for an order
 */
export async function getStatus(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user
  if (!user) throw new UnauthorizedError()
  try {
    requireAdmin(user)
  } catch {
    throw new ForbiddenError()
  }

  const params = checkInStatusSchema.parse(request.params)

  const status = await checkinService.getCheckInStatus(params.orderNumber)

  return reply.send({
    success: true,
    data: status,
  })
}

/**
 * GET /api/admin/check-in/stats/:eventId
 * Get check-in statistics for an event
 */
export async function getStats(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user
  if (!user) throw new UnauthorizedError()
  try {
    requireAdmin(user)
  } catch {
    throw new ForbiddenError()
  }

  const params = statsSchema.parse(request.params)

  const stats = await checkinService.getCheckInStats(params.eventId)

  return reply.send({
    success: true,
    data: stats,
  })
}

/**
 * GET /api/admin/check-in/list/:eventId
 * Get all checked-in orders for an event
 */
export async function getCheckedInList(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user
  if (!user) throw new UnauthorizedError()
  try {
    requireAdmin(user)
  } catch {
    throw new ForbiddenError()
  }

  const {eventId} = request.params as {eventId: string}
  const {limit} = request.query as {limit?: string}

  // One row per admitted ticket. The previous order-level query required
  // orders.checked_in_at, which is only stamped once every ticket on the order
  // is in — so a group that had half arrived did not appear at all.
  const records = await checkinService.getCheckedInList(
    eventId,
    Math.min(Number(limit) || 500, 1000),
  )

  return reply.send({
    success: true,
    data: records,
  })
}
