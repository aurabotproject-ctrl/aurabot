-- ============================================================
-- IMPORTANT FIX — students currently cannot save ANYTHING
--
-- Run this ONCE in Supabase → SQL Editor. Safe to re-run.
-- Only adds; nothing existing is dropped or narrowed.
-- ============================================================
--
-- WHAT THE POLICY LIST REVEALED
--
-- Before the last migration, the `students` table had exactly one policy:
--
--     "Anyone authenticated can view students"  →  SELECT only
--
-- Row Level Security denies anything a policy doesn't explicitly allow, so
-- with only a SELECT policy in place NOBODY could write to that table
-- through the app — not teachers, and crucially not students.
--
-- That means every one of these has been silently failing:
--
--     • 3D Aura saving money, inventory, builds and pets
--     • a student's robot colour / face / parts from Build-A-Bot
--     • clearing must_change_pin after a student sets their own PIN
--
-- The 3D Aura save code catches its own errors and only logs them to the
-- browser console, so this failed invisibly rather than showing a message.
-- That is a second, completely independent cause of the original "it isn't
-- saving their worlds" problem, sitting underneath the missing save calls I
-- already fixed in the game code. Both had to be wrong for the symptom you
-- described; both are now addressed.
--
-- The previous migration added teacher policies, which fixed adding a
-- student. This one adds the missing student-side policy.
-- ============================================================


-- ------------------------------------------------------------
-- 1. "Which student row belongs to the person making this request?"
--
-- Two different parts of the app identify a student two different ways —
-- some by students.auth_user_id, some via profiles.student_id — so this
-- accepts either. SECURITY DEFINER so the lookup isn't itself filtered by
-- the policies being built on top of it.
-- ------------------------------------------------------------

create or replace function app_current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.id from students s where s.auth_user_id = auth.uid() limit 1),
    (select p.student_id from profiles p
      where p.id = auth.uid() and p.role = 'student' limit 1)
  );
$$;

grant execute on function app_current_student_id() to authenticated, service_role;


-- ------------------------------------------------------------
-- 2. A student may update their own row — and only their own
-- ------------------------------------------------------------

drop policy if exists "students_update_own_row" on students;
create policy "students_update_own_row"
  on students for update
  to authenticated
  using (id = app_current_student_id())
  with check (id = app_current_student_id());


-- ------------------------------------------------------------
-- 3. Protecting the columns students must NOT be able to change
--
-- Section 2 lets a student write to their own row, but RLS works on whole
-- rows — it can't say "these columns yes, those columns no". Left there, a
-- child who knows their way around browser dev tools could flip
-- aura3d_world_locked back to false and rejoin team worlds forever, or move
-- themselves into a different class.
--
-- This trigger closes that off. `current_user` is 'authenticated' for
-- anything arriving through the app's API, but is the database owner inside
-- the aura3d_join_world() / aura3d_leave_world() functions — so those still
-- work normally, and nothing else can touch these four columns.
--
-- A trigger is used rather than column-level permissions deliberately:
-- column permissions would silently reject any NEW column added later,
-- which is a nasty trap to leave behind. This only ever guards the four
-- columns named here.
-- ------------------------------------------------------------

create or replace function students_protect_managed_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user = 'authenticated' then
    -- Team world membership is only ever changed by the co-op functions.
    new.aura3d_world_id     := old.aura3d_world_id;
    new.aura3d_world_locked := old.aura3d_world_locked;

    -- Which class a student is in, and which login they're attached to,
    -- are not theirs to change. Teachers keep the ability to fix these.
    if not app_is_teacher() then
      new.teacher_id   := old.teacher_id;
      new.auth_user_id := old.auth_user_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists students_protect_managed_columns_trg on students;
create trigger students_protect_managed_columns_trg
  before update on students
  for each row
  execute function students_protect_managed_columns();


-- ============================================================
-- 4. THE NEXT THING TO CHECK
--
-- Students also write to these tables — spending stars on pets and shop
-- items, unlocking things, and trading cards. If `students` was missing its
-- write policies, some of these may be too, and they'd fail just as quietly.
--
-- This runs as the last statement so the SQL Editor shows the result.
-- Read it like this: a table that shows only SELECT (or doesn't appear at
-- all) cannot be written to by anyone through the app.
--
-- Send me this table and I'll tell you which ones need fixing.
-- ============================================================

select
  t.tablename,
  case when t.rowsecurity then 'ON' else 'OFF — no policies apply' end as rls,
  coalesce(
    (select string_agg(distinct p.cmd, ', ' order by p.cmd)
       from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.tablename),
    '(no policies at all)'
  ) as actions_allowed_by_some_policy
from pg_tables t
where t.schemaname = 'public'
  and t.tablename in (
    'students', 'student_star_points', 'student_unlocks',
    'cards', 'trade_listings', 'trade_offers', 'profiles',
    'aura3d_worlds', 'aura3d_question_banks', 'aura3d_teacher_settings'
  )
order by t.tablename;
