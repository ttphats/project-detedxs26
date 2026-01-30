import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary from CLOUDINARY_URL
// Format: cloudinary://api_key:api_secret@cloud_name
const cloudinaryUrl = process.env.CLOUDINARY_URL;
if (cloudinaryUrl) {
  const url = new URL(cloudinaryUrl.replace('cloudinary://', 'https://'));
  cloudinary.config({
    cloud_name: url.hostname,
    api_key: url.username,
    api_secret: url.password,
  });
}

const FOLDER = process.env.CLOUDINARY_FOLDER || 'tedx-fptuhcmc';

// POST /api/admin/upload - Upload image to Cloudinary
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const subfolder = formData.get('subfolder') as string || 'speakers';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only JPEG, PNG, WebP, GIF allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum 5MB allowed.' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64, {
      folder: `${FOLDER}/${subfolder}`,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 800, crop: 'limit' }, // Max dimensions
        { quality: 'auto:good' }, // Auto optimize quality
        { fetch_format: 'auto' }, // Auto format (webp if supported)
      ],
    });

    return NextResponse.json({
      success: true,
      data: {
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/upload - Delete image from Cloudinary
export async function DELETE(request: NextRequest) {
  try {
    const { public_id } = await request.json();

    if (!public_id) {
      return NextResponse.json(
        { success: false, error: 'public_id is required' },
        { status: 400 }
      );
    }

    await cloudinary.uploader.destroy(public_id);

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete image' },
      { status: 500 }
    );
  }
}

