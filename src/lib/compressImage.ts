/**
 * Shrink a photo in the browser before it is uploaded.
 *
 * Phone cameras produce 3–5 MB images, which is ~30x more than a profile photo
 * needs on screen. Storage and bandwidth are the first Supabase limits a
 * growing dating app hits (six photos a person, viewed by everyone who swipes
 * past), so this is the single biggest lever on how many people a plan can
 * hold. Re-encoding also strips EXIF metadata, which on a phone photo often
 * includes the GPS position it was taken at — something nobody should leak to
 * strangers by uploading a selfie taken at home.
 */

const MAX_EDGE = 1440;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  // Anything the browser cannot decode is left to the server-side checks.
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    // Honour the camera's orientation tag, which re-encoding would otherwise lose.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY));
  // Safari without WebP encoding hands back a PNG; JPEG is smaller for photos.
  const finalBlob =
    blob && blob.type === 'image/webp'
      ? blob
      : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));

  if (!finalBlob || finalBlob.size >= file.size) return file;

  const ext = finalBlob.type === 'image/webp' ? 'webp' : 'jpg';
  const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
  return new File([finalBlob], `${base}.${ext}`, { type: finalBlob.type });
}
