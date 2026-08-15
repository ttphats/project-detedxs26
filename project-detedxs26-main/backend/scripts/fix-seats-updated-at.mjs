import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

async function fixInvalidDates() {
  console.log('🔧 Fixing invalid updated_at dates in seats table...');

  // Update where created_at is valid
  const result1 = await prisma.$executeRawUnsafe(`
    UPDATE seats
    SET updated_at = created_at
    WHERE (updated_at = '0000-00-00 00:00:00' OR updated_at IS NULL OR YEAR(updated_at) = 0)
      AND created_at IS NOT NULL
      AND YEAR(created_at) > 0
  `);

  console.log(`✅ Updated ${result1} seats to use created_at`);

  // Update remaining invalid ones to NOW()
  const result2 = await prisma.$executeRawUnsafe(`
    UPDATE seats
    SET updated_at = NOW()
    WHERE updated_at = '0000-00-00 00:00:00' OR updated_at IS NULL OR YEAR(updated_at) = 0
  `);

  console.log(`✅ Updated ${result2} remaining seats to NOW()`);

  // Check results
  const invalid = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as count
    FROM seats
    WHERE updated_at = '0000-00-00 00:00:00' OR YEAR(updated_at) = 0
  `);

  console.log(`\n📊 Invalid dates remaining: ${invalid[0].count}`);

  await prisma.$disconnect();
  console.log('\n✅ Done!');
}

fixInvalidDates().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
