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
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: `${FOLDER}/${subfolder}`,
      resource_type: 'image',
      transformation: [
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
 * Validate file size (max 5MB)
 */
export function validateImageSize(size: number): boolean {
  const maxSize = 5 * 1024 * 1024; // 5MB
  return size <= maxSize;
}

