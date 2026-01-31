import { FastifyRequest, FastifyReply } from 'fastify';
import * as layoutsService from '../../services/admin/layouts.service.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * GET /api/admin/layouts
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { eventId } = request.query as { eventId?: string };

    const data = await layoutsService.listLayouts(eventId);

    return reply.send({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Get layouts error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to fetch layouts',
    });
  }
}

/**
 * POST /api/admin/layouts
 */
export async function create(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { event_id, name } = request.body as { event_id: string; name?: string };

    if (!event_id) {
      return reply.status(400).send({
        success: false,
        error: 'Event ID is required',
      });
    }

    const data = await layoutsService.createLayout(event_id, name);

    return reply.status(201).send({
      success: true,
      data,
      message: 'Layout created successfully',
    });
  } catch (error: any) {
    console.error('Create layout error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to create layout',
    });
  }
}

/**
 * PUT /api/admin/layouts
 */
export async function update(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { id, name, status } = request.body as { id: string; name?: string; status?: string };

    if (!id) {
      return reply.status(400).send({
        success: false,
        error: 'Layout ID is required',
      });
    }

    await layoutsService.updateLayout(id, { name, status });

    return reply.send({
      success: true,
      message: 'Layout updated successfully',
    });
  } catch (error: any) {
    console.error('Update layout error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to update layout',
    });
  }
}

/**
 * DELETE /api/admin/layouts
 */
export async function remove(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { id } = request.query as { id: string };

    if (!id) {
      return reply.status(400).send({
        success: false,
        error: 'Layout ID is required',
      });
    }

    await layoutsService.deleteLayout(id);

    return reply.send({
      success: true,
      message: 'Layout deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete layout error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to delete layout',
    });
  }
}

