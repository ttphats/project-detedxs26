import { Redis } from '@upstash/redis';
import { config } from './env';

// Mock Redis for development without Redis server
class MockRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async set(key: string, value: string, options?: { ex?: number; nx?: boolean }): Promise<'OK' | null> {
    if (options?.nx && this.store.has(key)) {
      return null;
    }

    const expiresAt = options?.ex ? Date.now() + options.ex * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
    
    if (expiresAt) {
      setTimeout(() => this.store.delete(key), options.ex! * 1000);
    }

    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item) return 0;

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return 0;
    }

    return 1;
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key);
    if (!item) return -2;
    if (!item.expiresAt) return -1;

    const remaining = Math.floor((item.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.store.get(key);
    if (!item) return 0;

    item.expiresAt = Date.now() + seconds * 1000;
    setTimeout(() => this.store.delete(key), seconds * 1000);
    return 1;
  }
}

function createRedisClient() {
  // Use mock Redis if in mock mode or no Redis URL provided
  if (config.isMock || !config.redis.url) {
    console.log('⚠️  Using Mock Redis (in-memory)');
    return new MockRedis() as any;
  }

  // Use Upstash Redis for production
  if (config.redis.token) {
    return new Redis({
      url: config.redis.url!,
      token: config.redis.token,
    });
  }

  // Use standard Redis URL
  return Redis.fromEnv();
}

export const redis = createRedisClient();

// Seat locking utilities
export async function lockSeat(eventId: string, seatId: string, userId: string): Promise<boolean> {
  const key = `seat:${eventId}:${seatId}`;
  const result = await redis.set(key, userId, { ex: config.seatLock.ttl, nx: true });
  return result === 'OK';
}

export async function unlockSeat(eventId: string, seatId: string): Promise<void> {
  const key = `seat:${eventId}:${seatId}`;
  await redis.del(key);
}

export async function getSeatLock(eventId: string, seatId: string): Promise<string | null> {
  const key = `seat:${eventId}:${seatId}`;
  return await redis.get(key);
}

export async function extendSeatLock(eventId: string, seatId: string): Promise<boolean> {
  const key = `seat:${eventId}:${seatId}`;
  const exists = await redis.exists(key);
  if (!exists) return false;

  await redis.expire(key, config.seatLock.ttl);
  return true;
}

export async function unlockSeats(eventId: string, seatIds: string[]): Promise<void> {
  await Promise.all(seatIds.map(seatId => unlockSeat(eventId, seatId)));
}

// Rate limiting utilities
export async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${identifier}`;
  const current = await redis.get(key);

  if (!current) {
    await redis.set(key, '1', { ex: config.rateLimit.window });
    return { allowed: true, remaining: config.rateLimit.max - 1 };
  }

  const count = parseInt(current, 10);

  if (count >= config.rateLimit.max) {
    return { allowed: false, remaining: 0 };
  }

  await redis.set(key, (count + 1).toString(), { ex: config.rateLimit.window });
  return { allowed: true, remaining: config.rateLimit.max - count - 1 };
}

