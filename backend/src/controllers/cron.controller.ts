import { FastifyRequest, FastifyReply } from 'fastify';
import * as cronService from '../services/cron.service.js';
import { successResponse } from '../utils/helpers.js';
import { UnauthorizedError } from '../utils/errors.js';
import { config } from '../config/env.js';

// GET /cron/expire-orders
export async function expireOrders(request: FastifyRequest, reply: FastifyReply) {
  // Verify cron secret
  const authHeader = request.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

  if (authHeader !== `Bearer ${cronSecret}`) {
    throw new UnauthorizedError('Invalid cron secret');
  }

  const result = await cronService.expireOrders();

  return reply.send(
    successResponse({
      ...result,
      message: result.totalFound === 0
        ? 'No expired orders'
        : `Expired ${result.successCount} orders, ${result.errorCount} errors`,
    })
  );
}

// GET /cron/cleanup-locks
export async function cleanupLocks(request: FastifyRequest, reply: FastifyReply) {
  // Verify cron secret
  const authHeader = request.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

  if (authHeader !== `Bearer ${cronSecret}`) {
    throw new UnauthorizedError('Invalid cron secret');
  }

  const deletedCount = await cronService.cleanupExpiredLocks();

  return reply.send(
    successResponse({
      deletedCount,
      message: `Cleaned up ${deletedCount} expired locks`,
    })
  );
}

