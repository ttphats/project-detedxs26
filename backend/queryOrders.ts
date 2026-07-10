import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orderItems = await prisma.orderItem.findMany({
    where: { seatNumber: 'E9' },
    include: { order: true }
  });
  console.log(JSON.stringify(orderItems, null, 2));
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
