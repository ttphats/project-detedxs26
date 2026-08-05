// One-off DB cleanup: drop UNIQUE constraint `uq_order_purpose` on email_logs.
// Prisma schema declares this as a non-unique index (@@index([orderId, purpose]))
// but the DB has it as UNIQUE, preventing resend-email / retry logging.
// Run: node scripts/fix-email-logs-constraint.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dbName = (
    await prisma.$queryRawUnsafe('SELECT DATABASE() AS db')
  )[0]?.db;
  console.log(`📦 Database: ${dbName}`);

  const rows = await prisma.$queryRawUnsafe(
    `SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'email_logs'
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    dbName
  );

  const byIndex = new Map();
  for (const r of rows) {
    if (!byIndex.has(r.INDEX_NAME)) byIndex.set(r.INDEX_NAME, { ...r, cols: [] });
    byIndex.get(r.INDEX_NAME).cols.push(r.COLUMN_NAME);
  }

  console.log('🔍 Indexes on email_logs:');
  for (const [name, info] of byIndex) {
    console.log(
      `  - ${name} (${info.NON_UNIQUE === 0n || info.NON_UNIQUE === 0 ? 'UNIQUE' : 'INDEX'}): ${info.cols.join(', ')}`
    );
  }

  const target = byIndex.get('uq_order_purpose');
  if (!target) {
    console.log('✅ No `uq_order_purpose` constraint found — nothing to drop.');
    return;
  }

  console.log('⚠️  Dropping UNIQUE constraint `uq_order_purpose`...');
  await prisma.$executeRawUnsafe('ALTER TABLE email_logs DROP INDEX uq_order_purpose');
  console.log('✅ Dropped.');

  const hasIdx = [...byIndex.keys()].some((n) => n === 'email_logs_order_id_purpose_idx');
  if (!hasIdx) {
    console.log('➕ Adding non-unique index on (order_id, purpose)...');
    await prisma.$executeRawUnsafe(
      'CREATE INDEX email_logs_order_id_purpose_idx ON email_logs (order_id, purpose)'
    );
    console.log('✅ Index created.');
  } else {
    console.log('ℹ️  Non-unique index already exists — skipping.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
