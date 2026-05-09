import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/prisma.js';
import { verifyAccessToken } from '../utils/helpers.js';

/**
 * GET /api/ticket/:orderNumber/pdf
 * Generate PDF ticket (proxy to web-client)
 */
export async function generateTicketPDF(
  request: FastifyRequest<{ Params: { orderNumber: string }; Querystring: { token?: string } }>,
  reply: FastifyReply
) {
  try {
    const { orderNumber } = request.params;
    const token = request.query.token;

    // Validate token
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'Access token required',
      });
    }

    // Find order with access token hash
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        accessTokenHash: true,
      },
    });

    if (!order) {
      return reply.status(404).send({
        success: false,
        error: 'Order not found',
      });
    }

    // Verify token
    if (!order.accessTokenHash || !verifyAccessToken(token, order.accessTokenHash)) {
      return reply.status(403).send({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Proxy to web-client PDF generation
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const pdfUrl = `${clientUrl}/api/ticket/${orderNumber}/pdf?token=${token}`;

    // Redirect to web-client PDF endpoint
    return reply.redirect(302, pdfUrl);
  } catch (error) {
    console.error('PDF generation error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to generate PDF',
    });
  }
}
