import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { config } from './env';

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

export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
}

export async function getAuthUser(authHeader: string | null): Promise<JWTPayload | null> {
  const token = extractTokenFromHeader(authHeader);
  if (!token) return null;

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(authHeader: string | null): JWTPayload {
  const user = getAuthUser(authHeader);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user as any;
}

export function requireRole(user: JWTPayload, allowedRoles: string[]): void {
  if (!allowedRoles.includes(user.roleName)) {
    throw new Error('Forbidden: Insufficient permissions');
  }
}

export function requireAdmin(user: JWTPayload): void {
  requireRole(user, ['SUPER_ADMIN', 'ADMIN', 'STAFF']);
}

