#!/usr/bin/env node
/**
 * Update email templates with purpose field
 */

import mysql from 'mysql2/promise';

const config = {
  host: '202.92.4.66',
  port: 3306,
  user: 'jyndyeeuhosting_easyticketdb',
  password: 'Easyticket@2026',
  database: 'jyndyeeuhosting_easyticketdb',
};

const mapping = [
  ['Chờ thanh toán', 'PAYMENT_PENDING'],
  ['Đã nhận thông tin thanh toán', 'PAYMENT_RECEIVED'],
  ['Thanh toán thành công', 'PAYMENT_CONFIRMED'],
  ['Từ chối thanh toán', 'PAYMENT_REJECTED'],
  ['Vé hợp lệ', 'TICKET_CONFIRMED'],
  ['Vé bị hủy', 'TICKET_CANCELLED'],
  ['Nhắc lịch sự kiện', 'EVENT_REMINDER'],
  ['Check-in thành công', 'CHECKIN_CONFIRMATION'],
  ['Thông báo Admin', 'ADMIN_NOTIFICATION'],
];

async function main() {
  const connection = await mysql.createConnection(config);
  console.log('Connected to database\n');

  for (const [namePrefix, purpose] of mapping) {
    const [result] = await connection.execute(
      'UPDATE email_templates SET purpose = ? WHERE name LIKE ?',
      [purpose, namePrefix + '%']
    );
    console.log(`${namePrefix} -> ${purpose}: ${result.affectedRows} updated`);
  }

  // Set first template of each purpose as default
  console.log('\nSetting default templates...');
  for (const [, purpose] of mapping) {
    // First reset all defaults for this purpose
    await connection.execute(
      'UPDATE email_templates SET is_default = FALSE WHERE purpose = ?',
      [purpose]
    );
    // Then set the first active one as default
    const [rows] = await connection.execute(
      'SELECT id FROM email_templates WHERE purpose = ? AND is_active = TRUE LIMIT 1',
      [purpose]
    );
    if (rows.length > 0) {
      await connection.execute(
        'UPDATE email_templates SET is_default = TRUE WHERE id = ?',
        [rows[0].id]
      );
      console.log(`${purpose}: set default`);
    }
  }

  // Show results
  console.log('\nFinal state:');
  const [templates] = await connection.execute(
    'SELECT name, purpose, is_active, is_default FROM email_templates ORDER BY purpose'
  );
  templates.forEach(t => {
    console.log(`- ${t.name} | ${t.purpose} | active:${t.is_active} | default:${t.is_default}`);
  });

  await connection.end();
  console.log('\nDone!');
}

main().catch(console.error);

