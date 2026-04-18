import { FastifyRequest, FastifyReply } from 'fastify';
import * as templatesService from '../../services/admin/email-templates.service.js';
import * as uploadService from '../../services/admin/template-upload.service.js';
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
 * GET/POST /api/admin/email-templates/:id/preview
 */
export async function preview(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };

  // Support both GET (no body) and POST (with body)
  const body = request.body as { data?: Record<string, any> } | undefined;
  const data = body?.data || {};

  const template = await templatesService.getTemplateById(id);
  if (!template) throw new NotFoundError('Template not found');

  // Use sample data for preview if no data provided
  const sampleData: Record<string, any> = {
    customerName: 'Nguyễn Văn A',
    orderNumber: 'ORD-2026-001234',
    eventName: 'TEDxFPT University HCMC 2026',
    eventDate: '20/06/2026',
    eventTime: '18:00',
    venue: 'Nhà hát Thành phố Hồ Chí Minh',
    totalAmount: '500.000 đ',
    seats: 'A1, A2, A3',
    qrCodeUrl: 'https://via.placeholder.com/200x200?text=QR+Code',
    ...data,
  };

  const subject = replaceVariables(template.subject, sampleData);
  const html = replaceVariables(template.htmlContent, sampleData);

  return reply.send({
    success: true,
    data: { subject, html, variables: extractVariables(template.htmlContent) },
  });
}

/**
 * POST /api/admin/email-templates/upload
 * Upload HTML file + images (like Canva export)
 */
export async function upload(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  try {
    // Get base URL for image paths
    const protocol = request.headers['x-forwarded-proto'] || 'http';
    const host = request.headers.host || 'localhost:4000';
    const baseUrl = `${protocol}://${host}`;

    // Process uploaded files
    const result = await uploadService.processTemplateUpload(request, baseUrl);

    if (!result.htmlContent) {
      throw new BadRequestError('No HTML file found in upload');
    }

    return reply.send({
      success: true,
      data: {
        htmlContent: result.htmlContent,
        images: result.images,
        templateId: result.templateId,
        message: 'Files uploaded successfully. Review and save the template.',
      },
    });
  } catch (error: any) {
    throw new BadRequestError(error.message || 'Upload failed');
  }
}

/**
 * POST /api/admin/email-templates/upload/save
 * Save uploaded template to database
 */
export async function saveUploaded(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const body = request.body as {
    name: string;
    subject: string;
    htmlContent: string;
    purpose: string;
    description?: string;
  };

  if (!body.name || !body.subject || !body.htmlContent || !body.purpose) {
    throw new BadRequestError('Missing required fields: name, subject, htmlContent, purpose');
  }

  const template = await uploadService.saveUploadedTemplate(body);

  return reply.send({
    success: true,
    data: template,
  });
}
