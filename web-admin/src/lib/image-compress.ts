/**
 * Browser-side image downscaling for admin uploads.
 *
 * Cloudinary already caps what it stores at 800x800 (see the transformation in
 * backend/src/services/upload.service.ts), so pushing a multi-thousand-pixel
 * poster over the wire only burns bandwidth and trips the upload size limit.
 * Shrink first, upload second.
 */

/** Longest edge kept after resizing — 2x Cloudinary's 800px cap, for retina. */
const MAX_DIMENSION = 1600

/** Stop lowering quality once the encode lands under this. */
const TARGET_BYTES = 3 * 1024 * 1024

/** Below this a re-encode would cost quality for no real gain. */
const SKIP_BELOW_BYTES = 1024 * 1024

/** Keep in sync with MAX_IMAGE_BYTES in backend/src/services/upload.service.ts. */
export const UPLOAD_LIMIT_BYTES = 15 * 1024 * 1024

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  return `${Math.round(bytes / 1024)}KB`
}

/**
 * JPEG has no alpha channel, so anything that might carry transparency
 * (PNG logos, most of all) is re-encoded as WebP instead.
 */
function outputTypeFor(file: File): 'image/jpeg' | 'image/webp' {
  return file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'
}

function renameTo(name: string, mime: string): string {
  const ext = mime === 'image/jpeg' ? 'jpg' : 'webp'
  return `${name.replace(/\.[^./\\]+$/, '')}.${ext}`
}

function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Decode via createImageBitmap when available (faster, and it applies EXIF
 * orientation), falling back to an <img> for older browsers.
 */
async function decode(
  file: File
): Promise<{source: CanvasImageSource; width: number; height: number; release: () => void}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'})
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch {
      // Safari < 15 rejects the options bag — fall through to the <img> path.
    }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Không đọc được file ảnh'))
      el.src = objectUrl
    })
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

/**
 * Downscale and re-encode an image so it comfortably fits the upload limit.
 *
 * Returns the original file untouched when shrinking is unnecessary or
 * impossible — compression is an optimisation, never a reason to block an
 * upload that would otherwise have worked.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (typeof window === 'undefined') return file
  if (!file.type.startsWith('image/')) return file

  // A canvas round-trip flattens animated GIFs, so leave them alone unless
  // they would be rejected outright anyway.
  if (file.type === 'image/gif' && file.size <= UPLOAD_LIMIT_BYTES) return file

  if (file.size <= SKIP_BELOW_BYTES) return file

  let release = () => {}
  try {
    const decoded = await decode(file)
    release = decoded.release

    const {source, width, height} = decoded
    if (!width || !height) return file

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

    const type = outputTypeFor(file)
    let quality = 0.85
    let blob = await encode(canvas, type, quality)
    while (blob && blob.size > TARGET_BYTES && quality > 0.5) {
      quality -= 0.15
      blob = await encode(canvas, type, quality)
    }

    // toBlob can return null, and a re-encode of an already-efficient file can
    // come out bigger than the original. Either way, the original is better.
    if (!blob || blob.size >= file.size) return file

    return new File([blob], renameTo(file.name, type), {
      type,
      lastModified: Date.now(),
    })
  } catch {
    return file
  } finally {
    release()
  }
}
