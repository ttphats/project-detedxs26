import { FastifyRequest, FastifyReply } from 'fastify';
import * as ticketTypesService from '../../services/admin/ticket-types.service.js';
import { requireAdmin } from '../../utils/auth.js';

interface CreateTicketTypeBody {
  event_id: string;
  name: string;
  description?: string;
  subtitle?: string;
  benefits?: string[];
  price?: number;
  color?: string;
  icon?: string;
  max_quantity?: number;
  sort_order?: number;
}

/**
 * GET /api/admin/ticket-types
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { eventId } = request.query as { eventId?: string };

    const data = await ticketTypesService.listTicketTypes(eventId);

    return reply.send({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Get ticket types error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to fetch ticket types',
    });
  }
}

/**
 * POST /api/admin/ticket-types
 */
export async function create(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const body = request.body as CreateTicketTypeBody;

    if (!body.event_id || !body.name) {
      return reply.status(400).send({
        success: false,
        error: 'Event ID and name are required',
      });
    }

    const data = await ticketTypesService.createTicketType(body);

    return reply.status(201).send({
      success: true,
      data,
      message: 'Ticket type created successfully',
    });
  } catch (error: any) {
    console.error('Create ticket type error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to create ticket type',
    });
  }
}

/**
 * PUT /api/admin/ticket-types
 * Bulk update - assign ticket type to seats
 */
export async function bulkAssign(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { seatIds, ticket_type_id } = request.body as { seatIds: string[]; ticket_type_id: string | null };

    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Seat IDs are required',
      });
    }

    await ticketTypesService.assignTicketTypeToSeats(ticket_type_id, seatIds);

    return reply.send({
      success: true,
      message: `Assigned ticket type to ${seatIds.length} seats`,
    });
  } catch (error: any) {
    console.error('Assign ticket type error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to assign ticket type',
    });
  }
}

/**
 * DELETE /api/admin/ticket-types
 */
export async function remove(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { id } = request.query as { id: string };

    if (!id) {
      return reply.status(400).send({
        success: false,
        error: 'Ticket type ID is required',
      });
    }

    await ticketTypesService.deleteTicketType(id);

    return reply.send({
      success: true,
      message: 'Ticket type deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete ticket type error:', error);

    if (error.message.includes('Cannot delete')) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to delete ticket type',
    });
  }
}

