/**
 * Default TICKET_CONFIRMED HTML for Admin Email Templates (DB).
 * Variables only — no JS interpolation. Multi-ticket QR via {{ticketUnitsHtml}}.
 *
 * Variables:
 *  {{customerName}} {{eventName}} {{eventDate}} {{eventTime}} {{eventVenue}}
 *  {{eventAddress}} {{orderNumber}} {{seats}} {{ticketCount}} {{totalAmount}}
 *  {{qrCodeUrl}} {{ticketUrl}} {{ticketUnitsHtml}}
 */

export const TICKET_CONFIRMED_SUBJECT = 'Vé điện tử TEDx — {{orderNumber}} · {{ticketCount}} vé'

export const TICKET_CONFIRMED_VARIABLES = [
  'customerName',
  'eventName',
  'eventDate',
  'eventTime',
  'eventVenue',
  'eventAddress',
  'orderNumber',
  'seats',
  'ticketCount',
  'totalAmount',
  'qrCodeUrl',
  'ticketUrl',
  'ticketUnitsHtml',
]

/** Admin-setup HTML (Mustache). Rendered only via replaceVariables — never overridden in code. */
export const TICKET_CONFIRMED_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vé điện tử - {{eventName}}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f4;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">

          <tr><td style="text-align:center;padding-bottom:24px;">
            <div style="display:inline-block;background:#ea251a;padding:8px 20px;">
              <span style="font-size:10px;font-weight:900;color:#ffffff;letter-spacing:3px;">✓ THANH TOÁN THÀNH CÔNG</span>
            </div>
          </td></tr>

          <tr><td style="text-align:center;padding-bottom:20px;">
            <h2 style="margin:0 0 8px 0;font-size:28px;font-weight:900;color:#000;">TED<span style="font-weight:300;">x</span></h2>
            <p style="margin:0;font-size:11px;letter-spacing:2px;color:#666;text-transform:uppercase;">FPT University HCMC</p>
            <h1 style="margin:16px 0 8px;font-size:24px;font-weight:900;color:#000;line-height:1.2;">{{eventName}}</h1>
            <p style="margin:0;font-size:12px;color:#333;">{{customerName}} · {{eventDate}}</p>
          </td></tr>

          <tr><td style="background:#fff;border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:12px 20px;text-align:center;">
            <span style="font-size:10px;font-weight:900;letter-spacing:1px;color:#000;">{{eventVenue}}</span>
            <span style="color:#ea251a;margin:0 10px;">●</span>
            <span style="font-size:10px;font-weight:900;letter-spacing:1px;color:#000;">{{ticketCount}} VÉ</span>
            <span style="color:#ea251a;margin:0 10px;">●</span>
            <span style="font-size:10px;font-weight:900;letter-spacing:1px;color:#ea251a;">{{totalAmount}}</span>
          </td></tr>

          <tr><td style="padding:24px 0 8px;font-size:12px;font-weight:800;color:#000;letter-spacing:1px;text-transform:uppercase;">
            Thông tin đơn
          </td></tr>
          <tr><td style="background:#fff;border-radius:12px;padding:16px 20px;">
            <p style="margin:0 0 6px;font-size:13px;color:#333;"><strong>Mã đơn:</strong> {{orderNumber}}</p>
            <p style="margin:0 0 6px;font-size:13px;color:#333;"><strong>Thời gian:</strong> {{eventDate}} · {{eventTime}}</p>
            <p style="margin:0 0 6px;font-size:13px;color:#333;"><strong>Địa điểm:</strong> {{eventVenue}}</p>
            <p style="margin:0;font-size:13px;color:#333;"><strong>Tóm tắt:</strong> {{seats}}</p>
          </td></tr>

          <!-- MULTI-TICKET: each unit QR (filled by backend from ticketUnits) -->
          <tr><td style="padding:28px 0 8px;font-size:12px;font-weight:800;color:#000;letter-spacing:1px;text-transform:uppercase;">
            Danh sách vé · mỗi QR = 1 check-in
          </td></tr>
          <tr><td>
            {{ticketUnitsHtml}}
          </td></tr>

          <tr><td style="background:#fff;border-radius:12px;padding:16px 20px;margin-top:8px;">
            <table width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="font-size:11px;color:#666;text-transform:uppercase;font-weight:700;">Tổng thanh toán</td>
              <td align="right" style="font-size:22px;font-weight:900;color:#ea251a;">{{totalAmount}}</td>
            </tr></table>
          </td></tr>

          <tr><td style="text-align:center;padding:28px 0 12px;">
            <a href="{{ticketUrl}}" style="display:inline-block;background:#ea251a;color:#fff;padding:16px 36px;font-size:13px;font-weight:900;text-decoration:none;letter-spacing:2px;border-radius:4px;margin:0 6px 8px;">🎫 XEM VÉ ONLINE</a>
          </td></tr>

          <tr><td style="padding:8px 12px 32px;font-size:11px;color:#444;line-height:1.5;text-align:center;">
            Link vé: <a href="{{ticketUrl}}" style="color:#ea251a;word-break:break-all;">{{ticketUrl}}</a><br/><br/>
            Mỗi mã TKT / QR chỉ check-in 1 lần. Không chia sẻ QR.
          </td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
