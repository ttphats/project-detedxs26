import { execute, query } from './src/db/mysql.js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    const sqlFile = fs.readFileSync('C:/Users/phphu/.gemini/antigravity-ide/brain/4195e0fa-5631-43b1-9893-42831da82d7a/scratch/migrate-promotions.sql', 'utf8');
    const statements = sqlFile.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    console.log(`Found ${statements.length} statements`);
    
    for (let i = 0; i < statements.length; i++) {
      let stmt = statements[i];
      // strip out comments
      stmt = stmt.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
      if (!stmt.trim()) continue;

      console.log(`Executing statement ${i + 1}...`);
      await query(stmt);
    }
    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
