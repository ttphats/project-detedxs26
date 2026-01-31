import { FastifyRequest, FastifyReply } from 'fastify';
import { checkRateLimit } from '../db/redis.js';
import { TooManyRequestsError } from '../utils/errors.js';

// Get client IP from request
export function getClientIP(request: FastifyRequest): string {
  return (
    (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (request.headers['x-real-ip'] as string) ||
    request.ip ||
    'unknown'
  );
}

// Rate limit middleware factory
export function rateLimit(prefix: string) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const ip = getClientIP(request);
    const identifier = `${prefix}:${ip}`;

    const result = await checkRateLimit(identifier);

    // Set rate limit headers
    reply.header('X-RateLimit-Remaining', result.remaining.toString());

    if (!result.allowed) {
      throw new TooManyRequestsError('Too many requests. Please try again later.');
    }
  };
}

// Specific rate limiters
export const loginRateLimit = rateLimit('login');
export const apiRateLimit = rateLimit('api');
export const orderRateLimit = rateLimit('order');

