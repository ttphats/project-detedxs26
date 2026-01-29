import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
}

// Hardcode the JWT secret for Edge Runtime compatibility
// Edge Runtime may not have access to process.env in the same way
const JWT_SECRET = '8dbeed8a671eec89989ae43593f956fb3f62e4b944acd3e8d9193c000eb0f649cc033da0d9212e8e9b6cff748d7b4a8e628d633551ab07951c7a1a1eb95c5a0a';

export function verifyTokenEdge(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export function signTokenEdge(payload: JWTPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

