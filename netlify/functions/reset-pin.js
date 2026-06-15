/**
 * Netlify Function: reset-pin
 * Resets a student's Supabase auth password using the service role key.
 * The service role key is kept server-side only — never exposed to the browser.
 *
 * POST /api/reset-pin
 * Body: { auth_user_id: string, new_password: string }
 * Headers: { Authorization: "Bearer <teacher_access_token>" }
 */

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server misconfigured — missing env vars' }) };
  }

  // Verify the caller is an authenticated teacher
  const authHeader = event.headers['authorization'] || '';
  const callerToken = authHeader.replace('Bearer ', '').trim();
  if (!callerToken) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  // Verify the caller's token is valid by hitting Supabase /auth/v1/user
  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${callerToken}`,
      'apikey': SERVICE_KEY,
    },
  });
  if (!verifyRes.ok) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid session' }) };
  }
  const caller = await verifyRes.json();

  // Role can be in user_metadata or app_metadata depending on how the account was created
  const role =
    caller?.user_metadata?.role ||
    caller?.app_metadata?.role ||
    caller?.role; // some Supabase versions put it here

  // If role isn't in JWT metadata, fall back to checking the profiles table
  let confirmedRole = role;
  if (!confirmedRole || (confirmedRole !== 'teacher' && confirmedRole !== 'admin')) {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${caller.id}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
        },
      }
    );
    if (profileRes.ok) {
      const profiles = await profileRes.json();
      confirmedRole = profiles?.[0]?.role;
    }
  }

  if (confirmedRole !== 'teacher' && confirmedRole !== 'admin') {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only teachers can reset PINs', debug_role: role, debug_confirmed: confirmedRole }) };
  }

  // Parse request body
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { auth_user_id, new_password } = body;
  if (!auth_user_id || !new_password) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'auth_user_id and new_password are required' }) };
  }

  // Validate PIN: must be 8 digits, not all the same
  if (!/^\d{8}$/.test(new_password)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'PIN must be exactly 8 digits' }) };
  }
  if (/^(\d)\1{7}$/.test(new_password)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'PIN cannot be 8 of the same digit' }) };
  }

  // Use service role key to update the student's password
  const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${auth_user_id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
    },
    body: JSON.stringify({ password: new_password }),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    return { statusCode: updateRes.status, headers, body: JSON.stringify({ error: err.message || 'Update failed' }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
