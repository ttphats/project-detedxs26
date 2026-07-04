import { query, queryOne, execute } from '../db/mysql.js'

// Ensure the system_settings table exists (auto-create on first use)
let tableChecked = false
async function ensureTable() {
  if (tableChecked) return
  await execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)
  tableChecked = true
}

/**
 * Get a setting value by key
 */
export async function getSetting(key: string): Promise<string | null> {
  await ensureTable()
  const row = await queryOne<{ setting_value: string }>(
    'SELECT setting_value FROM system_settings WHERE setting_key = ?',
    [key]
  )
  return row?.setting_value ?? null
}

/**
 * Set a setting value (upsert)
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await ensureTable()
  await execute(
    `INSERT INTO system_settings (setting_key, setting_value, updated_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
    [key, value]
  )
}

/**
 * Get all settings
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  await ensureTable()
  const rows = await query<{ setting_key: string; setting_value: string }>(
    'SELECT setting_key, setting_value FROM system_settings'
  )
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.setting_key] = row.setting_value
  }
  return result
}

// ── Convenience helpers ──

/**
 * Get notification email addresses (comma-separated → array)
 */
export async function getNotificationEmails(): Promise<string[]> {
  const value = await getSetting('notification_emails')
  if (!value) return []
  return value
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
}

/**
 * Set notification email addresses
 */
export async function setNotificationEmails(emails: string[]): Promise<void> {
  await setSetting('notification_emails', emails.join(','))
}
