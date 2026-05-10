import {FastifyRequest, FastifyReply} from 'fastify'
import {prisma} from '../db/prisma.js'
import {verifyAccessToken} from '../utils/helpers.js'
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

    // Verify token
    if (!order.accessTokenHash || !verifyAccessToken(token, order.accessTokenHash)) {
      return reply.status(403).send({
        success: false,
        error: 'Invalid or expired token',
      })
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

    // Generate HTML template for PDF
    const html = generateTicketHTML({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      eventName: order.event.name,
      eventDate: formattedDate,
      eventTime: formattedTime,
      eventVenue: order.event.venue,
      seats: order.orderItems.map((item: any) => ({
        number: item.seat?.seatNumber || item.seatNumber,
        type: item.seat?.seatType || item.seatType,
      })),
      qrCodeUrl: order.qrCodeUrl,
      totalAmount: Number(order.totalAmount),
    })

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setContent(html, {waitUntil: 'networkidle0'})

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
  qrCodeUrl: string | null
  totalAmount: number
}): string {
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

      <!-- Seats -->
      <div class="section">
        <div class="section-header">
          <span class="section-icon">🎫</span>
          <span class="section-title">Ghế ngồi</span>
        </div>
        <div class="seats-grid">
          ${data.seats
            .map(
              (seat) => `
          <div class="seat-card ${seat.type === 'VIP' ? 'vip' : ''}">
            <div class="seat-number">${seat.number}</div>
            <div class="seat-type">${seat.type}</div>
          </div>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- QR Code -->
      ${
        data.qrCodeUrl
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
      </div>
      `
          : ''
      }
    </div>
  </div>
</body>
</html>
  `
}
