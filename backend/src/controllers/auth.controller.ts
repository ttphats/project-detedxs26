import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { successResponse } from '../utils/helpers.js';
import { getClientIP } from '../middleware/rate-limit.js';
import { UnauthorizedError } from '../utils/errors.js';

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phoneNumber: z.string().optional(),
});

// POST /auth/login
export async function login(
  request: FastifyRequest<{ Body: { username: string; password: string } }>,
  reply: FastifyReply
) {
  const input = loginSchema.parse(request.body);
  const ip = getClientIP(request);
  const userAgent = request.headers['user-agent'];

  const result = await authService.login(input, ip, userAgent);

  return reply.send(successResponse(result, 'Login successful'));
}

// POST /auth/register
export async function register(
  request: FastifyRequest<{ Body: { email: string; password: string; fullName: string; phoneNumber?: string } }>,
  reply: FastifyReply
) {
  const input = registerSchema.parse(request.body);
  const ip = getClientIP(request);
  const userAgent = request.headers['user-agent'];

  const result = await authService.register(input, ip, userAgent);

  return reply.status(201).send(successResponse(result, 'Registration successful'));
}

// GET /auth/me
export async function me(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    throw new UnauthorizedError();
  }

  const userData = await authService.getUserById(request.user.userId);

  if (!userData) {
    throw new UnauthorizedError('User not found');
  }

  return reply.send(successResponse(userData));
}

