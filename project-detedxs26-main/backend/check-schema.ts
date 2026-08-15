import { query } from './src/db/mysql.js';

async function main() {
  const result = await query('SHOW CREATE TABLE events');
  console.log(result[0]['Create Table']);
  process.exit(0);
}

main();
