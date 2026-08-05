import { FastifyRequest, FastifyReply } from 'fastify';
import * as speakerService from '../../services/admin/speaker-register.service.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../../utils/errors.js';
import { requireAdmin } from '../../utils/auth.js';

// ==========================================
// PUBLIC CONTROLLERS
// ==========================================

export async function getPublicConfig(request: FastifyRequest, reply: FastifyReply) {
  const config = await speakerService.getConfig();
  return reply.send({ success: true, data: config });
}

export async function getPublicFields(request: FastifyRequest, reply: FastifyReply) {
  const fields = await speakerService.listFields();
  return reply.send({ success: true, data: fields });
}

export async function submitRegistration(request: FastifyRequest, reply: FastifyReply) {
  const answers = request.body as any;
  if (!answers || Object.keys(answers).length === 0) {
    return reply.status(400).send({ success: false, error: 'Thông tin đăng ký không hợp lệ' });
  }

  const sub = await speakerService.createSubmission(answers);
  return reply.status(201).send({
    success: true,
    data: sub,
    message: 'Đăng ký trở thành diễn giả thành công'
  });
}

// ==========================================
// ADMIN CONTROLLERS
// ==========================================

export async function getConfig(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const config = await speakerService.getConfig();
  return reply.send({ success: true, data: config });
}

export async function updateConfig(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const body = request.body as speakerService.SpeakerConfigInput;
  const config = await speakerService.updateConfig(body);
  return reply.send({
    success: true,
    data: config,
    message: 'Cập nhật thể lệ đăng ký diễn giả thành công'
  });
}

export async function listFields(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const fields = await speakerService.listFields();
  return reply.send({ success: true, data: fields });
}

export async function createField(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const body = request.body as speakerService.SpeakerFieldInput;
  const field = await speakerService.createField(body);
  return reply.status(201).send({
    success: true,
    data: field,
    message: 'Thêm trường nhập liệu thành công'
  });
}

export async function updateField(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const { id } = request.params as { id: string };
  const body = request.body as Partial<speakerService.SpeakerFieldInput>;
  const field = await speakerService.updateField(id, body);
  return reply.send({
    success: true,
    data: field,
    message: 'Cập nhật trường nhập liệu thành công'
  });
}

export async function removeField(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const { id } = request.params as { id: string };
  await speakerService.deleteField(id);
  return reply.send({
    success: true,
    message: 'Xóa trường nhập liệu thành công'
  });
}

export async function listSubmissions(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const submissions = await speakerService.listSubmissions();
  return reply.send({ success: true, data: submissions });
}

export async function updateSubmissionStatus(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();

  try {
    requireAdmin(user);
  } catch {
    throw new ForbiddenError();
  }

  const { id } = request.params as { id: string };
  const { status } = request.body as { status: string };
  
  if (!status) {
    return reply.status(400).send({ success: false, error: 'Trạng thái không hợp lệ' });
  }

  const sub = await speakerService.updateSubmissionStatus(id, status);
  return reply.send({
    success: true,
    data: sub,
    message: 'Cập nhật trạng thái duyệt diễn giả thành công'
  });
}
