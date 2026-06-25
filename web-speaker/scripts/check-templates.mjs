import mysql from 'mysql2/promise';
import fs from 'fs';

const c = await mysql.createConnection({
  host:'202.92.4.66',
  port:3306,
  user:'jyndyeeuhosting_easyticketdb',
  password:'Easyticket@2026',
  database:'jyndyeeuhosting_easyticketdb'
});

// Check for duplicates
const [duplicates] = await c.execute(`
  SELECT purpose, COUNT(*) as cnt
  FROM email_templates
  WHERE is_active = 1
  GROUP BY purpose
  HAVING cnt > 1
`);

let output = 'Email Templates Check:\n';
output += '='.repeat(60) + '\n\n';

if (duplicates.length > 0) {
  output += '⚠️  DUPLICATES FOUND:\n';
  for (const d of duplicates) {
    output += `  - ${d.purpose}: ${d.cnt} active templates\n`;

    // Get details of duplicates
    const [details] = await c.execute(
      'SELECT id, name, created_at FROM email_templates WHERE purpose = ? AND is_active = 1 ORDER BY created_at',
      [d.purpose]
    );
    for (const det of details) {
      output += `    ID: ${det.id}\n`;
      output += `    Name: ${det.name}\n`;
      output += `    Created: ${det.created_at}\n\n`;
    }
  }
} else {
  output += '✅ No duplicates found\n';
}

output += '\n' + '='.repeat(60) + '\n';
output += 'All Templates:\n\n';

const [rows] = await c.execute('SELECT id, purpose, name, is_active, version, created_at FROM email_templates ORDER BY purpose, created_at');
for (const row of rows) {
  output += `${row.purpose} (v${row.version}) ${row.is_active ? '✅' : '⬜'}\n`;
  output += `  ID: ${row.id}\n`;
  output += `  Name: ${row.name}\n`;
  output += `  Created: ${row.created_at}\n\n`;
}

output += '='.repeat(60) + '\n';
output += 'Total: ' + rows.length;

fs.writeFileSync('templates-check.txt', output);
console.log('Written to templates-check.txt');
await c.end();

