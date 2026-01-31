import { FastifyRequest, FastifyReply } from 'fastify';
import * as templatesService from '../../services/admin/email-templates.service.js';
import { replaceVariables, extractVariables } from '../../services/email.service.js';
import { UnauthorizedError, ForbiddenError, NotFoundError, BadRequestError } from '../../utils/errors.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * GET /api/admin/email-templates
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { category, activeOnly } = request.query as { category?: string; activeOnly?: string };
  const templates = await templatesService.listTemplates(category, activeOnly === 'true');

  return reply.send({ success: true, data: templates });
}

/**
 * GET /api/admin/email-templates/:id
 */
export async function getById(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };
  const template = await templatesService.getTemplateById(id);

  if (!template) throw new NotFoundError('Template not found');

  return reply.send({ success: true, data: template });
}

/**
 * POST /api/admin/email-templates
 */
export async function create(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const body = request.body as templatesService.CreateTemplateInput;
  const template = await templatesService.createTemplate(body);

  return reply.status(201).send({
    success: true,
    data: template,
    message: 'Template created successfully',
  });
}

/**
 * PUT /api/admin/email-templates/:id
 */
export async function update(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };
  const body = request.body as templatesService.UpdateTemplateInput;

  try {
    const template = await templatesService.updateTemplate(id, body);
    return reply.send({ success: true, data: template, message: 'Template updated successfully' });
  } catch (error: any) {
    if (error.message === 'Template not found') throw new NotFoundError(error.message);
    throw error;
  }
}

/**
 * DELETE /api/admin/email-templates/:id
 */
export async function remove(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };

  try {
    await templatesService.deleteTemplate(id);
    return reply.send({ success: true, message: 'Template deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Template not found') throw new NotFoundError(error.message);
    if (error.message.includes('Cannot delete')) throw new BadRequestError(error.message);
    throw error;
  }
}

/**
 * POST /api/admin/email-templates/:id/set-default
 */
export async function setDefault(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };

  try {
    const template = await templatesService.setDefaultTemplate(id);
    return reply.send({ success: true, data: template, message: 'Template set as default' });
  } catch (error: any) {
    if (error.message === 'Template not found') throw new NotFoundError(error.message);
    throw error;
  }
}

/**
 * POST /api/admin/email-templates/:id/activate
 */
export async function activate(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };
  const { active } = request.body as { active: boolean };

  const template = await templatesService.activateTemplate(id, active);
  return reply.send({ success: true, data: template });
}

/**
 * POST /api/admin/email-templates/:id/preview
 */
export async function preview(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };
  const { data } = request.body as { data: Record<string, any> };

  const template = await templatesService.getTemplateById(id);
  if (!template) throw new NotFoundError('Template not found');

  const subject = replaceVariables(template.subject, data || {});
  const html = replaceVariables(template.htmlContent, data || {});

  return reply.send({
    success: true,
    data: { subject, html, variables: extractVariables(template.htmlContent) },
  });
}

