-- ============================================================
-- DIAGNOSTIC — read-only. Changes nothing.
--
-- Paste this whole file into Supabase → SQL Editor, run it, and send me the
-- result table. It's one query so the editor shows everything at once.
--
-- Read it top to bottom:
--   1  TABLE GRANTS   — every table `authenticated` may touch, and how
--   2  FUNCTIONS      — do the helper functions exist and can the app run them
--   3  TEACHER LOGINS — what role your teacher account actually has
-- ============================================================

select section, detail
from (

  -- ── 1. Which tables can the app reach, and for what? ──────────────
  -- A table missing from this list entirely means `authenticated` has NO
  -- permission on it, which produces "permission denied for table…" or a
  -- bare 403 in the browser console.
  select
    1 as sort_order,
    '1 TABLE GRANTS' as section,
    g.table_name || '  →  ' || string_agg(distinct g.privilege_type, ', ') as detail
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.grantee = 'authenticated'
    and g.table_name in (
      'students', 'profiles', 'cards', 'student_star_points', 'student_unlocks',
      'aura3d_question_banks', 'aura3d_teacher_settings', 'aura3d_worlds',
      'trade_listings', 'trade_offers'
    )
  group by g.table_name

  union all

  -- ── 2. Do the helper functions exist, and may the app execute them? ──
  -- These are called from inside RLS policies. A policy that calls a function
  -- the caller can't execute makes the WHOLE query fail with a 403 — which
  -- would explain a plain student list suddenly returning 403.
  select
    2,
    '2 FUNCTIONS',
    p.proname
      || '  →  ' || case when p.prosecdef then 'security definer' else 'SECURITY INVOKER ← should be definer' end
      || ',  owned by ' || pg_get_userbyid(p.proowner)
      || ',  app may run it: '
      || case when has_function_privilege('authenticated', p.oid, 'execute') then 'YES' else 'NO ← problem' end
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'app_is_teacher', 'app_current_student_id', 'app_current_student_teacher_id',
      'aura3d_current_student_id', 'aura3d_is_world_member', 'aura3d_is_world_teacher',
      'aura3d_world_state', 'aura3d_create_world', 'aura3d_join_world', 'aura3d_leave_world',
      'accept_trade_offer', 'students_protect_managed_columns'
    )

  union all

  -- ── 3. What role does your teacher login actually have? ──────────────
  -- The new policies only let someone add a student if app_is_teacher() is
  -- true, which requires profiles.role to be exactly 'teacher' or 'admin'
  -- (lowercase). If your account's role is anything else — or NULL, or the
  -- profiles row is missing — adding a student fails with exactly the
  -- row-level security error you're seeing.
  select
    3,
    '3 TEACHER LOGINS',
    coalesce(u.email, '(no email)')
      || '  →  role = ' || coalesce('''' || p.role || '''', 'NULL')
      || ',  counts as a teacher: '
      || case when p.role in ('teacher', 'admin') then 'YES' else 'NO ← this is why adding a student fails' end
  from profiles p
  left join auth.users u on u.id = p.id
  where p.role is distinct from 'student'

  union all

  -- A profiles row that doesn't exist at all is worth spotting too.
  select
    3,
    '3 TEACHER LOGINS',
    u.email || '  →  HAS NO PROFILES ROW AT ALL ← this would also break it'
  from auth.users u
  where not exists (select 1 from profiles p where p.id = u.id)

) checks
order by sort_order, section, detail;
