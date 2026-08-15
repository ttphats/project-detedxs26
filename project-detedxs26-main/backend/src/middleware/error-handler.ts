import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { errorResponse } from '../utils/helpers.js';
import { config } from '../config/env.js';

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Log error
  console.error(`[ERROR] ${request.method} ${request.url}:`, error);

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const message = error.errors[0]?.message || 'Validation failed';
    reply.status(400).send(errorResponse(message));
    return;
  }

  // Handle custom AppError
  if (error instanceof AppError) {
    reply.status(error.statusCode).send(errorResponse(error.message));
    return;
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    const message = error.message || 'Validation failed';
    reply.status(400).send(errorResponse(message));
    return;
  }

  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    
    switch (prismaError.code) {
      case 'P2002':
        reply.status(409).send(errorResponse('A record with this value already exists'));
        return;
      case 'P2025':
        reply.status(404).send(errorResponse('Record not found'));
        return;
      default:
        reply.status(500).send(errorResponse('Database error'));
        return;
    }
  }

  // Handle MySQL errors
  if ('code' in error) {
    const mysqlError = error as any;
    
    if (mysqlError.code === 'ER_DUP_ENTRY') {
      reply.status(409).send(errorResponse('Duplicate entry'));
      return;
    }
  }

  // Default server error
  const message = config.isDev ? error.message : 'Internal server error';
  reply.status(500).send(errorResponse(message));
}

