import { FastifyInstance } from 'fastify';
import * as eventController from '../controllers/event.controller.js';
import * as seatController from '../controllers/seat.controller.js';
import * as orderController from '../controllers/order.controller.js';
import * as cronController from '../controllers/cron.controller.js';
import * as seatLockController from '../controllers/seat-lock.controller.js';
import * as ticketController from '../controllers/ticket.controller.js';
import * as paymentController from '../controllers/payment.controller.js';

export async function publicRoutes(fastify: FastifyInstance): Promise<void> {
  // =====================================
  // EVENT ROUTES
  // =====================================

  // GET /events - List published events
  fastify.get('/events', eventController.getEvents);

  // GET /events/:eventId - Get event by ID
  fastify.get('/events/:eventId', eventController.getEventById);

  // GET /events/slug/:slug - Get event by slug
  fastify.get('/events/slug/:slug', eventController.getEventBySlug);

  // GET /events/:eventId/seats - Get seats for an event
  fastify.get('/events/:eventId/seats', seatController.getEventSeats);

  // =====================================
  // SEAT ROUTES
  // =====================================

  // GET /seats/lock - Get session locks
  fastify.get('/seats/lock', seatController.getSessionLocks);

  // POST /seats/lock - Lock seats
  fastify.post('/seats/lock', seatController.lockSeats);

  // DELETE /seats/lock - Unlock seats
  fastify.delete('/seats/lock', seatController.unlockSeats);

  // POST /seats/extend-lock - Extend lock duration for checkout
  fastify.post('/seats/extend-lock', seatLockController.extendLock);

  // =====================================
  // ORDER ROUTES
  // =====================================

  // POST /orders/create-pending - Create pending order
  fastify.post('/orders/create-pending', orderController.createPendingOrder);

  // POST /orders/confirm-payment - Confirm payment
  fastify.post('/orders/confirm-payment', orderController.confirmPayment);

  // =====================================
  // TICKET ROUTES
  // =====================================

  // GET /ticket/:orderNumber - Public ticket viewing with token
  fastify.get('/ticket/:orderNumber', ticketController.getTicket);

  // =====================================
  // PAYMENT ROUTES
  // =====================================

  // POST /payments/webhook - Payment webhook handler
  fastify.post('/payments/webhook', paymentController.handleWebhook);

  // =====================================
  // CRON ROUTES
  // =====================================

  // GET /cron/expire-orders - Expire pending orders (cron job)
  fastify.get('/cron/expire-orders', cronController.expireOrders);

  // GET /cron/cleanup-locks - Cleanup expired locks (cron job)
  fastify.get('/cron/cleanup-locks', cronController.cleanupLocks);

  // =====================================
  // DEBUG ROUTES
  // =====================================

  // GET /debug/seat-locks - Debug endpoint for seat locks
  fastify.get('/debug/seat-locks', seatLockController.getDebugInfo);

  // POST /debug/seat-locks - Create seat_locks table
  fastify.post('/debug/seat-locks', seatLockController.createTable);

  // DELETE /debug/seat-locks - Clear expired locks
  fastify.delete('/debug/seat-locks', seatLockController.clearExpired);
}

