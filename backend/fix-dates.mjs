import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  await prisma.$executeRaw`UPDATE seats SET updated_at = NOW() WHERE updated_at IS NULL`;
  await prisma.$executeRaw`UPDATE seats SET created_at = NOW() WHERE created_at IS NULL`;
  console.log('Fixed NULL dates in seats table via Prisma executeRaw');
  await prisma.$disconnect();
}
run();
