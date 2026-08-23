import {query, queryOne, execute} from '../db/mysql.js'

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
  const row = await queryOne<{setting_value: string}>(
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
  const rows = await query<{setting_key: string; setting_value: string}>(
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

// ── On-duty staff helpers ──

/**
 * Get the current on-duty staff email (single address)
 */
export async function getOnDutyEmail(): Promise<string | null> {
  const value = await getSetting('on_duty_email')
  if (!value || value.trim().length === 0) return null
  return value.trim()
}

/**
 * Set the current on-duty staff email
 */
export async function setOnDutyEmail(email: string): Promise<void> {
  await setSetting('on_duty_email', email.trim())
}

// ── Ticket sales gate ──

const DEFAULT_SALES_OPENS_AT = '2026-08-26T08:00:00+07:00'

export type TicketSalesOverride = 'auto' | 'open' | 'closed'

export type TicketSalesConfig = {
  /** Computed: should the purchase flow be shown right now? */
  salesOpen: boolean
  opensAt: string
  /**
   * auto    — open automatically when `opensAt` is reached
   * open    — force open now (ignore countdown)
   * closed  — force closed (ignore countdown; for tests / emergency)
   */
  override: TicketSalesOverride
}

function parseOverride(raw: string | null, legacyOpen: string | null): TicketSalesOverride {
  if (raw === 'auto' || raw === 'open' || raw === 'closed') return raw
  // Legacy: explicit true = force-open. Anything else follows the countdown.
  if (legacyOpen === 'true') return 'open'
  return 'auto'
}

function computeSalesOpen(override: TicketSalesOverride, opensAt: string): boolean {
  if (override === 'open') return true
  if (override === 'closed') return false
  const target = new Date(opensAt)
  if (Number.isNaN(target.getTime())) return false
  return Date.now() >= target.getTime()
}

/**
 * Public + admin: whether the ticket-purchase flow is open.
 *
 * `auto` (default) opens itself once `opensAt` is reached.
 * Admins can force open / force closed to test without waiting.
 */
export async function getTicketSalesConfig(): Promise<TicketSalesConfig> {
  const overrideRaw = await getSetting('ticket_sales_override')
  const openRaw = await getSetting('ticket_sales_open')
  const opensAt = (await getSetting('ticket_sales_opens_at')) || DEFAULT_SALES_OPENS_AT
  const override = parseOverride(overrideRaw, openRaw)

  return {
    salesOpen: computeSalesOpen(override, opensAt),
    opensAt,
    override,
  }
}

export async function setTicketSalesConfig(input: {
  override?: TicketSalesOverride
  salesOpen?: boolean
  opensAt?: string
}): Promise<TicketSalesConfig> {
  if (input.override === 'auto' || input.override === 'open' || input.override === 'closed') {
    await setSetting('ticket_sales_override', input.override)
    await setSetting('ticket_sales_open', input.override === 'open' ? 'true' : 'false')
  } else if (typeof input.salesOpen === 'boolean') {
    const next: TicketSalesOverride = input.salesOpen ? 'open' : 'auto'
    await setSetting('ticket_sales_override', next)
    await setSetting('ticket_sales_open', input.salesOpen ? 'true' : 'false')
  }
  if (typeof input.opensAt === 'string' && input.opensAt.trim().length > 0) {
    await setSetting('ticket_sales_opens_at', input.opensAt.trim())
  }
  return getTicketSalesConfig()
}
