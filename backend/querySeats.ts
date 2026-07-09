import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const seats = await prisma.seat.findMany({
    where: { seatNumber: { in: ['E9', 'E10', 'E11'] } },
    include: { seatLock: true }
  });
  console.log(JSON.stringify(seats, null, 2));
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
