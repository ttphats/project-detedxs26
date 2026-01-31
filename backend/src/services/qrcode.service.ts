import QRCode from 'qrcode';
import { config } from '../config/env.js';

/**
 * Generate QR code for ticket
 * Returns base64 data URL
 */
export async function generateTicketQRCode(
  orderNumber: string,
  eventId: string
): Promise<string> {
  const data = JSON.stringify({
    orderNumber,
    eventId,
    timestamp: Date.now(),
  });

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate check-in URL with embedded token
 */
export function generateCheckInUrl(orderNumber: string, token: string): string {
  return `${config.clientUrl}/check-in/${orderNumber}?token=${token}`;
}

/**
 * Generate ticket URL with access token
 */
export function generateTicketUrl(orderNumber: string, accessToken: string): string {
  return `${config.clientUrl}/ticket/${orderNumber}?token=${accessToken}`;
}

