/**
 * Multi-ticket confirmation email HTML (model B: 1 QR per ticket unit).
 * Used when TICKET_CONFIRMED is sent after PAID.
 *
 * Font stacks here must lead with a face that carries Vietnamese. Helvetica
 * and Helvetica Neue cover Latin-1 but not Vietnamese Extended (U+1EA0–1EF9)
 * nor ư/ơ/đ, so a client picking one of those renders most of the text in it
 * and substitutes a different font for just the accented letters — "CỬA" and
 * "Loại vé" come out visibly mismatched. Arial carries the full range, and
 * Segoe UI / Tahoma / Roboto cover the clients that lack it.
 */

export type EmailTicketUnit = {
  ticketCode: string
  qrCodeUrl: string
  typeName: string
  seatNumber?: string
  price: number
  index?: number
}

export type TicketConfirmEmailInput = {
  customerName: string
  eventName: string
  eventDate: string
  eventTime: string
  eventVenue: string
  eventAddress?: string
  orderNumber: string
  totalAmount: number
  ticketUrl: string
  ticketUnits: EmailTicketUnit[]
  /** Optional summary string */
  seatsSummary?: string
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {style: 'currency', currency: 'VND'}).format(amount)
}

function esc(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Table rows / cards for each unit — also usable as {{ticketUnitsHtml}} inject. */
export function buildTicketUnitsHtml(units: EmailTicketUnit[]): string {
  if (!units.length) return ''
  return units
    .map((u, i) => {
      const n = u.index || i + 1
      return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
  <tr>
    <td style="background:linear-gradient(135deg,#ea251a 0%,#b91c14 100%);padding:12px 16px;">
      <table width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
        <td style="font-size:11px;font-weight:900;color:#fff;letter-spacing:1px;text-transform:uppercase;">
          VÉ ${n}/${units.length} · ${esc(u.typeName)}
        </td>
        <td align="right" style="font-size:11px;font-weight:700;color:#fff;font-family:monospace;">
          ${esc(u.ticketCode)}
        </td>
      </tr></table>
    </td>
  </tr>
  <tr>
    <td style="padding:16px;">
      <table width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
        <td style="vertical-align:top;width:55%;padding-right:12px;">
          <p style="margin:0;font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Loại vé</p>
          <p style="margin:4px 0 12px 0;font-size:18px;font-weight:900;color:#000;">${esc(
            u.typeName
          )}</p>
          <p style="margin:0;font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Mã check-in</p>
          <p style="margin:4px 0 12px 0;font-size:14px;font-weight:800;color:#ea251a;font-family:monospace;">${esc(
            u.ticketCode
          )}</p>
          <p style="margin:0;font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Giá</p>
          <p style="margin:4px 0 0 0;font-size:15px;font-weight:800;color:#000;">${formatVND(
            u.price
          )}</p>
        </td>
        <td style="vertical-align:top;width:45%;text-align:center;">
          <p style="margin:0 0 8px 0;font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Quét để check-in</p>
          <img src="${esc(u.qrCodeUrl)}" alt="QR ${esc(
        u.ticketCode
      )}" width="120" height="120" style="display:block;margin:0 auto;border-radius:8px;border:3px solid #f4f4f4;" />
        </td>
      </tr></table>
    </td>
  </tr>
</table>`
    })
    .join('')
}

/**
 * Single-QR fallback for {{ticketUnitsHtml}}.
 *
 * Templates that render {{ticketUnitsHtml}} instead of their own {{qrCodeUrl}}
 * would show no QR at all on an order whose items never got ticket codes
 * (orders predating the per-ticket model). Fall back to the order-level QR so
 * those emails still carry something scannable.
 */
export function buildFallbackQrHtml(qrCodeUrl: string, caption: string): string {
  if (!qrCodeUrl) return ''
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;background:#ffffff;border-radius:8px;">
  <tr>
    <td style="padding:12px;text-align:center;">
      <img src="${esc(
        qrCodeUrl
      )}" alt="QR" width="160" height="160" style="display:block;width:160px;height:160px;border:0;" />
      ${
        caption
          ? `<p style="margin:10px 0 0 0;font-size:12px;font-family:monospace;font-weight:700;color:#111;">${esc(
              caption
            )}</p>`
          : ''
      }
    </td>
  </tr>
</table>`
}

export function buildTicketConfirmationEmailHtml(data: TicketConfirmEmailInput): string {
  const unitsHtml = buildTicketUnitsHtml(data.ticketUnits)
  const count = data.ticketUnits.length

  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Vé điện tử - ${esc(data.eventName)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,'Segoe UI',Tahoma,Roboto,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f4;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
    <tr><td style="text-align:center;padding-bottom:24px;">
      <div style="display:inline-block;background:#ea251a;padding:8px 20px;">
        <span style="font-size:10px;font-weight:900;color:#fff;letter-spacing:3px;">✓ THANH TOÁN THÀNH CÔNG</span>
      </div>
    </td></tr>
    <tr><td style="text-align:center;padding-bottom:24px;">
      <h2 style="margin:0 0 12px;font-size:28px;font-weight:900;color:#000;">TED<span style="font-weight:300;">x</span></h2>
      <p style="margin:0;font-size:11px;letter-spacing:2px;color:#666;text-transform:uppercase;">FPT University HCMC</p>
      <h1 style="margin:16px 0 8px;font-size:26px;font-weight:900;color:#000;line-height:1.15;">${esc(
        data.eventName
      )}</h1>
      <p style="margin:0;font-size:12px;color:#333;">${esc(data.customerName)} · ${esc(
    data.eventDate
  )}</p>
    </td></tr>
    <tr><td style="background:#fff;border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:12px 20px;text-align:center;">
      <span style="font-size:10px;font-weight:900;letter-spacing:1px;color:#000;">${esc(
        data.eventVenue
      )}</span>
      <span style="color:#ea251a;margin:0 10px;">●</span>
      <span style="font-size:10px;font-weight:900;letter-spacing:1px;color:#000;">${count} VÉ</span>
      <span style="color:#ea251a;margin:0 10px;">●</span>
      <span style="font-size:10px;font-weight:900;letter-spacing:1px;color:#ea251a;">${formatVND(
        data.totalAmount
      )}</span>
    </td></tr>
    <tr><td style="padding:24px 0 8px;font-size:12px;font-weight:800;color:#000;letter-spacing:1px;text-transform:uppercase;">
      Danh sách vé · mỗi QR là 1 lượt check-in
    </td></tr>
    <tr><td>${unitsHtml}</td></tr>
    <tr><td style="background:#fff;border-radius:12px;padding:16px 20px;margin-top:8px;">
      <table width="100%" cellspacing="0" cellpadding="0"><tr>
        <td style="font-size:11px;color:#666;text-transform:uppercase;font-weight:700;">Tổng thanh toán</td>
        <td align="right" style="font-size:22px;font-weight:900;color:#ea251a;">${formatVND(
          data.totalAmount
        )}</td>
      </tr>
      <tr><td colspan="2" style="padding-top:8px;font-size:12px;color:#333;">Mã đơn: <strong>${esc(
        data.orderNumber
      )}</strong> · ${esc(data.eventTime)} · ${esc(data.eventVenue)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="text-align:center;padding:28px 0 12px;">
      <a href="${esc(
        data.ticketUrl
      )}" style="display:inline-block;background:#ea251a;color:#fff;padding:16px 36px;font-size:13px;font-weight:900;text-decoration:none;letter-spacing:2px;border-radius:4px;margin:0 6px 8px;">🎫 XEM VÉ ONLINE</a>
    </td></tr>
    <tr><td style="padding:8px 12px 32px;font-size:11px;color:#444;line-height:1.5;text-align:center;">
      Link vé: <a href="${esc(data.ticketUrl)}" style="color:#ea251a;word-break:break-all;">${esc(
    data.ticketUrl
  )}</a><br/><br/>
      Mỗi mã <strong>TKT-…</strong> / QR chỉ check-in <strong>1 lần</strong>. Không chia sẻ QR.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}
