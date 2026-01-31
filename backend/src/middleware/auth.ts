import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { verifyToken, extractTokenFromHeader, JWTPayload } from '../utils/auth.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

// Middleware to extract user from token (optional auth)
export async function optionalAuth(request: FastifyRequest): Promise<void> {
  const authHeader = request.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    try {
      request.user = verifyToken(token);
    } catch {
      // Ignore invalid token for optional auth
    }
  }
}

// Middleware to require authentication
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    throw new UnauthorizedError('No token provided');
  }

  try {
    request.user = verifyToken(token);
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

// Middleware factory to require specific roles
export function requireRole(...allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await requireAuth(request, reply);

    if (!request.user) {
      throw new UnauthorizedError();
    }

    if (!allowedRoles.includes(request.user.roleName)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}

// Shorthand for admin-only routes
export const requireAdmin = requireRole('SUPER_ADMIN', 'ADMIN', 'STAFF');

// Shorthand for super admin routes
export const requireSuperAdmin = requireRole('SUPER_ADMIN');

// Plugin to register auth hooks
export async function authPlugin(fastify: FastifyInstance): Promise<void> {
  // Decorate request with user property (undefined as initial value)
  fastify.decorateRequest('user', undefined);

  // Add preHandler hook for routes that need auth
  fastify.addHook('preHandler', optionalAuth);
}

