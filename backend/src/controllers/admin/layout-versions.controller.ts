import { FastifyRequest, FastifyReply } from 'fastify';
import * as layoutVersionsService from '../../services/admin/layout-versions.service.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * GET /api/admin/layout-versions
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { eventId } = request.query as { eventId: string };

    if (!eventId) {
      return reply.status(400).send({
        success: false,
        error: 'Event ID is required',
      });
    }

    const data = await layoutVersionsService.listLayoutVersions(eventId);

    return reply.send({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Get layout versions error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to fetch layout versions',
    });
  }
}

/**
 * POST /api/admin/layout-versions
 */
export async function create(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { event_id, version_name, description, layout_config, seats_data } = request.body as {
      event_id: string;
      version_name: string;
      description?: string;
      layout_config: any;
      seats_data: any;
    };

    if (!event_id || !version_name || !layout_config || !seats_data) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required fields',
      });
    }

    const data = await layoutVersionsService.createLayoutVersion({
      event_id,
      version_name,
      description,
      layout_config,
      seats_data,
    });

    return reply.status(201).send({
      success: true,
      data,
      message: 'Draft saved successfully',
    });
  } catch (error: any) {
    console.error('Create layout version error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to create layout version',
    });
  }
}

/**
 * DELETE /api/admin/layout-versions
 */
export async function remove(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { id } = request.query as { id: string };

    if (!id) {
      return reply.status(400).send({
        success: false,
        error: 'Version ID is required',
      });
    }

    await layoutVersionsService.deleteLayoutVersion(id);

    return reply.send({
      success: true,
      message: 'Version deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete layout version error:', error);

    if (error.message.includes('not found')) {
      return reply.status(404).send({
        success: false,
        error: error.message,
      });
    }

    if (error.message.includes('Cannot delete')) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to delete layout version',
    });
  }
}

