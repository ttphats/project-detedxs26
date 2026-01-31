/**
 * TEDx Ticket Confirmation Email Template - Premium Creative Design
 *
 * Features:
 * - Modern creative ticket design with gradients
 * - TEDx brand colors (#E62B1E red, #1a1a1a black)
 * - Ticket access link button
 * - Premium typography and spacing
 * - Responsive inline CSS
 * - Vietnamese currency formatting
 * - QR code integrated into ticket design
 */

export interface TicketEmailData {
  customerName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  eventAddress?: string;
  orderNumber: string;
  seats: Array<{
    seatNumber: string;
    seatType: string;
    section?: string;
    row?: string;
    price: number;
  }>;
  totalAmount: number;
  qrCodeUrl: string;
  ticketUrl: string;  // Link to view ticket online
  pdfUrl?: string;    // Link to download ticket PDF (auto-generated from ticketUrl if not provided)
  logoUrl?: string;
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function generateTicketConfirmationEmail(data: TicketEmailData): string {
  // Get primary seat info for ticket display
  const primarySeat = data.seats[0];
  const seatDisplay = data.seats.length > 1
    ? `${primarySeat.seatNumber} +${data.seats.length - 1}`
    : primarySeat.seatNumber;
  const seatTypeDisplay = primarySeat.seatType;
  const isVIP = seatTypeDisplay === 'VIP';

  // Generate PDF URL from ticketUrl if not provided
  // ticketUrl format: /ticket/ORDER123?token=xxx
  // pdfUrl format: /api/ticket/ORDER123/pdf?token=xxx
  const pdfUrl = data.pdfUrl || data.ticketUrl.replace('/ticket/', '/api/ticket/').replace('?token=', '/pdf?token=');

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Vé điện tử - ${data.eventName}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #110808; font-family: 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">

  <!-- Wrapper -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #110808;">
    <tr>
      <td align="center" style="padding: 40px 16px;">

        <!-- Header: Confirmation Badge -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="text-align: center; padding-bottom: 32px;">
              <div style="display: inline-block; background-color: #ea251a; padding: 8px 20px;">
                <span style="font-size: 10px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 3px;">
                  ✓ THANH TOÁN THÀNH CÔNG
                </span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Hero Section -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="padding: 0 0 40px 0;">
              <!-- TEDx Logo -->
              <h2 style="margin: 0 0 24px 0; font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: -1px; text-align: center;">
                TED<span style="font-weight: 300;">x</span><span style="font-size: 14px; font-weight: 400; color: #666; display: block; margin-top: 4px; letter-spacing: 3px; text-transform: uppercase;">FPT University HCMC</span>
              </h2>

              <!-- Event Title -->
              <h1 style="margin: 0; font-size: 42px; font-weight: 900; color: #ffffff; line-height: 0.95; text-transform: uppercase; letter-spacing: -2px; text-align: center;">
                ${data.eventName.split(' ').slice(0, 2).join('<br/>')} <span style="color: #ea251a; font-style: italic;">${data.eventName.split(' ').slice(2).join(' ')}</span>
              </h1>

              <!-- Meta Info -->
              <p style="margin: 16px 0 0 0; font-size: 12px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 3px; text-align: center;">
                ${data.customerName} • ${data.eventDate}
              </p>
            </td>
          </tr>
        </table>

        <!-- Meta Ticker Bar -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #1a1a1a; border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1);">
          <tr>
            <td style="padding: 12px 24px; text-align: center;">
              <span style="font-size: 10px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 2px;">
                ${data.eventVenue}
              </span>
              <span style="color: #ea251a; margin: 0 12px;">●</span>
              <span style="font-size: 10px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 2px;">
                ${data.seats.length} VÉ
              </span>
              <span style="color: #ea251a; margin: 0 12px;">●</span>
              <span style="font-size: 10px; font-weight: 900; color: #ea251a; text-transform: uppercase; letter-spacing: 2px;">
                ${formatVND(data.totalAmount)}
              </span>
            </td>
          </tr>
        </table>

        <!-- TICKET CARD -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 32px; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.5);">

          <!-- Ticket Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ea251a 0%, #b91c14 100%); background-color: #ea251a; padding: 24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background: rgba(0,0,0,0.3); color: #fff; padding: 4px 12px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">
                      ${isVIP ? '★ VIP TICKET' : 'STANDARD TICKET'}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <span style="font-size: 11px; color: rgba(255,255,255,0.8); font-weight: 600; letter-spacing: 1px;">
                      ${data.orderNumber}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Ticket Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Left: Details -->
                  <td style="width: 55%; padding: 28px 20px 28px 32px; vertical-align: top;">

                    <!-- Date & Time Row -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
                      <tr>
                        <td style="width: 50%;">
                          <p style="margin: 0; font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Ngày</p>
                          <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 800; color: #110808;">${data.eventDate}</p>
                        </td>
                        <td style="width: 50%;">
                          <p style="margin: 0; font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Giờ</p>
                          <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 800; color: #110808;">${data.eventTime}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Venue -->
                    <div style="margin-bottom: 20px; padding-left: 12px; border-left: 3px solid #ea251a;">
                      <p style="margin: 0; font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Địa điểm</p>
                      <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #110808; line-height: 1.4;">${data.eventVenue}</p>
                      ${data.eventAddress ? `<p style="margin: 2px 0 0 0; font-size: 12px; color: #666;">${data.eventAddress}</p>` : ''}
                    </div>

                    <!-- Seat Display -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="width: 50%;">
                          <p style="margin: 0; font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Ghế</p>
                          <p style="margin: 4px 0 0 0; font-size: 28px; font-weight: 900; color: #ea251a; letter-spacing: -1px;">${seatDisplay}</p>
                        </td>
                        <td style="width: 50%;">
                          <p style="margin: 0; font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Loại vé</p>
                          <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 800; color: #110808;">${seatTypeDisplay}</p>
                        </td>
                      </tr>
                    </table>

                  </td>

                  <!-- Perforated Divider -->
                  <td style="width: 1px; background: repeating-linear-gradient(to bottom, #ddd 0px, #ddd 8px, transparent 8px, transparent 16px); background-color: transparent;"></td>

                  <!-- Right: QR Code -->
                  <td style="width: 45%; padding: 28px 32px 28px 20px; vertical-align: top; text-align: center;">
                    <p style="margin: 0 0 12px 0; font-size: 9px; color: #999; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">
                      Quét để Check-in
                    </p>
                    <img src="${data.qrCodeUrl}" alt="QR Code" width="130" height="130" style="display: block; margin: 0 auto; border-radius: 8px; border: 4px solid #110808;">
                    <p style="margin: 12px 0 0 0; font-size: 11px; font-weight: 800; color: #110808; letter-spacing: 1px;">
                      ${data.orderNumber}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Ticket Footer -->
          <tr>
            <td style="background-color: #110808; padding: 16px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Tổng thanh toán</p>
                  </td>
                  <td style="text-align: right;">
                    <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ea251a; letter-spacing: -1px;">${formatVND(data.totalAmount)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- END TICKET CARD -->

        <!-- ACCESS TICKET BUTTONS -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 32px;">
          <tr>
            <td style="text-align: center;">
              <!-- Primary: View Ticket Online -->
              <a href="${data.ticketUrl}" style="display: inline-block; background: linear-gradient(135deg, #ea251a 0%, #b91c14 100%); background-color: #ea251a; color: #ffffff; padding: 18px 48px; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; text-decoration: none; border-radius: 4px; margin-right: 12px;">
                🎫 XEM VÉ ĐIỆN TỬ
              </a>
              <!-- Secondary: Download PDF -->
              <a href="${pdfUrl}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 18px 32px; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; text-decoration: none; border-radius: 4px; border: 2px solid #ea251a;">
                📄 TẢI PDF
              </a>
              <p style="margin: 20px 0 0 0; font-size: 12px; color: #666;">
                Xem vé online: <a href="${data.ticketUrl}" style="color: #ea251a; text-decoration: underline;">Nhấn vào đây</a>
              </p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #555;">
                Lưu ý: Link tải PDF và xem vé sử dụng chung mã xác thực, vui lòng không chia sẻ.
              </p>
            </td>
          </tr>
        </table>
`;
}

export function generateTicketConfirmationEmailPart2(data: TicketEmailData): string {
  // Generate seats detail list with editorial style
  const seatsDetailHtml = data.seats.map((seat, index) => `
    <tr>
      <td style="padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 13px; font-weight: 700;">
        ${seat.section ? `${seat.section} - ` : ''}${seat.seatNumber}
      </td>
      <td style="padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">
        <span style="display: inline-block; background: ${seat.seatType === 'VIP' ? '#ea251a' : '#333'}; color: #fff; padding: 4px 14px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
          ${seat.seatType}
        </span>
      </td>
      <td style="padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #ea251a; font-size: 13px; text-align: right; font-weight: 800;">
        ${formatVND(seat.price)}
      </td>
    </tr>
  `).join('');

  return `
        <!-- Seats Detail Table (if multiple seats) -->
        ${data.seats.length > 1 ? `
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 32px;">
          <tr>
            <td>
              <div style="display: flex; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: -1px; font-style: italic;">Chi tiết ghế</h3>
                <div style="flex: 1; height: 2px; background: #ea251a; margin-left: 16px;"></div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <thead>
                  <tr style="background-color: #0d0505;">
                    <th style="padding: 14px 16px; font-size: 9px; color: #666; text-align: left; text-transform: uppercase; letter-spacing: 2px; font-weight: 900;">Ghế</th>
                    <th style="padding: 14px 16px; font-size: 9px; color: #666; text-align: center; text-transform: uppercase; letter-spacing: 2px; font-weight: 900;">Loại</th>
                    <th style="padding: 14px 16px; font-size: 9px; color: #666; text-align: right; text-transform: uppercase; letter-spacing: 2px; font-weight: 900;">Giá</th>
                  </tr>
                </thead>
                <tbody>
                  ${seatsDetailHtml}
                </tbody>
              </table>
            </td>
          </tr>
        </table>
        ` : ''}

        <!-- Schedule/Timeline Section -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 40px;">
          <tr>
            <td>
              <h3 style="margin: 0 0 24px 0; font-size: 20px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: -1px;">Lịch trình</h3>
            </td>
          </tr>
          <tr>
            <td style="padding-left: 24px; border-left: 2px solid #333;">
              <!-- Timeline Item 1 -->
              <div style="position: relative; padding-bottom: 24px;">
                <div style="position: absolute; left: -33px; top: 4px; width: 16px; height: 16px; background: #ea251a; border-radius: 50%; border: 4px solid #110808;"></div>
                <p style="margin: 0; font-size: 10px; color: #ea251a; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">Mở cửa</p>
                <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #ffffff;">Check-in & Đón khách</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #666; text-transform: uppercase; font-weight: 600;">Sảnh chính</p>
              </div>
              <!-- Timeline Item 2 -->
              <div style="position: relative; padding-bottom: 24px;">
                <div style="position: absolute; left: -33px; top: 4px; width: 16px; height: 16px; background: #ffffff; border-radius: 50%; border: 4px solid #110808;"></div>
                <p style="margin: 0; font-size: 10px; color: #666; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">${data.eventTime}</p>
                <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #ffffff;">Chương trình chính bắt đầu</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #666; text-transform: uppercase; font-weight: 600;">${data.eventVenue}</p>
              </div>
              <!-- Timeline Item 3 -->
              <div style="position: relative;">
                <div style="position: absolute; left: -33px; top: 4px; width: 16px; height: 16px; background: #444; border-radius: 50%; border: 4px solid #110808;"></div>
                <p style="margin: 0; font-size: 10px; color: #666; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">Kết thúc</p>
                <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #ffffff;">Networking & Giao lưu</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #666; text-transform: uppercase; font-weight: 600;">Khu vực sảnh</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Important Notes - Editorial Style -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 40px;">
          <tr>
            <td style="padding: 28px 32px; background-color: #1a1a1a; border-radius: 8px; border-left: 4px solid #ea251a;">
              <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: -1px;">
                Lưu ý quan trọng
              </h3>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width: 100%;">
                <tr>
                  <td style="padding: 10px 0; color: #999; font-size: 13px; line-height: 1.5; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="color: #ea251a; font-weight: 900;">01</span> &nbsp; Mang theo CCCD/CMND để xác minh danh tính
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #999; font-size: 13px; line-height: 1.5; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="color: #ea251a; font-weight: 900;">02</span> &nbsp; Vé này chỉ có giá trị một lần sử dụng
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #999; font-size: 13px; line-height: 1.5; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <span style="color: #ea251a; font-weight: 900;">03</span> &nbsp; Không chuyển nhượng, không hoàn tiền sau khi thanh toán
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #999; font-size: 13px; line-height: 1.5;">
                    <span style="color: #ea251a; font-weight: 900;">04</span> &nbsp; Tuân thủ quy định của ban tổ chức tại sự kiện
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Contact Section -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 40px;">
          <tr>
            <td style="text-align: center; padding: 32px 0; border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1);">
              <p style="margin: 0 0 16px 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">
                Cần hỗ trợ?
              </p>
              <a href="mailto:support@tedxfptuhcm.com" style="display: inline-block; background-color: #1a1a1a; color: #fff; padding: 14px 32px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; text-decoration: none; border: 1px solid rgba(255,255,255,0.2);">
                ✉️ support@tedxfptuhcm.com
              </a>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 40px;">
          <tr>
            <td style="text-align: center; padding-bottom: 40px;">
              <h2 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -1px;">
                TED<span style="font-weight: 300;">x</span>
              </h2>
              <p style="margin: 8px 0 0 0; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">
                FPT University HCMC
              </p>
              <p style="margin: 24px 0 0 0; font-size: 11px; color: #444;">
                © 2026 TEDxFPTUniversityHCMC. All rights reserved.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 10px; color: #333;">
                This independent TEDx event is operated under license from TED.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function generateFullTicketEmail(data: TicketEmailData): string {
  return generateTicketConfirmationEmail(data) + generateTicketConfirmationEmailPart2(data);
}

