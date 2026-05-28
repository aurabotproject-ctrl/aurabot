// ============================================================
// supabaseClient.js — Supabase initialisation
// Replace the two placeholder values below with your own from:
// https://supabase.com → Project Settings → API
// ============================================================

const SUPABASE_URL = 'https://iunoahajcaaxmttdpgem.supabase.co';          // e.g. https://xyzabc.supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_rUgPdjSjCcQfaEY0uc1mZw_vKqC_itL'; // public anon key

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
