import { sb } from './supabase';

/**
 * Uploads a base64 data URL image to Cloudflare R2 (via the upload-image
 * Netlify function) and returns the resulting public URL.
 *
 * If the input is already a real URL (not a base64 data URL — e.g. an
 * AI-generated image, or one that's already been migrated), it's returned
 * unchanged with no upload performed.
 *
 * `folder` groups uploads in the bucket (e.g. 'cards', 'packs') purely for
 * tidiness when browsing the bucket — it doesn't affect functionality.
 */
export async function uploadImageToR2(dataUrl: string, folder: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl; // nothing to upload — already a real URL (or empty)
  }

  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('You must be signed in to upload images.');

  const res = await fetch('/.netlify/functions/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ dataUrl, folder }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
  return json.url;
}
