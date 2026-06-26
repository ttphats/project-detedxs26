/**
 * TEDx Email Templates - Clean & Professional
 * Based on actual TED/TEDx email design guidelines
 */

const COLORS = {
  red: '#EB0028',
  black: '#000000',
  white: '#FFFFFF',
  gray: '#767676',
  lightGray: '#F5F5F5',
  darkGray: '#333333',
};

// Minimal, clean wrapper
const wrapper = (content) => `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>TEDx</title>
  <style>
    body { margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    a { color: ${COLORS.red}; }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${COLORS.white}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${COLORS.white};">
    <tr>
      <td align="center" style="padding: 0;">
        ${content}
      </td>
    </tr>
  </table>
</body>
</html>`;

// Clean header - just logo, no fancy badges
const header = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background-color:${COLORS.black};">
  <tr>
    <td style="padding: 32px 40px;">
      <table role="presentation" cellspacing="0" cellpadding="0">
        <tr>
          <td style="font-size: 28px; font-weight: 700; color: ${COLORS.white}; letter-spacing: -0.5px;">
            TED<span style="color: ${COLORS.red};">x</span>
          </td>
        </tr>
        <tr>
          <td style="font-size: 10px; font-weight: 500; color: ${COLORS.gray}; letter-spacing: 2px; text-transform: uppercase; padding-top: 4px;">
            FPT University HCMC
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

// Minimal footer
const footer = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
  <tr>
    <td style="padding: 32px 40px; border-top: 1px solid #E5E5E5;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="font-size: 12px; color: ${COLORS.gray}; line-height: 1.6;">
            <p style="margin: 0 0 8px 0;">
              <a href="https://tedxfptuhcmc.com" style="color: ${COLORS.darkGray}; text-decoration: none;">tedxfptuhcmc.com</a>
            </p>
            <p style="margin: 0 0 8px 0;">
              Cần hỗ trợ? <a href="mailto:support@tedxfptuhcm.com" style="color: ${COLORS.red}; text-decoration: none;">support@tedxfptuhcm.com</a>
            </p>
            <p style="margin: 16px 0 0 0; font-size: 11px; color: #999;">
              © 2026 TEDxFPT University HCMC. This independent TEDx event is operated under license from TED.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

// ============ TEMPLATES ============

// 1. ORDER CONFIRMATION - Clean & Simple
export const orderConfirmation = wrapper(`
${header}

<!-- Main Content - White background -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background-color:${COLORS.white};">
  <tr>
    <td style="padding: 48px 40px 32px 40px;">
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 400; color: ${COLORS.darkGray}; line-height: 1.3;">
        Cảm ơn bạn, <strong>{{customerName}}</strong>
      </h1>
      <p style="margin: 0; font-size: 16px; color: ${COLORS.gray}; line-height: 1.6;">
        Đơn hàng của bạn đã được xác nhận. Vui lòng thanh toán để nhận vé.
      </p>
    </td>
  </tr>
  
  <!-- Order Box -->
  <tr>
    <td style="padding: 0 40px 32px 40px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${COLORS.lightGray};">
        <tr>
          <td style="padding: 24px;">
            <p style="margin: 0 0 4px 0; font-size: 11px; color: ${COLORS.gray}; text-transform: uppercase; letter-spacing: 1px;">
              Mã đơn hàng
            </p>
            <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${COLORS.darkGray}; font-family: monospace;">
              {{orderNumber}}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Event Info -->
  <tr>
    <td style="padding: 0 40px 32px 40px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding-bottom: 16px; border-bottom: 1px solid #E5E5E5;">
            <p style="margin: 0 0 4px 0; font-size: 11px; color: ${COLORS.gray}; text-transform: uppercase; letter-spacing: 1px;">
              Sự kiện
            </p>
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: ${COLORS.darkGray};">
              {{eventName}}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding-top: 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td width="50%">
                  <p style="margin: 0 0 4px 0; font-size: 11px; color: ${COLORS.gray}; text-transform: uppercase; letter-spacing: 1px;">Ngày</p>
                  <p style="margin: 0; font-size: 14px; color: ${COLORS.darkGray};">{{eventDate}}</p>
                </td>
                <td width="50%">
                  <p style="margin: 0 0 4px 0; font-size: 11px; color: ${COLORS.gray}; text-transform: uppercase; letter-spacing: 1px;">Giờ</p>
                  <p style="margin: 0; font-size: 14px; color: ${COLORS.darkGray};">{{eventTime}}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Seats & Total -->
  <tr>
    <td style="padding: 0 40px 32px 40px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding: 16px 0; border-top: 1px solid #E5E5E5; border-bottom: 1px solid #E5E5E5;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td>
                  <p style="margin: 0; font-size: 14px; color: ${COLORS.darkGray};">Ghế: <strong>{{seats}}</strong></p>
                </td>
                <td align="right">
                  <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${COLORS.darkGray};">{{totalAmount}}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA Button - Simple, no gradient -->
  <tr>
    <td style="padding: 0 40px 48px 40px;">
      <table role="presentation" cellspacing="0" cellpadding="0">
        <tr>
          <td style="background-color: ${COLORS.red};">
            <a href="{{paymentUrl}}" style="display: block; padding: 14px 32px; font-size: 14px; font-weight: 600; color: ${COLORS.white}; text-decoration: none; text-transform: uppercase; letter-spacing: 1px;">
              Thanh toán ngay
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

${footer}
`);

// 2. TICKET CONFIRMED - Minimalist
export const ticketConfirmed = wrapper(`
${header}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background-color:${COLORS.white};">
  <!-- Success Icon -->
  <tr>
    <td align="center" style="padding: 48px 40px 24px 40px;">
      <table role="presentation" cellspacing="0" cellpadding="0">
        <tr>
          <td style="width: 64px; height: 64px; background-color: #E8F5E9; border-radius: 50%; text-align: center; vertical-align: middle;">
            <span style="font-size: 28px; line-height: 64px;">✓</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td align="center" style="padding: 0 40px 32px 40px;">
      <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 400; color: ${COLORS.darkGray};">
        Vé đã xác nhận
      </h1>
      <p style="margin: 0; font-size: 16px; color: ${COLORS.gray};">
        Xin chào <strong>{{customerName}}</strong>, vé của bạn đã sẵn sàng.
      </p>
    </td>
  </tr>

  <!-- Ticket Card -->
  <tr>
    <td style="padding: 0 40px 32px 40px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 2px solid ${COLORS.darkGray};">
        <tr>
          <td style="padding: 24px; border-bottom: 1px dashed #CCC;">
            <p style="margin: 0 0 4px 0; font-size: 11px; color: ${COLORS.gray}; text-transform: uppercase; letter-spacing: 1px;">Sự kiện</p>
            <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${COLORS.darkGray};">{{eventName}}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td width="33%">
                  <p style="margin: 0 0 4px 0; font-size: 11px; color: ${COLORS.gray}; text-transform: uppercase;">Ngày</p>
                  <p style="margin: 0; font-size: 14px; font-weight: 500; color: ${COLORS.darkGray};">{{eventDate}}</p>
                </td>
                <td width="33%">
                  <p style="margin: 0 0 4px 0; font-size: 11px; color: ${COLORS.gray}; text-transform: uppercase;">Giờ</p>
                  <p style="margin: 0; font-size: 14px; font-weight: 500; color: ${COLORS.darkGray};">{{eventTime}}</p>
                </td>
                <td width="33%">
                  <p style="margin: 0 0 4px 0; font-size: 11px; color: ${COLORS.gray}; text-transform: uppercase;">Ghế</p>
                  <p style="margin: 0; font-size: 14px; font-weight: 500; color: ${COLORS.darkGray};">{{seats}}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- QR Code -->
  <tr>
    <td align="center" style="padding: 0 40px 32px 40px;">
      <img src="{{qrCodeUrl}}" alt="QR Code" width="150" height="150" style="display: block;"/>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: ${COLORS.gray};">
        Mã: {{orderNumber}}
      </p>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td align="center" style="padding: 0 40px 48px 40px;">
      <table role="presentation" cellspacing="0" cellpadding="0">
        <tr>
          <td style="background-color: ${COLORS.darkGray};">
            <a href="{{ticketUrl}}" style="display: block; padding: 14px 32px; font-size: 14px; font-weight: 600; color: ${COLORS.white}; text-decoration: none;">
              Xem vé điện tử
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

${footer}
`);

console.log('Templates generated!');
console.log('\n--- ORDER CONFIRMATION ---');
console.log(orderConfirmation.substring(0, 500) + '...');
