import { FastifyRequest, FastifyReply } from 'fastify';
import * as usersService from '../../services/admin/users.service.js';
import { UnauthorizedError, ForbiddenError, NotFoundError, BadRequestError } from '../../utils/errors.js';
import { requireAdmin } from '../../utils/auth.js';

/**
 * GET /api/admin/users
 */
export async function list(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const query = request.query as usersService.ListUsersInput;
  const result = await usersService.listUsers(query);

  return reply.send({ success: true, data: result });
}

/**
 * GET /api/admin/users/:id
 */
export async function getById(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };
  const targetUser = await usersService.getUserById(id);

  if (!targetUser) throw new NotFoundError('User not found');

  return reply.send({ success: true, data: targetUser });
}

/**
 * POST /api/admin/users
 */
export async function create(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const body = request.body as usersService.CreateUserInput;

  // Check permission
  if (!usersService.canManageRole(user.roleName, body.role)) {
    throw new ForbiddenError('Cannot create user with this role');
  }

  const newUser = await usersService.createUser(body);

  return reply.status(201).send({
    success: true,
    data: newUser,
    message: 'User created successfully',
  });
}

/**
 * PUT /api/admin/users/:id
 */
export async function update(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };
  const body = request.body as usersService.UpdateUserInput;

  const existing = await usersService.getUserById(id);
  if (!existing) throw new NotFoundError('User not found');

  // Check permission for role change
  if (body.role && !usersService.canManageRole(user.roleName, body.role)) {
    throw new ForbiddenError('Cannot change user to this role');
  }

  const updatedUser = await usersService.updateUser(id, body);

  return reply.send({
    success: true,
    data: updatedUser,
    message: 'User updated successfully',
  });
}

/**
 * DELETE /api/admin/users/:id
 */
export async function remove(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user;
  if (!user) throw new UnauthorizedError();
  try { requireAdmin(user); } catch { throw new ForbiddenError(); }

  const { id } = request.params as { id: string };

  // Cannot delete self
  if (id === user.userId) {
    throw new BadRequestError('Cannot delete your own account');
  }

  const existing = await usersService.getUserById(id);
  if (!existing) throw new NotFoundError('User not found');

  // Check permission - get role name from relation
  const existingRoleName = existing.role?.name || '';
  if (!usersService.canManageRole(user.roleName, existingRoleName)) {
    throw new ForbiddenError('Cannot delete user with this role');
  }

  await usersService.deleteUser(id);

  return reply.send({
    success: true,
    message: 'User deleted successfully',
  });
}

