/**
 * Netlify Function: upload-image
 * Uploads a base64 image to Cloudflare R2 and returns its public URL.
 * R2 credentials are kept server-side only — never exposed to the browser.
 *
 * POST /.netlify/functions/upload-image
 * Body: { dataUrl: "data:image/webp;base64,...", folder: "cards" }
 * Headers: { Authorization: "Bearer <user_access_token>" }
 */

const { AwsClient } = require('aws4fetch');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
  const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
  const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
  const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  const BUCKET = process.env.R2_BUCKET_NAME;
  const PUBLIC_BASE = process.env.R2_PUBLIC_URL; // e.g. https://pub-xxxxxxxx.r2.dev (no trailing slash)

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET || !PUBLIC_BASE) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfigured — missing env vars (check R2_* and Supabase vars in Netlify settings)' }) };
  }

  // Require a logged-in caller — prevents this endpoint being used as an open file host
  const authHeader = event.headers['authorization'] || '';
  const callerToken = authHeader.replace('Bearer ', '').trim();
  if (!callerToken) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorised' }) };
  }
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${callerToken}`, 'apikey': SUPABASE_ANON_KEY },
  });
  if (!verifyRes.ok) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid session' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { dataUrl, folder } = body;
  if (!dataUrl || typeof dataUrl !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'dataUrl is required' }) };
  }

  // If it's already a real URL (e.g. an AI-generated image from Pollinations, or
  // already migrated), there's nothing to upload — just hand it straight back.
  if (!dataUrl.startsWith('data:')) {
    return { statusCode: 200, headers, body: JSON.stringify({ url: dataUrl }) };
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Could not parse data URL — expected a base64 image' }) };
  }
  const contentType = match[1];
  const base64Data = match[2];
  const bytes = Buffer.from(base64Data, 'base64');

  const ext = (contentType.split('/')[1] || 'webp').split('+')[0];
  const safeFolder = (folder || 'misc').replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';
  const key = `${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  const r2 = new AwsClient({ accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
  const endpoint = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${key}`;

  try {
    const res = await r2.fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: bytes,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { statusCode: res.status, headers, body: JSON.stringify({ error: 'R2 upload failed: ' + errText }) };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'R2 upload failed: ' + (err.message || 'unknown error') }) };
  }

  const publicUrl = `${PUBLIC_BASE.replace(/\/$/, '')}/${key}`;
  return { statusCode: 200, headers, body: JSON.stringify({ url: publicUrl }) };
};
