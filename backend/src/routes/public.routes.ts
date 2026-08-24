import {FastifyInstance} from 'fastify'
import * as eventController from '../controllers/event.controller.js'
import * as seatController from '../controllers/seat.controller.js'
import * as orderController from '../controllers/order.controller.js'
import * as cronController from '../controllers/cron.controller.js'
import * as seatLockController from '../controllers/seat-lock.controller.js'
import * as ticketController from '../controllers/ticket.controller.js'
import * as paymentController from '../controllers/payment.controller.js'
import * as partnersController from '../controllers/admin/partners.controller.js'
import * as speakerRegisterController from '../controllers/admin/speaker-register.controller.js'
import * as settingsController from '../controllers/admin/settings.controller.js'

export async function publicRoutes(fastify: FastifyInstance): Promise<void> {
  // =====================================
  // PARTNER ROUTES
  // =====================================
  fastify.get('/partners', partnersController.listPublic)

  // =====================================
  // SPEAKER REGISTRATION ROUTES (PUBLIC)
  // =====================================
  fastify.get('/speakers/register/config', speakerRegisterController.getPublicConfig)
  fastify.get('/speakers/register/fields', speakerRegisterController.getPublicFields)
  fastify.post('/speakers/register', speakerRegisterController.submitRegistration)

  // =====================================
  // TICKET SALES GATE (PUBLIC)
  // =====================================
  fastify.get('/ticket-sales', settingsController.getTicketSales)

  // =====================================
  // EVENT ROUTES
  // =====================================

  // GET /events - List published events
  fastify.get('/events', eventController.getEvents)

  // GET /events/:eventId - Get event by ID
  fastify.get('/events/:eventId', eventController.getEventById)

  // GET /events/slug/:slug - Get event by slug
  fastify.get('/events/slug/:slug', eventController.getEventBySlug)

  // GET /events/:eventId/seats - Get seats for an event
  fastify.get('/events/:eventId/seats', seatController.getEventSeats)

  // GET /events/:eventId/seats/stream - SSE stream for real-time seat updates
  fastify.get('/events/:eventId/seats/stream', seatController.seatsStream)

  // GET /events/:eventId/speakers - Get speakers for an event
  fastify.get('/events/:eventId/speakers', eventController.getEventSpeakers)

  // GET /events/:eventId/timeline
  fastify.get('/events/:eventId/timeline', eventController.getEventTimeline)

  // GET /events/:eventId/ticket-availability - Available seats per ticket type (ticket-class flow)
  fastify.get('/events/:eventId/ticket-availability', eventController.getTicketAvailability)

  // GET /events/:eventId/tickets - Ticket-class page payload (NO seatMap)
  // Event meta + ticket types (imageUrl) + availability baked in
  fastify.get('/events/:eventId/tickets', eventController.getEventTickets)

  // =====================================
  // SEAT ROUTES
  // =====================================

  // GET /seats/lock - Get session locks
  fastify.get('/seats/lock', seatController.getSessionLocks)

  // POST /seats/lock - Lock seats
  fastify.post('/seats/lock', seatController.lockSeats)

  // DELETE /seats/lock - Unlock seats
  fastify.delete('/seats/lock', seatController.unlockSeats)

  // POST /seats/unlock - Unlock seats (for sendBeacon which only supports POST)
  fastify.post('/seats/unlock', seatController.unlockSeats)

  // POST /seats/extend-lock - Extend lock duration for checkout
  fastify.post('/seats/extend-lock', seatLockController.extendLock)

  // =====================================
  // ORDER ROUTES
  // =====================================

  // =====================================
  // PROMOTIONS ROUTES
  // =====================================
  const promotionsController = await import('../controllers/promotions.controller.js')
  fastify.post('/promotions/check', promotionsController.checkPromotions)
  fastify.post('/promotions/validate-code', promotionsController.validatePromoCode)
  fastify.post('/promotions/eligible', promotionsController.listEligiblePromotions)

  // GET /orders/check-pending - Check if session has pending order (must be before /:orderNumber)
  fastify.get('/orders/check-pending', orderController.checkPendingOrder)

  // POST /orders/create-pending - Create pending order
  fastify.post('/orders/create-pending', orderController.createPendingOrder)

  // POST /orders/create-pending-by-type - Create pending order by ticket type + quantity (no seat selection)
  fastify.post('/orders/create-pending-by-type', orderController.createPendingOrderByType)

  // POST /orders/confirm-payment - Confirm payment
  fastify.post('/orders/confirm-payment', orderController.confirmPayment)

  // POST /orders/:orderNumber/cancel - Cancel pending order
  fastify.post('/orders/:orderNumber/cancel', orderController.cancelPendingOrder)

  // GET /orders/:orderNumber - Get order by number
  fastify.get('/orders/:orderNumber', orderController.getOrderByNumber)

  // =====================================
  // TICKET ROUTES
  // =====================================

  // GET /ticket/:orderNumber - Public ticket viewing with token
  fastify.get('/ticket/:orderNumber', ticketController.getTicket)

  // =====================================
  // PAYMENT ROUTES
  // =====================================

  // POST /payments/webhook - Payment webhook handler
  fastify.post('/payments/webhook', paymentController.handleWebhook)

  // =====================================
  // CRON ROUTES
  // =====================================

  // GET /cron/expire-orders - Expire pending orders (cron job)
  fastify.get('/cron/expire-orders', cronController.expireOrders)

  // GET /cron/cleanup-locks - Cleanup expired locks (cron job)
  fastify.get('/cron/cleanup-locks', cronController.cleanupLocks)

  // =====================================
  // DEBUG ROUTES
  // =====================================

  // GET /debug/seat-locks - Debug endpoint for seat locks
  fastify.get('/debug/seat-locks', seatLockController.getDebugInfo)

  // POST /debug/seat-locks - Create seat_locks table
  fastify.post('/debug/seat-locks', seatLockController.createTable)

  // DELETE /debug/seat-locks - Clear expired locks
  fastify.delete('/debug/seat-locks', seatLockController.clearExpired)
}
