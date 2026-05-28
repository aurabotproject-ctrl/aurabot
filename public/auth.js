// ============================================================
// auth.js — Authentication & session helpers
// ============================================================

const Auth = (() => {

  // ── Sign in with email + password ─────────────────────────
  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  // ── Sign up (used by admin to create teacher/student accounts)
  // We use a Supabase Edge Function workaround: admin creates users
  // via the service role. For the client-only version we use signUp
  // and immediately set the role in profiles table.
  async function signUp(email, password, role, name) {
    const { data, error } = await sb.auth.signUp({ 
      email, 
      password,
      // THIS PART WAS MISSING:
      options: {
        data: { 
          role: role, 
          name: name 
        }
      }
    });
    
    if (error) throw error;
    const user = data.user;
    if (!user) throw new Error('Sign-up failed — check email confirmation settings in Supabase.');

    return user;
  }

  // ── Sign out ───────────────────────────────────────────────
  async function signOut() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  // ── Get current session user ───────────────────────────────
  async function getUser() {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  }

  // ── Get profile (role, name) for a user ───────────────────
  async function getProfile(userId) {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  }

  // ── Get current user + profile in one call ─────────────────
  async function getSession() {
    const user = await getUser();
    if (!user) return null;
    const profile = await getProfile(user.id);
    return { user, profile };
  }

  // ── Redirect to correct dashboard based on role ────────────
  function redirectByRole(role) {
    const map = {
      admin:   'admin.html',
      teacher: 'teacher.html',
      student: 'student.html',
    };
    const target = map[role];
    if (target && !window.location.pathname.endsWith(target)) {
      window.location.href = target;
    }
  }

  // ── Guard: redirect to login if not signed in ─────────────
  async function requireAuth(expectedRole) {
    const session = await getSession();
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }
    if (expectedRole && session.profile.role !== expectedRole && session.profile.role !== 'admin') {
      window.location.href = 'index.html';
      return null;
    }
    return session;
  }

  return { signIn, signUp, signOut, getUser, getProfile, getSession, redirectByRole, requireAuth };
})();
