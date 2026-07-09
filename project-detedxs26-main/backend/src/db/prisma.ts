import { PrismaClient } from '@prisma/client';
import { config } from '../config/env.js';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: config.isDev ? ['query', 'error', 'warn'] : ['error'],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (config.isDev) {
  globalThis.prismaGlobal = prisma;
}

export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected to database');
  } catch (error) {
    console.error('❌ Prisma connection failed:', error);
    throw error;
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  console.log('🔌 Prisma disconnected');
}

