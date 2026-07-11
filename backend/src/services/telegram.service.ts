import { config } from '../config/env.js';

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sends a text message to the configured Telegram chat using HTML formatting.
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const { botToken, chatId } = config.telegram;

  if (!botToken || !chatId) {
    console.log('[TELEGRAM] Telegram Bot token or Chat ID is missing. Skipping notification.');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[TELEGRAM] Failed to send Telegram message: ${response.status} - ${errText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[TELEGRAM] Error sending Telegram message:', error);
    return false;
  }
}

/**
 * Notifies the team that a customer has requested payment confirmation.
 */
export async function notifyNewOrderPendingConfirmation(order: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  eventName: string;
  totalAmount: number;
  seats: Array<{ seatNumber: string; seatType: string }>;
}): Promise<boolean> {
  const seatList = order.seats.map((s) => `${s.seatNumber} (${s.seatType})`).join(', ');
  const amountFormatted = order.totalAmount.toLocaleString('vi-VN') + ' VND';

  const message = `
🔔 <b>YÊU CẦU XÁC NHẬN THANH TOÁN MỚI</b>

<b>Mã đơn hàng:</b> <code>${escapeHtml(order.orderNumber)}</code>
<b>Khách hàng:</b> ${escapeHtml(order.customerName)}
<b>Số điện thoại:</b> <code>${escapeHtml(order.customerPhone)}</code>
<b>Email:</b> ${escapeHtml(order.customerEmail)}

<b>Sự kiện:</b> ${escapeHtml(order.eventName)}
<b>Danh sách ghế:</b> <code>${escapeHtml(seatList)}</code>
<b>Tổng số tiền:</b> <b>${escapeHtml(amountFormatted)}</b>

<i>Vui lòng truy cập Web Admin để kiểm tra giao dịch và phê duyệt vé cho khách hàng.</i>
  `.trim();

  return sendTelegramMessage(message);
}

/**
 * Notifies the team that an order has been successfully approved/paid.
 */
export async function notifyOrderConfirmed(order: {
  orderNumber: string;
  customerName: string;
  eventName: string;
  totalAmount: number;
  seats: Array<{ seatNumber: string; seatType: string }>;
}): Promise<boolean> {
  const seatList = order.seats.map((s) => `${s.seatNumber} (${s.seatType})`).join(', ');
  const amountFormatted = order.totalAmount.toLocaleString('vi-VN') + ' VND';

  const message = `
✅ <b>ĐƠN HÀNG ĐÃ ĐƯỢC XÁC NHẬN THÀNH CÔNG</b>

<b>Mã đơn hàng:</b> <code>${escapeHtml(order.orderNumber)}</code>
<b>Khách hàng:</b> ${escapeHtml(order.customerName)}
<b>Sự kiện:</b> ${escapeHtml(order.eventName)}
<b>Danh sách ghế:</b> <code>${escapeHtml(seatList)}</code>
<b>Tổng số tiền:</b> <b>${escapeHtml(amountFormatted)}</b>

<i>Hệ thống đã tự động tạo vé QR và gửi email xác nhận cho khách hàng.</i>
  `.trim();

  return sendTelegramMessage(message);
}
