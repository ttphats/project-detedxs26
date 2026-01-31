import { FastifyRequest, FastifyReply } from 'fastify';
import * as uploadService from '../../services/upload.service.js';
import { UnauthorizedError, ForbiddenError, BadRequestError } from '../../utils/errors.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * POST /api/admin/upload
 */
export async function uploadImage(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  // Get multipart data
  const data = await request.file();

  if (!data) {
    throw new BadRequestError('No file provided');
  }

  // Validate file type
  if (!uploadService.validateImageType(data.mimetype)) {
    throw new BadRequestError('Invalid file type. Only JPEG, PNG, WebP, GIF allowed.');
  }

  // Get file buffer
  const buffer = await data.toBuffer();

  // Validate file size
  if (!uploadService.validateImageSize(buffer.length)) {
    throw new BadRequestError('File too large. Maximum 5MB allowed.');
  }

  // Convert to base64
  const base64 = `data:${data.mimetype};base64,${buffer.toString('base64')}`;

  // Get subfolder from fields
  const subfolder = (data.fields?.subfolder as any)?.value || 'speakers';

  // Upload to Cloudinary
  const result = await uploadService.uploadImage(base64, subfolder);

  if (!result.success) {
    throw new BadRequestError(result.error || 'Failed to upload image');
  }

  return reply.send({
    success: true,
    data: result.data,
  });
}

/**
 * DELETE /api/admin/upload
 */
export async function deleteImage(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { public_id } = request.body as { public_id: string };

  if (!public_id) {
    throw new BadRequestError('public_id is required');
  }

  const result = await uploadService.deleteImage(public_id);

  if (!result.success) {
    throw new BadRequestError(result.error || 'Failed to delete image');
  }

  return reply.send({
    success: true,
    message: 'Image deleted successfully',
  });
}

