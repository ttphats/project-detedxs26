import { FastifyRequest, FastifyReply } from 'fastify';
import * as partnersService from '../../services/admin/partners.service.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * GET /api/admin/partners
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const partners = await partnersService.listPartners();

  return reply.send({
    success: true,
    data: partners,
  });
}

/**
 * GET /api/admin/partners/:id
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
  const partner = await partnersService.getPartnerById(id);

  if (!partner) {
    throw new NotFoundError('Partner not found');
  }

  return reply.send({
    success: true,
    data: partner,
  });
}

/**
 * POST /api/admin/partners
 */
export async function create(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const body = request.body as partnersService.CreatePartnerInput;
  const partner = await partnersService.createPartner(body);

  return reply.status(201).send({
    success: true,
    data: partner,
    message: 'Partner created successfully',
  });
}

/**
 * PUT /api/admin/partners/:id
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
  const body = request.body as partnersService.UpdatePartnerInput;

  const existing = await partnersService.getPartnerById(id);
  if (!existing) {
    throw new NotFoundError('Partner not found');
  }

  const partner = await partnersService.updatePartner(id, body);

  return reply.send({
    success: true,
    data: partner,
    message: 'Partner updated successfully',
  });
}

/**
 * DELETE /api/admin/partners/:id
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

  const existing = await partnersService.getPartnerById(id);
  if (!existing) {
    throw new NotFoundError('Partner not found');
  }

  await partnersService.deletePartner(id);

  return reply.send({
    success: true,
    message: 'Partner deleted successfully',
  });
}

/**
 * GET /api/partners (Public)
 */
export async function listPublic(request: FastifyRequest, reply: FastifyReply) {
  const partners = await partnersService.listPublicPartners();

  return reply.send({
    success: true,
    data: partners,
  });
}
