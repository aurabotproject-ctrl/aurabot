-- ============================================================
-- FIX: "permission denied for table aura3d_question_banks"
--      (and the same error when creating a new student)
--
-- Run this ONCE in Supabase → SQL Editor, after the other two migrations.
-- Safe to re-run. Nothing is dropped or changed — this only ADDS the table
-- permissions that were missing.
-- ============================================================
--
-- WHY THIS HAPPENED
--
-- Supabase has two completely separate layers of access control, and it's
-- easy to think you've done one when you've actually only done the other:
--
--   1. GRANTs        — "is this role allowed to touch this table at all?"
--   2. RLS policies  — "which ROWS of that table can it touch?"
--
-- The earlier migrations set up layer 2 (the policies) but assumed layer 1
-- was handled automatically. In most Supabase projects it is: a default
-- privilege rule hands new tables to `authenticated` as they're created. In
-- this project that didn't happen, so the tables existed with correct row
-- policies that nobody had permission to reach in the first place.
--
-- You can tell the two apart from the error message:
--   • "permission denied for table X"                    → a GRANT problem (this file)
--   • "new row violates row-level security policy for X" → an RLS problem
--
-- WHY CREATING A STUDENT BROKE AT THE SAME TIME
--
-- The shared-worlds migration added a foreign key from students.aura3d_world_id
-- to aura3d_worlds. Inserting a student now involves looking at aura3d_worlds,
-- and `authenticated` had no permission on that table either — so a completely
-- unrelated feature started failing. Granting on aura3d_worlds below fixes it.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Table permissions
--
-- These are the standard Supabase grants. They intentionally do NOT open the
-- data up: RLS is still switched on for every one of these tables, so the
-- policies from the previous migrations are still what decides which rows any
-- given teacher or student can actually see and change. This only gets them
-- through the front door so those policies get a chance to run.
-- ------------------------------------------------------------

grant usage on schema public to authenticated, anon;

-- Teacher's replacement kiosk quiz questions.
-- Teachers write their own rows; students read their teacher's rows.
grant select, insert, update, delete on table aura3d_question_banks to authenticated;
grant all    on table aura3d_question_banks to service_role;

-- Shared co-op worlds.
grant select, insert, update, delete on table aura3d_worlds to authenticated;
grant all    on table aura3d_worlds to service_role;

-- Needed so the students → aura3d_worlds foreign key can be checked when a
-- teacher creates or updates a student row. This is what fixes "Database error
-- saving new student".
grant references on table aura3d_worlds to authenticated;

-- The day/night + pet-distance settings table from the first 3D Aura
-- migration had exactly the same gap. It hasn't caused a visible error yet
-- only because saving those settings is rarer, but it would have.
grant select, insert, update, delete on table aura3d_teacher_settings to authenticated;
grant all    on table aura3d_teacher_settings to service_role;


-- ------------------------------------------------------------
-- 2. Function permissions
--
-- aura3d_is_world_member() and aura3d_is_world_teacher() are called from
-- inside the RLS policies on aura3d_worlds. Policy expressions run as the
-- person making the query, not as the policy's author, so `authenticated`
-- needs to be allowed to execute them or every read of a shared world fails.
-- ------------------------------------------------------------

grant execute on function aura3d_current_student_id()        to authenticated, service_role;
grant execute on function aura3d_is_world_member(uuid)       to authenticated, service_role;
grant execute on function aura3d_is_world_teacher(uuid)      to authenticated, service_role;
grant execute on function aura3d_world_state()               to authenticated, service_role;
grant execute on function aura3d_create_world()              to authenticated, service_role;
grant execute on function aura3d_join_world(text)            to authenticated, service_role;
grant execute on function aura3d_leave_world()               to authenticated, service_role;


-- ------------------------------------------------------------
-- 3. Stop this happening again
--
-- Tells Postgres to hand any FUTURE table created by this role to the app
-- roles automatically — which is the rule that was missing. Without it, the
-- next migration that adds a table will hit this same wall.
-- ------------------------------------------------------------

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;


-- ============================================================
-- 4. CHECK IT WORKED
--
-- Run this on its own afterwards. You should get one row per table with
-- SELECT/INSERT/UPDATE/DELETE listed for `authenticated`. If any of the three
-- tables is missing from the results, something above didn't apply — send me
-- the output.
-- ============================================================

-- select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
--   from information_schema.role_table_grants
--  where table_schema = 'public'
--    and table_name in ('aura3d_question_banks', 'aura3d_worlds', 'aura3d_teacher_settings')
--    and grantee in ('authenticated', 'anon', 'service_role')
--  group by table_name, grantee
--  order by table_name, grantee;
