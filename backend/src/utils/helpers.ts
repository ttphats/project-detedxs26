import { randomUUID } from 'crypto';
import crypto from 'crypto';

export function generateOrderNumber(): string {
  return `TKH${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export function generateTransactionId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `TXN-${timestamp}-${random}`;
}

export function generateUUID(): string {
  return randomUUID();
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function isExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// Generate access token for ticketless auth
export function generateAccessToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

// Verify access token
export function verifyAccessToken(token: string, hash: string): boolean {
  const computed = crypto.createHash('sha256').update(token).digest('hex');
  return computed === hash;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

export function errorResponse(error: string): ApiResponse {
  return {
    success: false,
    error,
  };
}

