import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';

// Controllers
import * as dashboardController from '../controllers/admin/dashboard.controller.js';
import * as ordersController from '../controllers/admin/orders.controller.js';
import * as speakersController from '../controllers/admin/speakers.controller.js';
import * as emailTemplatesController from '../controllers/admin/email-templates.controller.js';
import * as usersController from '../controllers/admin/users.controller.js';
import * as eventsController from '../controllers/admin/events.controller.js';
import * as seatsController from '../controllers/admin/seats.controller.js';
import * as auditLogsController from '../controllers/admin/audit-logs.controller.js';
import * as uploadController from '../controllers/admin/upload.controller.js';
import * as layoutsController from '../controllers/admin/layouts.controller.js';
import * as layoutVersionsController from '../controllers/admin/layout-versions.controller.js';
import * as seatLocksController from '../controllers/admin/seat-locks.controller.js';
import * as ticketTypesController from '../controllers/admin/ticket-types.controller.js';
import * as timelinesController from '../controllers/admin/timelines.controller.js';

export async function registerAdminRoutes(fastify: FastifyInstance) {
  // All admin routes require authentication
  const preHandler = requireAuth;

  // Dashboard
  fastify.get('/admin/dashboard/stats', { preHandler }, dashboardController.getStats);

  // Orders
  fastify.get('/admin/orders', { preHandler }, ordersController.list);
  fastify.get('/admin/orders/:id', { preHandler }, ordersController.getById);
  fastify.post('/admin/orders/:id/confirm', { preHandler }, ordersController.confirmPayment);
  fastify.post('/admin/orders/:id/reject', { preHandler }, ordersController.rejectPayment);
  fastify.post('/admin/orders/:id/resend-email', { preHandler }, ordersController.resendEmail);

  // Speakers
  fastify.get('/admin/speakers', { preHandler }, speakersController.list);
  fastify.get('/admin/speakers/:id', { preHandler }, speakersController.getById);
  fastify.post('/admin/speakers', { preHandler }, speakersController.create);
  fastify.put('/admin/speakers/:id', { preHandler }, speakersController.update);
  fastify.delete('/admin/speakers/:id', { preHandler }, speakersController.remove);

  // Email Templates
  fastify.get('/admin/email-templates', { preHandler }, emailTemplatesController.list);
  fastify.get('/admin/email-templates/:id', { preHandler }, emailTemplatesController.getById);
  fastify.post('/admin/email-templates', { preHandler }, emailTemplatesController.create);
  fastify.put('/admin/email-templates/:id', { preHandler }, emailTemplatesController.update);
  fastify.delete('/admin/email-templates/:id', { preHandler }, emailTemplatesController.remove);
  fastify.post('/admin/email-templates/:id/set-default', { preHandler }, emailTemplatesController.setDefault);
  fastify.post('/admin/email-templates/:id/activate', { preHandler }, emailTemplatesController.activate);
  fastify.post('/admin/email-templates/:id/preview', { preHandler }, emailTemplatesController.preview);

  // Users
  fastify.get('/admin/users', { preHandler }, usersController.list);
  fastify.get('/admin/users/:id', { preHandler }, usersController.getById);
  fastify.post('/admin/users', { preHandler }, usersController.create);
  fastify.put('/admin/users/:id', { preHandler }, usersController.update);
  fastify.delete('/admin/users/:id', { preHandler }, usersController.remove);

  // Events (Admin CRUD)
  fastify.get('/admin/events', { preHandler }, eventsController.list);
  fastify.get('/admin/events/:id', { preHandler }, eventsController.getById);
  fastify.post('/admin/events', { preHandler }, eventsController.create);
  fastify.put('/admin/events/:id', { preHandler }, eventsController.update);
  fastify.delete('/admin/events/:id', { preHandler }, eventsController.remove);

  // Seats (Admin CRUD)
  fastify.get('/admin/seats', { preHandler }, seatsController.list);
  fastify.get('/admin/seats/:id', { preHandler }, seatsController.getById);
  fastify.post('/admin/seats', { preHandler }, seatsController.create);
  fastify.put('/admin/seats/:id', { preHandler }, seatsController.update);
  fastify.put('/admin/seats', { preHandler }, seatsController.bulkUpdate);
  fastify.delete('/admin/seats', { preHandler }, seatsController.remove);

  // Layouts
  fastify.get('/admin/layouts', { preHandler }, layoutsController.list);
  fastify.post('/admin/layouts', { preHandler }, layoutsController.create);
  fastify.put('/admin/layouts', { preHandler }, layoutsController.update);
  fastify.delete('/admin/layouts', { preHandler }, layoutsController.remove);

  // Layout Versions
  fastify.get('/admin/layout-versions', { preHandler }, layoutVersionsController.list);
  fastify.post('/admin/layout-versions', { preHandler }, layoutVersionsController.create);
  fastify.delete('/admin/layout-versions', { preHandler }, layoutVersionsController.remove);

  // Seat Locks (Admin)
  fastify.get('/admin/seat-locks', { preHandler }, seatLocksController.list);

  // Ticket Types
  fastify.get('/admin/ticket-types', { preHandler }, ticketTypesController.list);
  fastify.post('/admin/ticket-types', { preHandler }, ticketTypesController.create);
  fastify.put('/admin/ticket-types', { preHandler }, ticketTypesController.bulkAssign);
  fastify.delete('/admin/ticket-types', { preHandler }, ticketTypesController.remove);

  // Timelines
  fastify.get('/admin/timelines', { preHandler }, timelinesController.list);
  fastify.post('/admin/timelines', { preHandler }, timelinesController.create);
  fastify.put('/admin/timelines/:id', { preHandler }, timelinesController.update);
  fastify.delete('/admin/timelines/:id', { preHandler }, timelinesController.remove);

  // Audit Logs
  fastify.get('/admin/audit-logs', { preHandler }, auditLogsController.list);

  // Upload (requires multipart support)
  fastify.post('/admin/upload', { preHandler }, uploadController.uploadImage);
  fastify.delete('/admin/upload', { preHandler }, uploadController.deleteImage);
}

