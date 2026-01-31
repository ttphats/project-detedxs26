import { FastifyRequest, FastifyReply } from 'fastify';
import * as timelinesService from '../../services/admin/timelines.service.js';
import { requireAdmin } from '../../utils/auth.js';
import { createAuditLog } from '../../services/audit.service.js';

interface CreateTimelineBody {
  event_id: string;
  start_time: string;
  end_time: string;
  title: string;
  description?: string;
  speaker_name?: string;
  speaker_avatar_url?: string;
  type?: string;
  order_index?: number;
  status?: string;
}

/**
 * GET /api/admin/timelines
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { eventId, status } = request.query as { eventId?: string; status?: string };

    const data = await timelinesService.listTimelines(eventId, status);

    return reply.send({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Get timelines error:', error);
    return reply.status(500).send({
      success: false,
      error: 'Failed to fetch timelines',
    });
  }
}

/**
 * POST /api/admin/timelines
 */
export async function create(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user!;
    requireAdmin(user);

    const body = request.body as CreateTimelineBody;
    const data = await timelinesService.createTimeline(body);

    // Audit log
    await createAuditLog({
      userId: user.userId,
      userRole: user.roleName,
      action: 'CREATE',
      entity: 'TIMELINE',
      entityId: data.id,
      newValue: body,
      metadata: { eventId: body.event_id },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] as string,
    });

    return reply.status(201).send({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Create timeline error:', error);

    if (error.message.includes('required') || error.message.includes('Invalid')) {
      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }

    return reply.status(500).send({
      success: false,
      error: 'Failed to create timeline',
    });
  }
}

/**
 * PUT /api/admin/timelines/:id
 */
export async function update(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user!;
    requireAdmin(user);

    const { id } = request.params as { id: string };
    const body = request.body as Partial<timelinesService.CreateTimelineInput>;
    const data = await timelinesService.updateTimeline(id, body);

    return reply.send({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Update timeline error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to update timeline',
    });
  }
}

/**
 * DELETE /api/admin/timelines/:id
 */
export async function remove(request: FastifyRequest, reply: FastifyReply) {
  try {
    requireAdmin(request.user!);
    const { id } = request.params as { id: string };

    await timelinesService.deleteTimeline(id);

    return reply.send({
      success: true,
      message: 'Timeline deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete timeline error:', error);
    return reply.status(500).send({
      success: false,
      error: error.message || 'Failed to delete timeline',
    });
  }
}

