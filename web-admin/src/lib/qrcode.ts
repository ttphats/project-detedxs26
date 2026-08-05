import QRCode from 'qrcode';

export async function generateQRCode(data: string): Promise<string> {
  try {
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

export async function generateTicketQRCode(orderNumber: string, eventId: string): Promise<string> {
  const data = JSON.stringify({
    orderNumber,
    eventId,
    timestamp: Date.now(),
  });

  return generateQRCode(data);
}

