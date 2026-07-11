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
  const amountFormatted = order.totalAmount.toLocaleString('en-US') + ' VND';

  const message = `
🔔 <b>NEW PAYMENT CONFIRMATION REQUEST</b>

<b>Order Number:</b> <code>${escapeHtml(order.orderNumber)}</code>
<b>Customer Name:</b> ${escapeHtml(order.customerName)}
<b>Phone Number:</b> <code>${escapeHtml(order.customerPhone)}</code>
<b>Email:</b> ${escapeHtml(order.customerEmail)}

<b>Event Name:</b> ${escapeHtml(order.eventName)}
<b>Seats:</b> <code>${escapeHtml(seatList)}</code>
<b>Total Amount:</b> <b>${escapeHtml(amountFormatted)}</b>

<i>Please access the Web Admin to check the transaction and approve the ticket.</i>
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
  const amountFormatted = order.totalAmount.toLocaleString('en-US') + ' VND';

  const message = `
✅ <b>ORDER CONFIRMED SUCCESSFULLY</b>

<b>Order Number:</b> <code>${escapeHtml(order.orderNumber)}</code>
<b>Customer Name:</b> ${escapeHtml(order.customerName)}
<b>Event Name:</b> ${escapeHtml(order.eventName)}
<b>Seats:</b> <code>${escapeHtml(seatList)}</code>
<b>Total Amount:</b> <b>${escapeHtml(amountFormatted)}</b>

<i>The system has generated the QR tickets and sent a confirmation email to the customer.</i>
  `.trim();

  return sendTelegramMessage(message);
}
