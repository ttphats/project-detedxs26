// Quick test to check users query
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testQuery() {
  console.log('Testing users query...\n');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      roleId: true,
      role: { select: { name: true, description: true } },
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('Raw users from DB:');
  users.forEach((user) => {
    console.log({
      username: user.username,
      fullName: user.fullName,
      roleId: user.roleId,
      roleName: user.role?.name,
      roleDescription: user.role?.description,
    });
  });

  console.log('\n---\n');

  // Test transformation
  const transformedUsers = users.map((user) => ({
    ...user,
    roleName: user.role?.name || '',
    roleDescription: user.role?.description || null,
  }));

  console.log('Transformed users:');
  transformedUsers.forEach((user) => {
    console.log({
      username: user.username,
      fullName: user.fullName,
      roleId: user.roleId,
      roleName: user.roleName,
    });
  });

  await prisma.$disconnect();
}

testQuery().catch(console.error);
