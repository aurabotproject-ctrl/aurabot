-- ============================================================
-- FIX: "new row violates row-level security policy for table students"
--      when a teacher adds a new student.
--
-- Run this ONCE in Supabase → SQL Editor. Safe to re-run.
-- It only ADDS policies — nothing existing is dropped or narrowed.
-- ============================================================
--
-- WHERE THIS SITS
--
-- The previous file fixed the GRANT layer ("may this role touch the table
-- at all?"). Getting a *different* error afterwards is the expected sign
-- that it worked — the request now reaches the second layer, RLS, which
-- decides which rows are allowed. The `students` table has RLS switched on
-- but no policy saying a teacher may INSERT a student, so every insert is
-- refused no matter who makes it.
--
-- Row Level Security denies by default: if no policy grants an action, that
-- action is impossible, even for the table's owner. Policies are OR'd
-- together, so adding the ones below can't override or weaken any policy
-- that's already there — it only opens up the specific cases the Teacher
-- page needs.
-- ============================================================


-- ------------------------------------------------------------
-- 1. "Is the person making this request a teacher?"
--
-- SECURITY DEFINER so the check itself isn't filtered by whatever policies
-- exist on `profiles`. Without that, a policy on `students` that reads
-- `profiles` can quietly evaluate to false — or, if `profiles` has a policy
-- that reads `students`, recurse — and the failure looks identical to a
-- genuine permission problem, which is miserable to debug.
-- ------------------------------------------------------------

create or replace function app_is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
     where p.id = auth.uid()
       and p.role in ('teacher', 'admin')
  );
$$;

grant execute on function app_is_teacher() to authenticated, service_role;


-- ------------------------------------------------------------
-- 2. A teacher may create students belonging to themselves
--
-- `with check` runs against the row being written. Requiring
-- teacher_id = auth.uid() means a teacher can only ever create a student
-- attached to their own account, never to a colleague's — and the
-- app_is_teacher() test stops a student account from creating student rows
-- at all, which the teacher_id check alone wouldn't prevent.
-- ------------------------------------------------------------

drop policy if exists "students_insert_by_own_teacher" on students;
create policy "students_insert_by_own_teacher"
  on students for insert
  to authenticated
  with check (teacher_id = auth.uid() and app_is_teacher());


-- ------------------------------------------------------------
-- 3. A teacher may edit and remove their own students
--
-- The Teacher page already relies on being able to do both — renaming a
-- student, changing their login email, clearing must_change_pin, and
-- resetting their 3D Aura build. If policies for these already exist this
-- block changes nothing in practice; if they don't, it fixes the same class
-- of failure before you hit it.
--
-- Both `using` (which rows may be targeted) and `with check` (what they may
-- be changed into) are pinned to the teacher's own students, so a teacher
-- can't reassign a student to someone else's class.
-- ------------------------------------------------------------

drop policy if exists "students_update_by_own_teacher" on students;
create policy "students_update_by_own_teacher"
  on students for update
  to authenticated
  using (teacher_id = auth.uid() and app_is_teacher())
  with check (teacher_id = auth.uid() and app_is_teacher());

drop policy if exists "students_delete_by_own_teacher" on students;
create policy "students_delete_by_own_teacher"
  on students for delete
  to authenticated
  using (teacher_id = auth.uid() and app_is_teacher());


-- ------------------------------------------------------------
-- 4. A teacher may read their own students
--
-- Listing students already works for you, so a suitable read policy plainly
-- exists. This is here only so that the four actions are defined in one
-- place; because policies are OR'd, an extra read policy that says the same
-- thing has no effect.
-- ------------------------------------------------------------

drop policy if exists "students_select_by_own_teacher" on students;
create policy "students_select_by_own_teacher"
  on students for select
  to authenticated
  using (teacher_id = auth.uid() and app_is_teacher());


-- ============================================================
-- 5. WHAT'S NOW IN PLACE
--
-- This runs automatically as the last statement, so the SQL Editor will show
-- the result. You should see rows for INSERT, SELECT, UPDATE and DELETE.
-- If adding a student still fails, send me this table.
--
-- `qual` is the "which existing rows" test; `with_check` is the "what may be
-- written" test. An INSERT policy only ever has with_check.
-- ============================================================

select
  policyname,
  cmd            as applies_to,
  roles          as for_roles,
  qual           as row_visibility_rule,
  with_check     as write_rule
from pg_policies
where schemaname = 'public'
  and tablename  = 'students'
order by cmd, policyname;
