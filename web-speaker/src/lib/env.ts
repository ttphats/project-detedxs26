import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_TOKEN: z.string().optional(),

  // Email - Resend
  EMAIL_PROVIDER: z.enum(['mock', 'resend']).default('mock'),
  EMAIL_FROM: z.string().default('TEDxFPT University HCMC <onboarding@resend.dev>'),
  RESEND_API_KEY: z.string().optional(),

  // Payment
  PAYMENT_PROVIDER: z.enum(['mock', 'stripe', 'vnpay', 'momo', 'zalopay']).default('mock'),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLIC_KEY: z.string().optional(),

  // VNPay
  VNPAY_TMN_CODE: z.string().optional(),
  VNPAY_HASH_SECRET: z.string().optional(),
  VNPAY_URL: z.string().optional(),
  VNPAY_RETURN_URL: z.string().optional(),

  // App Config
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3002'),
  NEXT_PUBLIC_CLIENT_URL: z.string().url().default('http://localhost:3000'),

  // Seat Lock
  SEAT_LOCK_TTL: z.string().default('300'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_WINDOW: z.string().default('60'),

  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test', 'mock']).default('development'),
});

function getEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

export const env = getEnv();

export const config = {
  database: {
    url: env.DATABASE_URL,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  redis: {
    url: env.REDIS_URL,
    token: env.REDIS_TOKEN,
  },
  email: {
    provider: env.EMAIL_PROVIDER,
    from: env.EMAIL_FROM,
    resend: {
      apiKey: env.RESEND_API_KEY,
    },
  },
  payment: {
    provider: env.PAYMENT_PROVIDER,
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      publicKey: env.STRIPE_PUBLIC_KEY,
    },
    vnpay: {
      tmnCode: env.VNPAY_TMN_CODE,
      hashSecret: env.VNPAY_HASH_SECRET,
      url: env.VNPAY_URL,
      returnUrl: env.VNPAY_RETURN_URL,
    },
  },
  app: {
    url: env.NEXT_PUBLIC_APP_URL,
    clientUrl: env.NEXT_PUBLIC_CLIENT_URL,
  },
  seatLock: {
    ttl: parseInt(env.SEAT_LOCK_TTL, 10),
  },
  rateLimit: {
    max: parseInt(env.RATE_LIMIT_MAX, 10),
    window: parseInt(env.RATE_LIMIT_WINDOW, 10),
  },
  isMock: env.NODE_ENV === 'mock',
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
};

