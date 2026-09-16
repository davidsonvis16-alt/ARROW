import { getSupabase, supabase } from '../lib/supabase';

const BUCKET = 'arrow-profile-photos';

/**
 * Photo URL resolution for the private `arrow-profile-photos` bucket.
 *
 * The bucket is deliberately not public: a public bucket would let anyone with
 * a URL keep viewing someone's photos after a block, and would make every
 * profile picture on ARROW enumerable. Private storage means each object needs
 * a short-lived signed URL, and signing is itself authorized by the storage
 * policy, which defers to the same visibility rule as profiles.
 */

/** Signed URLs last an hour; re-sign a little early so nothing expires on screen. */
const SIGNED_URL_TTL_SECONDS = 3600;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Rows created before the private-bucket migration hold a full URL, not a path. */
function isStoragePath(value: string): boolean {
  return Boolean(value) && !value.startsWith('http') && !value.startsWith('data:') && !value.startsWith('blob:');
}

function cached(path: string): string | null {
  const hit = cache.get(path);
  if (hit && hit.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
    return hit.url;
  }
  return null;
}

/**
 * Turn stored photo references into displayable URLs, signing in a single
 * batched request per call rather than one round trip per photo.
 */
export async function resolvePhotoUrls(refs: Array<string | null | undefined>): Promise<string[]> {
  const values = refs.filter((r): r is string => Boolean(r));
  if (!supabase || values.length === 0) {
    return values;
  }

  const needSigning = values.filter((v) => isStoragePath(v) && !cached(v));
  const unique = Array.from(new Set(needSigning));

  if (unique.length > 0) {
    try {
      const { data, error } = await getSupabase()
        .storage.from(BUCKET)
        .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);

      if (!error && data) {
        const expiresAt = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;
        for (const item of data) {
          if (item.signedUrl && item.path) {
            cache.set(item.path, { url: item.signedUrl, expiresAt });
          }
        }
      }
    } catch (err) {
      console.warn('[arrow] failed to sign photo urls', err);
    }
  }

  // A photo we could not sign is dropped rather than rendered as a broken
  // image: an empty photo strip looks intentional, a broken one looks broken.
  return values
    .map((value) => (isStoragePath(value) ? cached(value) : value))
    .filter((url): url is string => Boolean(url));
}

/** Upload to the caller's own folder, then register it through the RPC. */
export function buildPhotoPath(userId: string, file: File | Blob): string {
  const name = (file as File).name || 'photo.jpg';
  const ext = (name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${userId}/${unique}.${ext}`;
}

export function forgetPhoto(path: string): void {
  cache.delete(path);
}
