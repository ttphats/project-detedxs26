import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
console.log("🔧 Safe Layout Versioning Migration");
console.log("DATABASE_URL:", DATABASE_URL);

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("🔌 Connected to database!\n");

  // 1. Add version and update status ENUM in layouts table
  console.log("📦 Step 1: Updating layouts table...");
  
  // Check if version column exists
  const [versionCol] = await conn.execute("SHOW COLUMNS FROM layouts LIKE 'version'");
  if (versionCol.length === 0) {
    await conn.execute("ALTER TABLE layouts ADD COLUMN version INT NOT NULL DEFAULT 1");
    console.log("   ✅ Added 'version' column");
  } else {
    console.log("   ⏭️ 'version' column already exists");
  }

  // Update status ENUM to include ARCHIVED
  console.log("   Updating status ENUM to include ARCHIVED...");
  await conn.execute(`
    ALTER TABLE layouts MODIFY COLUMN status ENUM('DRAFT', 'PUBLIC', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT'
  `);
  console.log("   ✅ Status ENUM updated!\n");

  // 2. Add section_code to layout_sections table
  console.log("📦 Step 2: Updating layout_sections table...");
  const [sectionCodeCol] = await conn.execute("SHOW COLUMNS FROM layout_sections LIKE 'section_code'");
  if (sectionCodeCol.length === 0) {
    await conn.execute("ALTER TABLE layout_sections ADD COLUMN section_code VARCHAR(50) NOT NULL DEFAULT ''");
    console.log("   ✅ Added 'section_code' column");
    
    // Generate section_code for existing sections based on name
    await conn.execute(`
      UPDATE layout_sections 
      SET section_code = CONCAT(UPPER(REPLACE(REPLACE(name, ' ', '-'), '.', '')), '-', SUBSTRING(id, 1, 4))
      WHERE section_code = ''
    `);
    console.log("   ✅ Generated section_code for existing sections");
  } else {
    console.log("   ⏭️ 'section_code' column already exists");
  }
  console.log("");

  // 3. Update seats table
  console.log("📦 Step 3: Updating seats table...");
  
  // Add section_code column
  const [seatSectionCodeCol] = await conn.execute("SHOW COLUMNS FROM seats LIKE 'section_code'");
  if (seatSectionCodeCol.length === 0) {
    await conn.execute("ALTER TABLE seats ADD COLUMN section_code VARCHAR(50)");
    console.log("   ✅ Added 'section_code' column");
  } else {
    console.log("   ⏭️ 'section_code' column already exists");
  }

  // Add seat_key column
  const [seatKeyCol] = await conn.execute("SHOW COLUMNS FROM seats LIKE 'seat_key'");
  if (seatKeyCol.length === 0) {
    await conn.execute("ALTER TABLE seats ADD COLUMN seat_key VARCHAR(100)");
    console.log("   ✅ Added 'seat_key' column");
    
    // Generate seat_key for existing seats
    await conn.execute(`
      UPDATE seats 
      SET seat_key = CONCAT(COALESCE(section_code, section, 'UNKNOWN'), '-', row, '-', col)
      WHERE seat_key IS NULL
    `);
    console.log("   ✅ Generated seat_key for existing seats");
    
    // Add unique index on seat_key
    try {
      await conn.execute("ALTER TABLE seats ADD UNIQUE INDEX idx_seat_key (seat_key)");
      console.log("   ✅ Added unique index on seat_key");
    } catch (e) {
      console.log("   ⏭️ Index on seat_key may already exist or duplicates found");
    }
  } else {
    console.log("   ⏭️ 'seat_key' column already exists");
  }

  // Update status ENUM to include REMOVED
  console.log("   Updating status ENUM to include REMOVED...");
  await conn.execute(`
    ALTER TABLE seats MODIFY COLUMN status ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'LOCKED', 'REMOVED') NOT NULL DEFAULT 'AVAILABLE'
  `);
  console.log("   ✅ Status ENUM updated!\n");

  // 4. Create index for faster seat lookups
  console.log("📦 Step 4: Creating indexes...");
  try {
    await conn.execute("CREATE INDEX idx_seats_event_section ON seats(event_id, section_code)");
    console.log("   ✅ Created index on (event_id, section_code)");
  } catch (e) {
    console.log("   ⏭️ Index may already exist");
  }

  try {
    await conn.execute("CREATE INDEX idx_layouts_event_status ON layouts(event_id, status)");
    console.log("   ✅ Created index on layouts(event_id, status)");
  } catch (e) {
    console.log("   ⏭️ Index may already exist");
  }

  await conn.end();
  console.log("\n🎉 Migration completed successfully!");
  console.log("\n📋 Summary of changes:");
  console.log("   - layouts.version: INT (incremental version number)");
  console.log("   - layouts.status: DRAFT | PUBLIC | ARCHIVED");
  console.log("   - layout_sections.section_code: stable identifier");
  console.log("   - seats.section_code: reference to section");
  console.log("   - seats.seat_key: unique identifier (section_code-row-col)");
  console.log("   - seats.status: AVAILABLE | RESERVED | SOLD | LOCKED | REMOVED");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});

