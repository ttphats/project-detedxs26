import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const events = await prisma.event.findMany({ select: { id: true, name: true, status: true } });
  console.log(events);
  await prisma.$disconnect();
}
run();
