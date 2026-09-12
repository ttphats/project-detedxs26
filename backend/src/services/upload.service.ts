import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env.js';

// Configure Cloudinary from URL
if (config.cloudinary.url) {
  const url = new URL(config.cloudinary.url.replace('cloudinary://', 'https://'));
  cloudinary.config({
    cloud_name: url.hostname,
    api_key: url.username,
    api_secret: url.password,
  });
}

const FOLDER = config.cloudinary.folder;

export interface UploadResult {
  success: boolean;
  data?: {
    url: string;
    public_id: string;
    width: number;
    height: number;
  };
  error?: string;
}

/**
 * Upload image to Cloudinary
 */
export async function uploadImage(
  base64Data: string,
  subfolder: string = 'speakers'
): Promise<UploadResult> {
  if (!config.cloudinary.url) {
    return { success: false, error: 'Cloudinary not configured' };
  }

  try {
    // No transformation for QR codes to preserve quality
    const isQRCode = subfolder === 'qr-codes';

    const result = await cloudinary.uploader.upload(base64Data, {
      folder: `${FOLDER}/${subfolder}`,
      resource_type: 'image',
      transformation: isQRCode ? [] : [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
    });

    return {
      success: true,
      data: {
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
      },
    };
  } catch (error: any) {
    console.error('Upload error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete image from Cloudinary
 */
export async function deleteImage(publicId: string): Promise<{ success: boolean; error?: string }> {
  if (!config.cloudinary.url) {
    return { success: false, error: 'Cloudinary not configured' };
  }

  try {
    await cloudinary.uploader.destroy(publicId);
    return { success: true };
  } catch (error: any) {
    console.error('Delete error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate file type
 */
export function validateImageType(mimeType: string): boolean {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  return allowedTypes.includes(mimeType);
}

/**
 * Largest image the API accepts.
 *
 * The admin UI downscales before uploading (web-admin/src/lib/image-compress.ts),
 * so this only has to be generous enough for direct API callers and for formats
 * that skip compression, such as animated GIFs. Keep UPLOAD_LIMIT_BYTES there in
 * sync, and keep the multipart fileSize limit in src/index.ts above this so an
 * oversize body fails here with a readable message instead of mid-stream.
 */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

/**
 * Validate file size
 */
export function validateImageSize(size: number): boolean {
  return size <= MAX_IMAGE_BYTES;
}

