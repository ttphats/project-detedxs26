import { FastifyInstance } from 'fastify';
import * as eventController from '../controllers/event.controller.js';
import * as orderController from '../controllers/order.controller.js';
import * as cronController from '../controllers/cron.controller.js';
import * as ticketController from '../controllers/ticket.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import * as partnersController from '../controllers/admin/partners.controller.js';
import * as speakerRegisterController from '../controllers/admin/speaker-register.controller.js';

export async function publicRoutes(fastify: FastifyInstance): Promise<void> {
  // =====================================
  // PARTNER ROUTES
  // =====================================
  fastify.get('/partners', partnersController.listPublic);

  // =====================================
  // SPEAKER REGISTRATION ROUTES (PUBLIC)
  // =====================================
  fastify.get('/speakers/register/config', speakerRegisterController.getPublicConfig);
  fastify.get('/speakers/register/fields', speakerRegisterController.getPublicFields);
  fastify.post('/speakers/register', speakerRegisterController.submitRegistration);

  // =====================================
  // EVENT ROUTES
  // =====================================

  // GET /events - List published events
  fastify.get('/events', eventController.getEvents)

  // GET /events/:eventId - Get event by ID
  fastify.get('/events/:eventId', eventController.getEventById)

  // GET /events/slug/:slug - Get event by slug
  fastify.get('/events/slug/:slug', eventController.getEventBySlug)

  // GET /events/:eventId/speakers - Get speakers for an event
  fastify.get('/events/:eventId/speakers', eventController.getEventSpeakers)

  // GET /events/:eventId/timeline - Get timeline for an event
  fastify.get('/events/:eventId/timeline', eventController.getEventTimeline)

  // GET /events/:eventId/tickets - Ticket-class page: event meta + ticket types, no seatMap
  fastify.get('/events/:eventId/tickets', eventController.getEventTickets)

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

  // POST /orders/create-pending-by-type - Create pending order by ticket type + quantity
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

  // GET /ticket/:orderNumber/pdf - Generate PDF ticket
  const ticketPdfController = await import('../controllers/ticket-pdf.controller.js')
  fastify.get('/ticket/:orderNumber/pdf', ticketPdfController.generateTicketPDF)

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

}
