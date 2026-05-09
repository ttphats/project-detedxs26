import QRCode from 'qrcode';
import { config } from '../config/env.js';
import { uploadImage } from './upload.service.js';

/**
 * Generate QR code for ticket and upload to Cloudinary
 * Returns Cloudinary URL
 */
export async function generateTicketQRCode(
  orderNumber: string,
  eventId: string
): Promise<string> {
  // Simple URL format for easy scanning
  const checkInUrl = `${config.clientUrl}/check-in/${orderNumber}`;

  try {
    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(checkInUrl, {
      errorCorrectionLevel: 'H',
      margin: 4,
      width: 400,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Upload to Cloudinary
    const uploadResult = await uploadImage(qrCodeDataUrl, 'qr-codes');

    if (!uploadResult.success || !uploadResult.data) {
      console.error('Failed to upload QR code to Cloudinary:', uploadResult.error);
      // Fallback to base64 if upload fails
      return qrCodeDataUrl;
    }

    return uploadResult.data.url;
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
  console.log('[generateTicketUrl] Input orderNumber:', orderNumber);
  console.log('[generateTicketUrl] Input accessToken:', accessToken);
  console.log('[generateTicketUrl] Token length:', accessToken?.length || 0);
  const url = `${config.clientUrl}/ticket/${orderNumber}?token=${accessToken}`;
  console.log('[generateTicketUrl] Generated URL:', url);
  return url;
}

