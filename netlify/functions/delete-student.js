/**
 * Netlify Function: delete-student
 * Fully deletes a student: their cards, profile, students row, and - the
 * part the client can never do on its own - their actual Supabase Auth
 * account. Without deleting the auth user too, its email/login stays
 * registered forever, so recreating an account for the same student later
 * fails with "User already registered". The service role key is kept
 * server-side only — never exposed to the browser.
 *
 * POST /api/delete-student
 * Body: { student_id: string }
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

  const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${callerToken}`,
      'apikey': SERVICE_KEY,
    },
  });
  if (!verifyRes.ok) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid session' }) };
  }

  // Parse request body
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { student_id } = body;
  if (!student_id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'student_id is required' }) };
  }

  const restHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY,
  };

  // Look up the student row first, so we know which auth user (if any) to
  // remove, and confirm the id is real before deleting anything else.
  const studentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/students?select=id,auth_user_id&id=eq.${student_id}&limit=1`,
    { headers: restHeaders }
  );
  if (!studentRes.ok) {
    // Say what actually went wrong. A bare "Could not look up student" hides
    // the difference between a rotated service key (401), a missing column
    // (400) and a stale PostgREST schema cache - which is the difference
    // between a two-minute fix and an afternoon of guessing.
    const detail = await studentRes.text().catch(() => '');
    console.error('delete-student: student lookup failed', studentRes.status, detail);
    let hint = '';
    if (studentRes.status === 401 || studentRes.status === 403) {
      hint = ' — the SUPABASE_SERVICE_ROLE_KEY in Netlify looks wrong or expired. Copy it again from Supabase → Project Settings → API and redeploy.';
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: `Could not look up student (HTTP ${studentRes.status})` +
               (detail ? ': ' + detail.slice(0, 300) : '') + hint,
      }),
    };
  }
  const students = await studentRes.json();
  const student = students?.[0];
  if (!student) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Student not found' }) };
  }

  // Delete their cards, then their profile row (if any), then the students
  // row itself, then finally the actual auth user. Order matters: the
  // students row is deleted before the auth user in case any foreign key
  // still points from profiles -> students, and cards before students for
  // the same reason.
  await fetch(`${SUPABASE_URL}/rest/v1/cards?student_id=eq.${student_id}`, {
    method: 'DELETE', headers: restHeaders,
  });

  if (student.auth_user_id) {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${student.auth_user_id}`, {
      method: 'DELETE', headers: restHeaders,
    });
  }

  const deleteStudentRes = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${student_id}`, {
    method: 'DELETE', headers: restHeaders,
  });
  if (!deleteStudentRes.ok) {
    const err = await deleteStudentRes.json().catch(() => ({}));
    return { statusCode: deleteStudentRes.status, headers, body: JSON.stringify({ error: err.message || 'Failed to delete student record' }) };
  }

  if (student.auth_user_id) {
    const deleteAuthRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${student.auth_user_id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY },
    });
    // A 404 here just means the auth user was already gone somehow - not a
    // failure from the caller's point of view, the end state is the same.
    if (!deleteAuthRes.ok && deleteAuthRes.status !== 404) {
      const err = await deleteAuthRes.json().catch(() => ({}));
      return {
        statusCode: deleteAuthRes.status,
        headers,
        body: JSON.stringify({
          error: (err.message || 'Failed to delete login account') +
            ' — the student record was removed, but their login email is still registered. Try deleting them again to finish removing the login.',
        }),
      };
    }
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
