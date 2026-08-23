import {FastifyRequest, FastifyReply} from 'fastify'
import {prisma} from '../db/prisma.js'
import {verifyAccessToken} from '../utils/helpers.js'
import {
  isHolderToken,
  normalizeHolderEmail,
  resolveHolderEmail,
} from '../utils/holder-token.js'
import puppeteer from 'puppeteer'

/**
 * GET /api/ticket/:orderNumber/pdf
 * Generate PDF ticket using Puppeteer
 */
export async function generateTicketPDF(
  request: FastifyRequest<{Params: {orderNumber: string}; Querystring: {token?: string}}>,
  reply: FastifyReply
) {
  try {
    const {orderNumber} = request.params
    const token = request.query.token

    // Validate token
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'Access token required',
      })
    }

    // Find order with all details
    const order = await prisma.order.findUnique({
      where: {orderNumber},
      include: {
        event: true,
        orderItems: {include: {seat: true}},
      },
    })

    if (!order) {
      return reply.status(404).send({
        success: false,
        error: 'Order not found',
      })
    }

    // Verify token. The order token downloads the whole order; a holder token
    // downloads only that attendee's own tickets, so sharing an order with
    // strangers does not hand each of them everybody else's PDF.
    let holderEmail: string | null = null
    if (!order.accessTokenHash || !verifyAccessToken(token, order.accessTokenHash)) {
      if (isHolderToken(token)) {
        holderEmail = resolveHolderEmail(
          orderNumber,
          token,
          order.orderItems.map((item: any) => item.attendeeEmail),
        )
      }
      if (!holderEmail) {
        return reply.status(403).send({
          success: false,
          error: 'Invalid or expired token',
        })
      }
    }

    // Format event date
    const eventDate = new Date(order.event.eventDate)
    const formattedDate = eventDate.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const formattedTime = eventDate.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })

    // Ensure per-ticket QR units exist
    try {
      const {ensureTicketUnitsForOrder} = await import('../utils/ticket-unit.js')
      await ensureTicketUnitsForOrder(order.id)
    } catch (e) {
      console.warn('[PDF] ensureTicketUnitsForOrder:', e)
    }

    // Reload items with ticket codes
    const {query} = await import('../db/mysql.js')
    const {humanizeSeatType} = await import('../utils/ticket-lines.js')
    const allUnitRows = await query<{
      ticket_code: string | null
      qr_code_url: string | null
      seat_number: string
      seat_type: string
      price: number
      ticket_type_name: string | null
      attendee_name: string | null
      attendee_email: string | null
    }>(
      `SELECT oi.ticket_code, oi.qr_code_url, oi.seat_number, oi.seat_type, oi.price,
              COALESCE(tt.name, tt2.name) AS ticket_type_name,
              oi.attendee_name, oi.attendee_email
       FROM order_items oi
       LEFT JOIN seats s ON s.id = oi.seat_id
       LEFT JOIN ticket_types tt ON tt.id = s.ticket_type_id
       LEFT JOIN ticket_types tt2 ON tt2.id = oi.ticket_type_id
       WHERE oi.order_id = ?
       ORDER BY oi.created_at ASC`,
      [order.id],
    )

    const unitRows = holderEmail
      ? allUnitRows.filter(
          (r) => normalizeHolderEmail(r.attendee_email || '') === holderEmail,
        )
      : allUnitRows

    if (holderEmail && unitRows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: 'Ticket not found',
      })
    }

    const ticketUnits = unitRows.map((r, i) => ({
      index: i + 1,
      ticketCode: r.ticket_code || `UNIT-${i + 1}`,
      qrCodeUrl: r.qr_code_url || order.qrCodeUrl,
      typeName:
        (r.ticket_type_name && String(r.ticket_type_name).trim()) ||
        humanizeSeatType(r.seat_type),
      seatNumber: r.seat_number,
      price: Number(r.price),
    }))

    // Generate HTML template for PDF
    const html = generateTicketHTML({
      orderNumber: order.orderNumber,
      // A scoped holder gets their own name and their own subtotal on the PDF,
      // not the buyer's name and a total covering tickets they cannot see.
      customerName: holderEmail
        ? unitRows.find((r) => r.attendee_name)?.attendee_name || order.customerName
        : order.customerName,
      eventName: order.event.name,
      eventDate: formattedDate,
      eventTime: formattedTime,
      eventVenue: order.event.venue,
      seats: unitRows.map((r) => ({
        number: r.seat_number,
        type: r.seat_type,
      })),
      ticketUnits,
      qrCodeUrl: holderEmail ? null : order.qrCodeUrl,
      totalAmount: holderEmail
        ? unitRows.reduce((sum, r) => sum + Number(r.price), 0)
        : Number(order.totalAmount),
    })

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setContent(html, {waitUntil: 'domcontentloaded'})

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {top: '20px', bottom: '20px', left: '20px', right: '20px'},
    })

    await browser.close()

    // Return PDF
    return reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="ticket-${orderNumber}.pdf"`)
      .send(pdfBuffer)
  } catch (error) {
    console.error('PDF generation error:', error)
    return reply.status(500).send({
      success: false,
      error: 'Failed to generate PDF',
    })
  }
}

/**
 * Generate HTML template for ticket PDF
 * Structure matches web design: Status → Event Info → Attendee → Seats → QR
 */
function generateTicketHTML(data: {
  orderNumber: string
  customerName: string
  eventName: string
  eventDate: string
  eventTime: string
  eventVenue: string
  seats: Array<{number: string; type: string}>
  ticketUnits?: Array<{
    index: number
    ticketCode: string
    qrCodeUrl: string | null
    typeName: string
    seatNumber: string
    price: number
  }>
  qrCodeUrl: string | null
  totalAmount: number
}): string {
  const units = data.ticketUnits || []
  const unitsSection =
    units.length > 0
      ? `
      <div class="section">
        <div class="section-header">
          <span class="section-icon">📱</span>
          <span class="section-title">Check-in QR (${units.length} vé)</span>
        </div>
        <div class="units-grid">
          ${units
            .map(
              (u) => `
          <div class="unit-card">
            <div class="unit-title">${u.typeName}</div>
            <div class="unit-code">${u.ticketCode}</div>
            ${
              u.qrCodeUrl
                ? `<div class="unit-qr"><img src="${u.qrCodeUrl}" alt="${u.ticketCode}" /></div>`
                : ''
            }
            <div class="unit-price">${Number(u.price).toLocaleString('vi-VN')}đ</div>
          </div>`,
            )
            .join('')}
        </div>
        <div class="qr-hint">Mỗi QR = 1 lượt check-in · quét từng người</div>
      </div>`
      : data.qrCodeUrl
        ? `
      <div class="section">
        <div class="section-header">
          <span class="section-icon">📱</span>
          <span class="section-title">Mã check-in</span>
        </div>
        <div class="qr-section">
          <div class="qr-container">
            <img src="${data.qrCodeUrl}" alt="QR Code" />
          </div>
          <div class="qr-hint">Quét mã này tại quầy check-in</div>
        </div>
      </div>`
        : ''
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vé ${data.orderNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #000;
      padding: 20px;
    }
    .ticket {
      max-width: 650px;
      margin: 0 auto;
      background: linear-gradient(to bottom, #18181b 0%, #000 100%);
      border-radius: 20px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 0 40px rgba(220, 38, 38, 0.3);
    }
    .units-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .unit-card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 12px;
      text-align: center;
      page-break-inside: avoid;
    }
    .unit-title {
      color: #fff;
      font-weight: 800;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .unit-code {
      color: #e62b1e;
      font-family: ui-monospace, monospace;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .unit-qr img {
      width: 120px;
      height: 120px;
      background: #fff;
      border-radius: 8px;
      padding: 6px;
    }
    .unit-price {
      color: #9ca3af;
      font-size: 11px;
      margin-top: 6px;
    }
    /* Logo Section */
    .logo {
      background: #000;
      padding: 16px 24px;
      text-align: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .logo-text {
      font-size: 22px;
      font-weight: 700;
      color: white;
      letter-spacing: -0.5px;
    }
    .logo-ted {
      color: white;
    }
    .logo-x {
      color: #dc2626;
    }
    .logo-org {
      color: white;
    }
    /* Header Section - Event Info */
    .header {
      background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%);
      padding: 24px;
      position: relative;
    }
    .status-badge {
      display: inline-block;
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .event-name {
      font-size: 24px;
      font-weight: 700;
      color: white;
      margin-bottom: 16px;
      line-height: 1.2;
    }
    .event-details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .detail-item {
      display: flex;
      gap: 8px;
      align-items: start;
    }
    .detail-icon {
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }
    .detail-content {
      flex: 1;
    }
    .detail-label {
      font-size: 9px;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .detail-value {
      font-size: 12px;
      color: white;
      font-weight: 500;
    }
    .venue-full {
      grid-column: span 2;
    }

    /* Perforated Line */
    .perforation {
      height: 20px;
      position: relative;
      background: #000;
    }
    .perforation::before,
    .perforation::after {
      content: '';
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 12px;
      height: 20px;
      background: #000;
      border-radius: 0 12px 12px 0;
    }
    .perforation::before {
      left: -1px;
    }
    .perforation::after {
      right: -1px;
      border-radius: 12px 0 0 12px;
    }
    .perforation-line {
      position: absolute;
      left: 12px;
      right: 12px;
      top: 50%;
      border-top: 2px dashed rgba(255, 255, 255, 0.2);
    }

    /* Bottom Section */
    .body {
      padding: 20px 24px;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
    }
    .section-icon {
      font-size: 14px;
      color: #6b7280;
    }
    .section-title {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    /* Attendee Info */
    .attendee-name {
      font-size: 18px;
      font-weight: 700;
      color: white;
      margin-bottom: 6px;
    }
    .order-meta {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #9ca3af;
    }
    .order-number {
      background: rgba(255, 255, 255, 0.05);
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
    }

    /* Seats */
    .seats-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .seat-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 10px 16px;
      text-align: center;
      min-width: 80px;
    }
    .seat-card.vip {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.2));
      border-color: rgba(245, 158, 11, 0.3);
    }
    .seat-number {
      font-size: 16px;
      font-weight: 700;
      color: white;
      margin-bottom: 2px;
    }
    .seat-type {
      font-size: 10px;
      color: #9ca3af;
    }

    /* QR Code */
    .qr-section {
      text-align: center;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
    }
    .qr-container {
      display: inline-block;
      padding: 12px;
      background: white;
      border-radius: 10px;
      margin-top: 8px;
    }
    .qr-container img {
      width: 140px;
      height: 140px;
      display: block;
    }
    .qr-hint {
      font-size: 10px;
      color: #6b7280;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="ticket">
    <!-- Logo -->
    <div class="logo">
      <div class="logo-text">
        <span class="logo-ted">TED</span><span class="logo-x">x</span><span class="logo-org">FPTUniversityHCMC</span>
      </div>
    </div>

    <!-- Header: Event Info -->
    <div class="header">
      <div class="status-badge">✓ Đã xác nhận</div>
      <h1 class="event-name">${data.eventName}</h1>

      <div class="event-details">
        <div class="detail-item">
          <div class="detail-icon">📅</div>
          <div class="detail-content">
            <div class="detail-label">Ngày</div>
            <div class="detail-value">${data.eventDate}</div>
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-icon">🕐</div>
          <div class="detail-content">
            <div class="detail-label">Giờ</div>
            <div class="detail-value">${data.eventTime}</div>
          </div>
        </div>

        <div class="detail-item venue-full">
          <div class="detail-icon">📍</div>
          <div class="detail-content">
            <div class="detail-label">Địa điểm</div>
            <div class="detail-value">${data.eventVenue}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Perforated Line -->
    <div class="perforation">
      <div class="perforation-line"></div>
    </div>

    <!-- Body: Attendee, Seats, QR -->
    <div class="body">
      <!-- Attendee Info -->
      <div class="section">
        <div class="section-header">
          <span class="section-icon">👤</span>
          <span class="section-title">Thông tin người tham dự</span>
        </div>
        <div class="attendee-name">${data.customerName}</div>
        <div class="order-meta">
          <span class="order-number">#${data.orderNumber}</span>
          <span>${data.seats.length} vé</span>
        </div>
      </div>

      <!-- Ticket types / seats summary -->
      <div class="section">
        <div class="section-header">
          <span class="section-icon">🎫</span>
          <span class="section-title">${units.length > 0 ? 'Loại vé' : 'Ghế ngồi'}</span>
        </div>
        <div class="seats-grid">
          ${
            units.length > 0
              ? units
                  .map(
                    (u) => `
          <div class="seat-card">
            <div class="seat-number">${u.typeName}</div>
            <div class="seat-type">${u.ticketCode}</div>
          </div>`,
                  )
                  .join('')
              : data.seats
                  .map(
                    (seat) => `
          <div class="seat-card ${seat.type === 'VIP' ? 'vip' : ''}">
            <div class="seat-number">${seat.number}</div>
            <div class="seat-type">${seat.type}</div>
          </div>`,
                  )
                  .join('')
          }
        </div>
      </div>

      <!-- Per-ticket QR units (model B) or legacy single QR -->
      ${unitsSection}
    </div>
  </div>
</body>
</html>
  `
}
