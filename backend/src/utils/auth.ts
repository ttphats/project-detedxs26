import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { config } from '../config/env.js';

export interface JWTPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, config.jwt.secret) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export function extractTokenFromHeader(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

/**
 * Check if user has admin role
 */
export function requireAdmin(user: JWTPayload): void {
  const adminRoles = ['SUPER_ADMIN', 'ADMIN'];
  if (!adminRoles.includes(user.roleName)) {
    throw new Error('Admin access required');
  }
}

/**
 * Check if user has super admin role
 */
export function requireSuperAdmin(user: JWTPayload): void {
  if (user.roleName !== 'SUPER_ADMIN') {
    throw new Error('Super admin access required');
  }
}

