import { FastifyRequest, FastifyReply } from 'fastify';
import * as ticketService from '../services/ticket.service.js';

/**
 * GET /api/ticket/:orderNumber
 * Public ticket viewing with token-based access
 */
export async function getTicket(
  request: FastifyRequest<{ Params: { orderNumber: string }; Querystring: { token?: string } }>,
  reply: FastifyReply
) {
  try {
    const { orderNumber } = request.params;
    const token = request.query.token;

    // Require token
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'Access token required',
      });
    }

    // Rate limiting
    const headers: Record<string, string | string[] | undefined> = {};
    request.headers['x-forwarded-for'] && (headers['x-forwarded-for'] = request.headers['x-forwarded-for']);
    request.headers['x-real-ip'] && (headers['x-real-ip'] = request.headers['x-real-ip'] as string);
    
    const clientIp = ticketService.getClientIp(headers);
    if (!ticketService.checkRateLimit(clientIp)) {
      return reply.status(429).send({
        success: false,
        error: 'Too many requests. Please try again later.',
      });
    }

    const result = await ticketService.getTicketByOrderNumber(orderNumber, token);

    if (result.error) {
      return reply.status(result.status || 500).send({
        success: false,
        error: result.error,
      });
    }

    return reply.send({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Ticket view error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to load ticket',
    });
  }
}

