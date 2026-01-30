/**
 * Ticket Token Utilities
 * 
 * Provides secure token generation and verification for ticketless authentication.
 * Users can access their tickets via a unique URL without needing to login.
 */

import crypto from 'crypto';

/**
 * Generate a secure random access token
 * 
 * @returns Object containing plain token and its SHA-256 hash
 * - token: 64-character hex string (32 bytes of entropy)
 * - hash: 64-character SHA-256 hash to store in database
 */
export function generateAccessToken(): { token: string; hash: string } {
  // 32 bytes = 256 bits entropy - cryptographically secure
  const token = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(token);
  return { token, hash };
}

/**
 * Hash a token using SHA-256
 * 
 * @param token - Plain text token
 * @returns 64-character hex string hash
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against its stored hash
 * Uses constant-time comparison to prevent timing attacks
 * 
 * @param token - Plain text token from URL
 * @param storedHash - Hash stored in database
 * @returns true if token matches, false otherwise
 */
export function verifyToken(token: string, storedHash: string): boolean {
  try {
    const inputHash = hashToken(token);
    
    // Constant-time comparison prevents timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    // If buffers have different lengths or invalid hex, comparison fails
    return false;
  }
}

/**
 * Generate the full ticket access URL
 * 
 * @param orderNumber - Public order number (e.g., TKH5T69US)
 * @param token - Secret access token
 * @returns Full URL for accessing the ticket
 */
export function generateTicketUrl(orderNumber: string, token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/ticket/${orderNumber}?token=${token}`;
}

/**
 * Rate limiting for ticket access
 * Prevents brute force attempts to guess tokens
 */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 20;

// In-memory store - use Redis in production for horizontal scaling
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if an IP is rate limited
 * 
 * @param ip - Client IP address
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRequestCounts.get(ip);
  
  if (!record || now > record.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limited
  }
  
  record.count++;
  return true;
}

/**
 * Get client IP from request headers
 * Handles various proxy configurations
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') || // Cloudflare
    'unknown'
  );
}

/**
 * Clean up expired rate limit entries
 * Call periodically to prevent memory leaks
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [ip, record] of ipRequestCounts.entries()) {
    if (now > record.resetAt) {
      ipRequestCounts.delete(ip);
    }
  }
}

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

