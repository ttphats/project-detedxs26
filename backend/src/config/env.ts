import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('4000'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('3306'),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_TOKEN: z.string().optional(),

  // Email
  EMAIL_PROVIDER: z.enum(['mock', 'resend']).default('mock'),
  EMAIL_FROM: z.string().default('TEDxFPT University HCMC <noreply@tedxfptuhcmc.com>'),
  RESEND_API_KEY: z.string().optional(),

  // Client URL
  CLIENT_URL: z.string().url().default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_WINDOW: z.string().default('60'),

  // Seat Lock
  SEAT_LOCK_TTL: z.string().default('300'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3002'),

  // Cron
  CRON_SECRET: z.string().default('dev-secret'),

  // Cloudinary
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('tedx-fptuhcmc'),

  // Payment
  PAYMENT_PROVIDER: z.enum(['mock', 'stripe', 'vnpay']).default('mock'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

export const env = loadEnv();

export const config = {
  server: {
    port: parseInt(env.PORT, 10),
    host: env.HOST,
  },
  database: {
    url: env.DATABASE_URL,
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT, 10),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    name: env.DB_NAME,
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
    resendApiKey: env.RESEND_API_KEY,
  },
  clientUrl: env.CLIENT_URL,
  rateLimit: {
    max: parseInt(env.RATE_LIMIT_MAX, 10),
    window: parseInt(env.RATE_LIMIT_WINDOW, 10),
  },
  seatLockTtl: parseInt(env.SEAT_LOCK_TTL, 10),
  corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
  cronSecret: env.CRON_SECRET,
  cloudinary: {
    url: env.CLOUDINARY_URL,
    folder: env.CLOUDINARY_FOLDER,
  },
  payment: {
    provider: env.PAYMENT_PROVIDER,
  },
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
};

