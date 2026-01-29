import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
console.log("DATABASE_URL:", DATABASE_URL);

async function migrate() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("🔌 Connecting to database...");
  console.log("✅ Connected!\n");

  // 1. Create layouts table
  console.log("📦 Creating layouts table...");
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS layouts (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      event_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL DEFAULT 'Main Layout',
      status ENUM('DRAFT', 'PUBLIC') NOT NULL DEFAULT 'DRAFT',
      canvas_width INT NOT NULL DEFAULT 1000,
      canvas_height INT NOT NULL DEFAULT 600,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      UNIQUE KEY unique_public_layout (event_id, status)
    )
  `);
  console.log("✅ layouts table created!\n");

  // 2. Create layout_sections table
  console.log("📦 Creating layout_sections table...");
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS layout_sections (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      layout_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      rows_count INT NOT NULL DEFAULT 3,
      cols_count INT NOT NULL DEFAULT 4,
      seat_count INT DEFAULT NULL,
      seat_type ENUM('VIP', 'STANDARD', 'ECONOMY') NOT NULL DEFAULT 'STANDARD',
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      x DECIMAL(10,6) NOT NULL DEFAULT 0,
      y DECIMAL(10,6) NOT NULL DEFAULT 0,
      width DECIMAL(10,6) NOT NULL DEFAULT 0.2,
      height DECIMAL(10,6) NOT NULL DEFAULT 0.15,
      rotation INT DEFAULT 0,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (layout_id) REFERENCES layouts(id) ON DELETE CASCADE
    )
  `);
  console.log("✅ layout_sections table created!\n");

  // 3. Add layout_id and section_id to seats table
  console.log("🔍 Checking seats table for layout_id column...");
  const [columns] = await conn.execute("SHOW COLUMNS FROM seats LIKE 'layout_id'");
  if (columns.length === 0) {
    console.log("📦 Adding layout_id column to seats table...");
    await conn.execute("ALTER TABLE seats ADD COLUMN layout_id VARCHAR(36)");
    await conn.execute("ALTER TABLE seats ADD COLUMN section_id VARCHAR(36)");
    console.log("✅ Columns added!\n");
  } else {
    console.log("✅ layout_id column already exists!\n");
  }

  // 4. Create default DRAFT layout for each event without layout
  console.log("🌱 Creating default layouts for events...");
  const [events] = await conn.execute("SELECT id, name FROM events");
  for (const event of events) {
    const [existingLayouts] = await conn.execute(
      "SELECT id FROM layouts WHERE event_id = ?",
      [event.id]
    );
    if (existingLayouts.length === 0) {
      await conn.execute(
        "INSERT INTO layouts (event_id, name, status) VALUES (?, ?, 'DRAFT')",
        [event.id, `${event.name} - Main Layout`]
      );
      console.log(`   Created layout for: ${event.name}`);
    }
  }
  console.log("✅ Default layouts created!\n");

  await conn.end();
  console.log("🎉 Migration completed!");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});

