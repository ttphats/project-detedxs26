/**
 * Seed Email Templates - TEDx Creative Design
 * 
 * Run: node scripts/seed-email-templates.mjs
 */

import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';

const DB_CONFIG = {
  host: '202.92.4.66',
  port: 3306,
  user: 'jyndyeeuhosting_easyticketdb',
  password: 'Easyticket@2026',
  database: 'jyndyeeuhosting_easyticketdb',
};

// TEDx Brand Colors
const COLORS = {
  red: '#e62b1e',
  darkRed: '#b91c14',
  black: '#110808',
  darkGray: '#1a1a1a',
  white: '#ffffff',
};

// Common email wrapper
const emailWrapper = (content) => `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TEDxFPTUniversityHCMC</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.black}; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${COLORS.black};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        ${content}
      </td>
    </tr>
  </table>
</body>
</html>`;

// Header component
const header = (badge, badgeColor = COLORS.red) => `
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
  <tr>
    <td style="text-align: center; padding-bottom: 32px;">
      <div style="display: inline-block; background-color: ${badgeColor}; padding: 8px 20px;">
        <span style="font-size: 10px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 3px;">
          ${badge}
        </span>
      </div>
    </td>
  </tr>
  <tr>
    <td style="text-align: center; padding-bottom: 32px;">
      <h2 style="margin: 0; font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: -1px;">
        TED<span style="font-weight: 300;">x</span>
        <span style="font-size: 14px; font-weight: 400; color: #666; display: block; margin-top: 4px; letter-spacing: 3px; text-transform: uppercase;">FPT University HCMC</span>
      </h2>
    </td>
  </tr>
</table>`;

// Footer component
const footer = `
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 40px;">
  <tr>
    <td style="text-align: center; padding: 32px 0; border-top: 1px solid rgba(255,255,255,0.1);">
      <p style="margin: 0 0 16px 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 2px;">
        Cần hỗ trợ?
      </p>
      <a href="mailto:support@tedxfptuhcm.com" style="color: ${COLORS.red}; text-decoration: none; font-weight: 600;">
        support@tedxfptuhcm.com
      </a>
    </td>
  </tr>
  <tr>
    <td style="text-align: center; padding-bottom: 40px;">
      <p style="margin: 0; font-size: 11px; color: #444;">
        © 2026 TEDxFPTUniversityHCMC. All rights reserved.
      </p>
    </td>
  </tr>
</table>`;

// TEMPLATES
const TEMPLATES = [
  {
    purpose: 'PAYMENT_PENDING',
    name: 'Chờ thanh toán - TEDx 2026',
    subject: '⏳ Đơn hàng {{orderNumber}} đang chờ thanh toán',
    htmlContent: '',
  },
  {
    purpose: 'PAYMENT_RECEIVED',
    name: 'Đã nhận thông tin thanh toán - TEDx 2026',
    subject: '📥 [Admin] Khách hàng gửi bằng chứng thanh toán - {{orderNumber}}',
    htmlContent: '',
  },
  {
    purpose: 'PAYMENT_CONFIRMED',
    name: 'Thanh toán thành công - TEDx 2026',
    subject: '✅ Thanh toán thành công - {{orderNumber}}',
    htmlContent: '',
  },
  {
    purpose: 'PAYMENT_REJECTED',
    name: 'Từ chối thanh toán - TEDx 2026',
    subject: '❌ Thanh toán không thành công - {{orderNumber}}',
    htmlContent: '',
  },
  {
    purpose: 'TICKET_CONFIRMED',
    name: 'Vé hợp lệ - TEDx 2026',
    subject: '🎫 Vé điện tử TEDx - Đơn hàng {{orderNumber}}',
    htmlContent: '',
  },
  {
    purpose: 'TICKET_CANCELLED',
    name: 'Vé bị hủy - TEDx 2026',
    subject: '🚫 Vé đã bị hủy - {{orderNumber}}',
    htmlContent: '',
  },
  {
    purpose: 'EVENT_REMINDER',
    name: 'Nhắc lịch sự kiện - TEDx 2026',
    subject: '🔔 Nhắc nhở: {{eventName}} diễn ra vào {{eventDate}}',
    htmlContent: '',
  },
  {
    purpose: 'CHECKIN_CONFIRMATION',
    name: 'Check-in thành công - TEDx 2026',
    subject: '✓ Check-in thành công - {{eventName}}',
    htmlContent: '',
  },
  {
    purpose: 'ADMIN_NOTIFICATION',
    name: 'Thông báo Admin - TEDx 2026',
    subject: '🔔 [Admin] {{subject}}',
    htmlContent: '',
  },
];

async function main() {
  console.log('🚀 Seeding email templates...\n');

  const connection = await mysql.createConnection(DB_CONFIG);

  try {
    // Build template HTML content for each purpose
    const templateBuilders = {
      'PAYMENT_PENDING': buildPaymentPendingTemplate,
      'PAYMENT_RECEIVED': buildPaymentReceivedTemplate,
      'PAYMENT_CONFIRMED': buildPaymentConfirmedTemplate,
      'PAYMENT_REJECTED': buildPaymentRejectedTemplate,
      'TICKET_CONFIRMED': buildTicketConfirmedTemplate,
      'TICKET_CANCELLED': buildTicketCancelledTemplate,
      'EVENT_REMINDER': buildEventReminderTemplate,
      'CHECKIN_CONFIRMATION': buildCheckinConfirmationTemplate,
      'ADMIN_NOTIFICATION': buildAdminNotificationTemplate,
    };

    for (const template of TEMPLATES) {
      const builder = templateBuilders[template.purpose];
      if (builder) {
        template.htmlContent = builder();
      }
    }
    
    for (const template of TEMPLATES) {
      // Check if template with same purpose already exists
      const [existing] = await connection.execute(
        'SELECT id FROM email_templates WHERE purpose = ? AND is_active = 1',
        [template.purpose]
      );
      
      if (existing.length > 0) {
        console.log(`⚠️  ${template.purpose}: Active template already exists, skipping...`);
        continue;
      }
      
      // Get max version for this purpose
      const [versionResult] = await connection.execute(
        'SELECT MAX(version) as maxVersion FROM email_templates WHERE purpose = ?',
        [template.purpose]
      );
      const version = (versionResult[0]?.maxVersion || 0) + 1;
      
      // Extract variables from HTML
      const variables = extractVariables(template.htmlContent);
      
      // Insert template
      const id = randomUUID();
      await connection.execute(
        `INSERT INTO email_templates (id, purpose, name, subject, html_content, variables, is_active, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
        [id, template.purpose, template.name, template.subject, template.htmlContent, JSON.stringify(variables), version]
      );
      
      console.log(`✅ ${template.purpose}: Created (v${version}) - ${variables.length} variables`);
    }
    
    console.log('\n🎉 Done!');
  } finally {
    await connection.end();
  }
}

function extractVariables(html) {
  const regex = /\{\{(\w+)\}\}/g;
  const variables = new Set();
  let match;
  while ((match = regex.exec(html)) !== null) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

// ========== TEMPLATE BUILDERS ==========

function buildTicketConfirmedTemplate() {
  return emailWrapper(`
    ${header('✓ VÉ ĐÃ ĐƯỢC XÁC NHẬN')}

    <!-- Greeting -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
      <tr>
        <td style="padding: 0 0 24px 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff; line-height: 1.2;">
            Xin chào <span style="color: ${COLORS.red};">{{customerName}}</span>,
          </h1>
          <p style="margin: 16px 0 0 0; font-size: 16px; color: #999; line-height: 1.6;">
            Vé của bạn đã được xác nhận thành công. Dưới đây là thông tin chi tiết:
          </p>
        </td>
      </tr>
    </table>

    <!-- Event Card -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: ${COLORS.darkGray}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 28px 32px; border-left: 4px solid ${COLORS.red};">
          <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 900; color: #ffffff; text-transform: uppercase;">
            {{eventName}}
          </h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="width: 50%; padding: 8px 0;">
                <p style="margin: 0; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 2px;">Ngày</p>
                <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #fff;">{{eventDate}}</p>
              </td>
              <td style="width: 50%; padding: 8px 0;">
                <p style="margin: 0; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 2px;">Giờ</p>
                <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #fff;">{{eventTime}}</p>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 16px 0 0 0;">
                <p style="margin: 0; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 2px;">Địa điểm</p>
                <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 700; color: #fff;">{{eventVenue}}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Order Info -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 24px;">
      <tr>
        <td style="padding: 20px 24px; background-color: rgba(230, 43, 30, 0.1); border-radius: 8px;">
          <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 2px;">Mã đơn hàng</p>
          <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: 900; color: ${COLORS.red}; font-family: monospace;">{{orderNumber}}</p>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 32px;">
      <tr>
        <td style="text-align: center;">
          <a href="{{ticketUrl}}" style="display: inline-block; background: linear-gradient(135deg, ${COLORS.red} 0%, ${COLORS.darkRed} 100%); background-color: ${COLORS.red}; color: #ffffff; padding: 18px 48px; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; text-decoration: none; border-radius: 4px;">
            🎫 XEM VÉ ĐIỆN TỬ
          </a>
          <p style="margin: 16px 0 0 0; font-size: 12px; color: #666;">
            Hoặc truy cập: <a href="{{ticketUrl}}" style="color: ${COLORS.red};">{{ticketUrl}}</a>
          </p>
        </td>
      </tr>
    </table>

    <!-- Notes -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 32px;">
      <tr>
        <td style="padding: 24px; background-color: ${COLORS.darkGray}; border-radius: 8px; border-left: 4px solid ${COLORS.red};">
          <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 900; color: #fff; text-transform: uppercase;">Lưu ý quan trọng</h3>
          <ul style="margin: 0; padding: 0 0 0 16px; color: #999; font-size: 13px; line-height: 1.8;">
            <li>Mang theo CCCD/CMND để xác minh danh tính</li>
            <li>Vé này chỉ có giá trị một lần sử dụng</li>
            <li>Không chuyển nhượng, không hoàn tiền sau khi thanh toán</li>
          </ul>
        </td>
      </tr>
    </table>

    ${footer}
  `);
}

function buildPaymentPendingTemplate() {
  return emailWrapper(`
    ${header('⏳ CHỜ THANH TOÁN', '#f59e0b')}

    <!-- Greeting -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
      <tr>
        <td style="padding: 0 0 24px 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff; line-height: 1.2;">
            Xin chào <span style="color: ${COLORS.red};">{{customerName}}</span>,
          </h1>
          <p style="margin: 16px 0 0 0; font-size: 16px; color: #999; line-height: 1.6;">
            Đơn hàng của bạn đã được tạo thành công. Vui lòng thanh toán để hoàn tất đặt vé.
          </p>
        </td>
      </tr>
    </table>

    <!-- Order Summary -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: ${COLORS.darkGray}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 24px 32px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td>
                <p style="margin: 0; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 2px;">Mã đơn hàng</p>
                <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 900; color: ${COLORS.red}; font-family: monospace;">{{orderNumber}}</p>
              </td>
              <td style="text-align: right;">
                <p style="margin: 0; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 2px;">Tổng tiền</p>
                <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 900; color: #fff;">{{totalAmount}}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Bank Info -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 24px; background-color: ${COLORS.darkGray}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 24px 32px; border-left: 4px solid #f59e0b;">
          <h3 style="margin: 0 0 20px 0; font-size: 14px; font-weight: 900; color: #fff; text-transform: uppercase; letter-spacing: 2px;">
            💳 Thông tin chuyển khoản
          </h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span style="color: #666; font-size: 12px;">Ngân hàng:</span>
                <span style="color: #fff; font-weight: 700; float: right;">{{bankName}}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span style="color: #666; font-size: 12px;">Số tài khoản:</span>
                <span style="color: ${COLORS.red}; font-weight: 900; font-family: monospace; float: right;">{{accountNumber}}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span style="color: #666; font-size: 12px;">Chủ tài khoản:</span>
                <span style="color: #fff; font-weight: 700; float: right;">{{accountName}}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #666; font-size: 12px;">Nội dung CK:</span>
                <span style="color: #f59e0b; font-weight: 900; font-family: monospace; float: right;">{{transferContent}}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Deadline Warning -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 24px;">
      <tr>
        <td style="padding: 20px 24px; background-color: rgba(239, 68, 68, 0.1); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
          <p style="margin: 0; font-size: 14px; color: #ef4444; font-weight: 700;">
            ⚠️ Vui lòng thanh toán trước: <strong>{{paymentDeadline}}</strong>
          </p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #999;">
            Đơn hàng sẽ tự động hủy nếu không nhận được thanh toán.
          </p>
        </td>
      </tr>
    </table>

    ${footer}
  `);
}

function buildPaymentConfirmedTemplate() {
  return emailWrapper(`
    ${header('✅ THANH TOÁN THÀNH CÔNG')}

    <!-- Greeting -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
      <tr>
        <td style="padding: 0 0 24px 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff; line-height: 1.2;">
            Xin chào <span style="color: ${COLORS.red};">{{customerName}}</span>,
          </h1>
          <p style="margin: 16px 0 0 0; font-size: 16px; color: #999; line-height: 1.6;">
            Chúng tôi đã nhận được thanh toán của bạn. Vé sẽ được gửi trong email tiếp theo.
          </p>
        </td>
      </tr>
    </table>

    <!-- Confirmation Card -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 32px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 2px;">
            Thanh toán đã được xác nhận
          </h2>
        </td>
      </tr>
    </table>

    <!-- Order Info -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 24px; background-color: ${COLORS.darkGray}; border-radius: 12px;">
      <tr>
        <td style="padding: 24px 32px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span style="color: #666; font-size: 12px;">Mã đơn hàng:</span>
                <span style="color: ${COLORS.red}; font-weight: 900; font-family: monospace; float: right;">{{orderNumber}}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span style="color: #666; font-size: 12px;">Sự kiện:</span>
                <span style="color: #fff; font-weight: 700; float: right;">{{eventName}}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <span style="color: #666; font-size: 12px;">Số tiền:</span>
                <span style="color: #10b981; font-weight: 900; float: right;">{{totalAmount}}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Next Steps -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 24px;">
      <tr>
        <td style="padding: 24px; background-color: ${COLORS.darkGray}; border-radius: 8px; border-left: 4px solid #10b981;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 900; color: #fff; text-transform: uppercase;">Bước tiếp theo</h3>
          <p style="margin: 0; color: #999; font-size: 13px; line-height: 1.6;">
            Vé điện tử sẽ được gửi đến email này trong vài phút. Vui lòng kiểm tra hộp thư.
          </p>
        </td>
      </tr>
    </table>

    ${footer}
  `);
}

function buildPaymentRejectedTemplate() {
  return emailWrapper(`
    ${header('❌ THANH TOÁN KHÔNG THÀNH CÔNG', '#ef4444')}

    <!-- Greeting -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
      <tr>
        <td style="padding: 0 0 24px 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff; line-height: 1.2;">
            Xin chào <span style="color: ${COLORS.red};">{{customerName}}</span>,
          </h1>
          <p style="margin: 16px 0 0 0; font-size: 16px; color: #999; line-height: 1.6;">
            Rất tiếc, chúng tôi không thể xác nhận thanh toán cho đơn hàng của bạn.
          </p>
        </td>
      </tr>
    </table>

    <!-- Error Card -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: rgba(239, 68, 68, 0.1); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3);">
      <tr>
        <td style="padding: 24px 32px;">
          <p style="margin: 0 0 8px 0; font-size: 10px; color: #ef4444; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Mã đơn hàng</p>
          <p style="margin: 0 0 16px 0; font-size: 20px; font-weight: 900; color: #fff; font-family: monospace;">{{orderNumber}}</p>
          <p style="margin: 0 0 8px 0; font-size: 10px; color: #ef4444; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Lý do</p>
          <p style="margin: 0; font-size: 16px; color: #fff;">{{reason}}</p>
        </td>
      </tr>
    </table>

    <!-- What to do -->
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 24px;">
      <tr>
        <td style="padding: 24px; background-color: ${COLORS.darkGray}; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 900; color: #fff; text-transform: uppercase;">Bạn có thể</h3>
          <ul style="margin: 0; padding: 0 0 0 16px; color: #999; font-size: 13px; line-height: 1.8;">
            <li>Kiểm tra lại thông tin chuyển khoản</li>
            <li>Đảm bảo nội dung chuyển khoản chính xác</li>
            <li>Thử thanh toán lại với mã đơn hàng mới</li>
            <li>Liên hệ hỗ trợ nếu cần giúp đỡ</li>
          </ul>
        </td>
      </tr>
    </table>

    ${footer}
  `);
}

function buildPaymentReceivedTemplate() {
  return emailWrapper(`
    ${header('📥 THANH TOÁN MỚI CẦN XÁC NHẬN', '#3b82f6')}

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
      <tr>
        <td style="padding: 0 0 24px 0;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff;">
            Có thanh toán mới cần xác nhận
          </h1>
        </td>
      </tr>
    </table>

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: ${COLORS.darkGray}; border-radius: 12px; border-left: 4px solid #3b82f6;">
      <tr>
        <td style="padding: 24px 32px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #666;">Mã đơn:</span><span style="color: ${COLORS.red}; font-weight: 900; float: right;">{{orderNumber}}</span></td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #666;">Khách hàng:</span><span style="color: #fff; float: right;">{{customerName}}</span></td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #666;">Email:</span><span style="color: #fff; float: right;">{{customerEmail}}</span></td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span style="color: #666;">Số tiền:</span><span style="color: #10b981; font-weight: 900; float: right;">{{totalAmount}}</span></td></tr>
            <tr><td style="padding: 8px 0;"><span style="color: #666;">Thời gian gửi:</span><span style="color: #fff; float: right;">{{submittedAt}}</span></td></tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 24px;">
      <tr>
        <td style="text-align: center;">
          <p style="color: #666; font-size: 14px;">Vui lòng đăng nhập Admin để xác nhận hoặc từ chối thanh toán này.</p>
        </td>
      </tr>
    </table>
    ${footer}
  `);
}

function buildTicketCancelledTemplate() {
  return emailWrapper(`
    ${header('🚫 VÉ ĐÃ BỊ HỦY', '#6b7280')}

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
      <tr>
        <td style="padding: 0 0 24px 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff;">
            Xin chào <span style="color: ${COLORS.red};">{{customerName}}</span>,
          </h1>
          <p style="margin: 16px 0 0 0; font-size: 16px; color: #999;">
            Rất tiếc, vé của bạn đã bị hủy.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: rgba(107, 114, 128, 0.2); border-radius: 12px;">
      <tr>
        <td style="padding: 24px 32px;">
          <p style="margin: 0 0 8px 0; font-size: 10px; color: #999; text-transform: uppercase;">Mã đơn hàng</p>
          <p style="margin: 0 0 16px 0; font-size: 20px; font-weight: 900; color: #fff; font-family: monospace;">{{orderNumber}}</p>
          <p style="margin: 0 0 8px 0; font-size: 10px; color: #999; text-transform: uppercase;">Lý do</p>
          <p style="margin: 0; font-size: 16px; color: #fff;">{{reason}}</p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 24px;">
      <tr>
        <td style="padding: 24px; background-color: ${COLORS.darkGray}; border-radius: 8px;">
          <p style="margin: 0; color: #999; font-size: 13px;">Nếu bạn có thắc mắc, vui lòng liên hệ đội ngũ hỗ trợ.</p>
        </td>
      </tr>
    </table>
    ${footer}
  `);
}

function buildEventReminderTemplate() {
  return emailWrapper(`
    ${header('🔔 NHẮC NHỞ SỰ KIỆN', '#8b5cf6')}

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
      <tr>
        <td style="padding: 0 0 24px 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff;">
            Xin chào <span style="color: ${COLORS.red};">{{customerName}}</span>,
          </h1>
          <p style="margin: 16px 0 0 0; font-size: 16px; color: #999;">
            Sự kiện sắp diễn ra! Đừng quên tham dự nhé.
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); border-radius: 12px;">
      <tr>
        <td style="padding: 32px; text-align: center;">
          <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 900; color: #fff; text-transform: uppercase;">{{eventName}}</h2>
          <p style="margin: 0; font-size: 18px; color: rgba(255,255,255,0.9);">📅 {{eventDate}} • ⏰ {{eventTime}}</p>
          <p style="margin: 12px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.7);">📍 {{eventVenue}}</p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 24px;">
      <tr>
        <td style="text-align: center;">
          <a href="{{ticketUrl}}" style="display: inline-block; background-color: ${COLORS.red}; color: #fff; padding: 16px 40px; font-weight: 900; text-transform: uppercase; text-decoration: none; border-radius: 4px;">🎫 XEM VÉ</a>
        </td>
      </tr>
    </table>
    ${footer}
  `);
}

function buildCheckinConfirmationTemplate() {
  return emailWrapper(`
    ${header('✓ CHECK-IN THÀNH CÔNG', '#14b8a6')}

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
      <tr>
        <td style="padding: 0 0 24px 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #ffffff;">
            Xin chào <span style="color: ${COLORS.red};">{{customerName}}</span>,
          </h1>
          <p style="margin: 16px 0 0 0; font-size: 16px; color: #999;">
            Bạn đã check-in thành công!
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); border-radius: 12px;">
      <tr>
        <td style="padding: 32px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #fff; text-transform: uppercase;">{{eventName}}</h2>
          <p style="margin: 12px 0 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">Ghế: <strong>{{seatNumber}}</strong></p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: rgba(255,255,255,0.6);">Check-in lúc: {{checkinTime}}</p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 24px;">
      <tr>
        <td style="text-align: center; padding: 24px;">
          <p style="margin: 0; color: #999; font-size: 14px;">Chúc bạn có trải nghiệm tuyệt vời tại sự kiện! 🎉</p>
        </td>
      </tr>
    </table>
    ${footer}
  `);
}

function buildAdminNotificationTemplate() {
  return emailWrapper(`
    ${header('🔔 THÔNG BÁO HỆ THỐNG', '#f97316')}

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
      <tr>
        <td style="padding: 0 0 24px 0;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff;">
            {{subject}}
          </h1>
        </td>
      </tr>
    </table>

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: ${COLORS.darkGray}; border-radius: 12px; border-left: 4px solid #f97316;">
      <tr>
        <td style="padding: 24px 32px;">
          <p style="margin: 0; color: #ccc; font-size: 14px; line-height: 1.8;">{{message}}</p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; margin-top: 24px;">
      <tr>
        <td style="text-align: center;">
          <p style="margin: 0; color: #666; font-size: 12px;">Đây là thông báo tự động từ hệ thống TEDxFPTUniversityHCMC.</p>
        </td>
      </tr>
    </table>
    ${footer}
  `);
}

main().catch(console.error);

