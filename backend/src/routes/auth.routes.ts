import { FastifyInstance } from 'fastify';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/rate-limit.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /auth/login - Login
  fastify.post('/login', {
    preHandler: [loginRateLimit],
    handler: authController.login,
  });

  // POST /auth/register - Register
  fastify.post('/register', {
    preHandler: [loginRateLimit],
    handler: authController.register,
  });

  // GET /auth/me - Get current user
  fastify.get('/me', {
    preHandler: [requireAuth],
    handler: authController.me,
  });
}

