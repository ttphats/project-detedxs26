/**
 * Per-ticket unit identity (model B: 1 QR = 1 order_item).
 * ticket_code is what admin QR scanner resolves.
 */
import crypto from 'crypto'
import {execute, query} from '../db/mysql.js'
import QRCode from 'qrcode'
import {uploadImage} from '../services/upload.service.js'
import {config} from '../config/env.js'

let ensured = false

/** Ensure order_items has per-ticket columns (safe on older DBs). */
export async function ensureOrderItemTicketColumns(): Promise<void> {
  if (ensured) return
  const cols = [
    {
      name: 'ticket_code',
      ddl: `ALTER TABLE order_items ADD COLUMN ticket_code VARCHAR(32) NULL`,
    },
    {
      name: 'qr_code_url',
      ddl: `ALTER TABLE order_items ADD COLUMN qr_code_url VARCHAR(500) NULL`,
    },
    {
      name: 'checked_in_at',
      ddl: `ALTER TABLE order_items ADD COLUMN checked_in_at DATETIME NULL`,
    },
    {
      name: 'checked_in_by',
      ddl: `ALTER TABLE order_items ADD COLUMN checked_in_by VARCHAR(36) NULL`,
    },
    // Ticket holder captured at checkout — one per ticket, so a buyer can pay
    // for several people and each gets their own ticket emailed to them.
    {
      name: 'attendee_name',
      ddl: `ALTER TABLE order_items ADD COLUMN attendee_name VARCHAR(255) NULL`,
    },
    {
      name: 'attendee_email',
      ddl: `ALTER TABLE order_items ADD COLUMN attendee_email VARCHAR(255) NULL`,
    },
    {
      name: 'attendee_phone',
      ddl: `ALTER TABLE order_items ADD COLUMN attendee_phone VARCHAR(50) NULL`,
    },
  ]
  for (const c of cols) {
    try {
      const rows = await query<{cnt: number}>(
        `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = ?`,
        [c.name],
      )
      if (!rows[0] || Number(rows[0].cnt) === 0) {
        await execute(c.ddl, [])
        console.log(`[ticket-unit] added column order_items.${c.name}`)
      }
    } catch (e) {
      console.warn(`[ticket-unit] ensure ${c.name}:`, e)
    }
  }
  // Unique index on ticket_code (ignore if exists)
  try {
    await execute(
      `CREATE UNIQUE INDEX uq_order_items_ticket_code ON order_items (ticket_code)`,
      [],
    )
  } catch {
    // exists
  }
  ensured = true
}

/** Short unique public code: TKT-XXXXXXXX ( Crockford-ish uppercase ). */
export function generateTicketCode(): string {
  const raw = crypto.randomBytes(5).toString('hex').toUpperCase() // 10 hex
  return `TKT-${raw}`
}

/** Payload encoded in QR — scanners only need the code. */
export function ticketCheckInPayload(ticketCode: string): string {
  // Compact payload for offline-friendly scanners; also works as plain code paste.
  return ticketCode
}

export async function generateUnitQrDataUrl(ticketCode: string): Promise<string> {
  return QRCode.toDataURL(ticketCheckInPayload(ticketCode), {
    errorCorrectionLevel: 'H',
    margin: 3,
    width: 360,
    color: {dark: '#000000', light: '#FFFFFF'},
  })
}

export async function generateAndUploadUnitQr(ticketCode: string): Promise<string> {
  const dataUrl = await generateUnitQrDataUrl(ticketCode)
  try {
    const upload = await uploadImage(dataUrl, 'qr-codes/tickets')
    if (upload.success && upload.data?.url) return upload.data.url
  } catch (e) {
    console.warn('[ticket-unit] Cloudinary upload failed, using data URL', e)
  }
  return dataUrl
}

/**
 * Ensure every order_item of a PAID order has ticket_code + qr_code_url.
 * Idempotent — skips items that already have a code.
 */
export async function ensureTicketUnitsForOrder(orderId: string): Promise<
  Array<{id: string; ticketCode: string; qrCodeUrl: string}>
> {
  await ensureOrderItemTicketColumns()

  const items = await query<{
    id: string
    ticket_code: string | null
    qr_code_url: string | null
  }>(
    `SELECT id, ticket_code, qr_code_url FROM order_items WHERE order_id = ?`,
    [orderId],
  )

  const out: Array<{id: string; ticketCode: string; qrCodeUrl: string}> = []

  for (const item of items) {
    if (item.ticket_code && item.qr_code_url) {
      out.push({
        id: item.id,
        ticketCode: item.ticket_code,
        qrCodeUrl: item.qr_code_url,
      })
      continue
    }

    let code = item.ticket_code
    if (!code) {
      // Retry on rare unique collision
      for (let i = 0; i < 5; i++) {
        code = generateTicketCode()
        try {
          await execute(
            `UPDATE order_items SET ticket_code = ? WHERE id = ? AND (ticket_code IS NULL OR ticket_code = '')`,
            [code, item.id],
          )
          break
        } catch {
          code = null
        }
      }
      if (!code) throw new Error(`Failed to assign ticket_code for item ${item.id}`)
    }

    let qrUrl = item.qr_code_url
    if (!qrUrl) {
      qrUrl = await generateAndUploadUnitQr(code)
      await execute(`UPDATE order_items SET qr_code_url = ? WHERE id = ?`, [qrUrl, item.id])
    }

    out.push({id: item.id, ticketCode: code, qrCodeUrl: qrUrl})
  }

  return out
}

/** Optional: customer ticket page can still link by order (not per-unit URL required). */
export function orderTicketPageUrl(orderNumber: string, accessToken: string): string {
  return `${config.clientUrl}/ticket/${orderNumber}?token=${accessToken}`
}
