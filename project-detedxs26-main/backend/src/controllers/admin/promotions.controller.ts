import { FastifyRequest, FastifyReply } from 'fastify';
import * as promotionsService from '../../services/admin/promotions.service.js';
import { successResponse } from '../../utils/helpers.js';
import { BadRequestError } from '../../utils/errors.js';

export async function listPromotions(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { eventId } = request.query as { eventId: string };
  if (!eventId) throw new BadRequestError('eventId is required');

  const promotions = await promotionsService.listPromotions(eventId);
  return reply.send(successResponse({ promotions }));
}

export async function createPromotion(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const input = request.body as promotionsService.CreatePromotionInput;
  if (!input.eventId || !input.name || !input.type || !input.discountType || !input.discountValue || !input.startDate || !input.endDate) {
    throw new BadRequestError('Missing required fields');
  }

  const promotion = await promotionsService.createPromotion(input);
  return reply.code(201).send(successResponse(promotion));
}

export async function getPromotion(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const promotion = await promotionsService.getPromotion(id);
  return reply.send(successResponse(promotion));
}

export async function updatePromotion(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const promotion = await promotionsService.updatePromotion(id, request.body as promotionsService.UpdatePromotionInput);
  return reply.send(successResponse(promotion));
}

export async function deletePromotion(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  await promotionsService.deletePromotion(id);
  return reply.send(successResponse({ success: true }));
}

export async function togglePromotion(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const promotion = await promotionsService.togglePromotion(id);
  return reply.send(successResponse(promotion));
}
