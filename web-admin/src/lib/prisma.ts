import { PrismaClient } from '@prisma/client';
import { config } from './env';

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

export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  console.log('🔌 Database disconnected');
}

