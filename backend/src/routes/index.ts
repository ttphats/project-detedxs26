import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes.js';
import { publicRoutes } from './public.routes.js';
import { registerAdminRoutes } from './admin.routes.js';
import { debugRoutes } from './debug.routes.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Health check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  // Debug routes (development only)
  if (process.env.NODE_ENV === 'development') {
    fastify.register(debugRoutes, { prefix: '/api' });
  }

  // Auth routes: /api/auth/*
  fastify.register(authRoutes, { prefix: '/api/auth' });

  // Public routes: /api/*
  fastify.register(publicRoutes, { prefix: '/api' });

  // Admin routes: /api/admin/*
  fastify.register(async (adminFastify) => {
    await registerAdminRoutes(adminFastify);
  }, { prefix: '/api' });
}

