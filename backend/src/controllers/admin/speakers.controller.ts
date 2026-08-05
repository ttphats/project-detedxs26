import { FastifyRequest, FastifyReply } from 'fastify';
import * as speakersService from '../../services/admin/speakers.service.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * GET /api/admin/speakers
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const { eventId } = request.query as { eventId?: string };
  const speakers = await speakersService.listSpeakers(eventId);

  return reply.send({
    success: true,
    data: speakers,
  });
}

/**
 * GET /api/admin/speakers/:id
 */
export async function getById(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const { id } = request.params as { id: string };
  const speaker = await speakersService.getSpeakerById(id);

  if (!speaker) {
    throw new NotFoundError('Speaker not found');
  }

  return reply.send({
    success: true,
    data: speaker,
  });
}

/**
 * POST /api/admin/speakers
 */
export async function create(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const body = request.body as speakersService.CreateSpeakerInput;
  const speaker = await speakersService.createSpeaker(body);

  return reply.status(201).send({
    success: true,
    data: speaker,
    message: 'Speaker created successfully',
  });
}

/**
 * PUT /api/admin/speakers/:id
 */
export async function update(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const { id } = request.params as { id: string };
  const body = request.body as speakersService.UpdateSpeakerInput;

  const existing = await speakersService.getSpeakerById(id);
  if (!existing) {
    throw new NotFoundError('Speaker not found');
  }

  const speaker = await speakersService.updateSpeaker(id, body);

  return reply.send({
    success: true,
    data: speaker,
    message: 'Speaker updated successfully',
  });
}

/**
 * DELETE /api/admin/speakers/:id
 */
export async function remove(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const { id } = request.params as { id: string };

  const existing = await speakersService.getSpeakerById(id);
  if (!existing) {
    throw new NotFoundError('Speaker not found');
  }

  await speakersService.deleteSpeaker(id);

  return reply.send({
    success: true,
    message: 'Speaker deleted successfully',
  });
}

