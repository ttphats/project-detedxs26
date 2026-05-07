import {FastifyInstance} from 'fastify';
import {query} from '../db/mysql.js';

export async function debugRoutes(fastify: FastifyInstance): Promise<void> {
  // Debug endpoint to check seat_type distribution
  fastify.get('/debug/seats/:eventId', async (request, reply) => {
    const {eventId} = request.params as {eventId: string};

    // Get seat types distribution
    const seatTypes = await query(
      `SELECT seat_type, COUNT(*) as count, MIN(price) as min_price, MAX(price) as max_price
       FROM seats
       WHERE event_id = ?
       GROUP BY seat_type
       ORDER BY min_price ASC`,
      [eventId]
    );

    // Get sample seats
    const samples = await query(
      `SELECT id, seat_number, row, seat_type, price, status
       FROM seats
       WHERE event_id = ?
       ORDER BY row, col
       LIMIT 20`,
      [eventId]
    );

    // Get ticket types
    const ticketTypes = await query(
      `SELECT id, name, level, price, color
       FROM ticket_types
       WHERE event_id = ? AND is_active = 1
       ORDER BY level ASC`,
      [eventId]
    );

    return reply.send({
      success: true,
      data: {
        seatTypes,
        samples,
        ticketTypes,
      },
    });
  });
}
