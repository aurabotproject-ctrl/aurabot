-- ============================================================
-- 3D Aura cloud save + universal teacher settings
-- Run this once in Supabase → SQL Editor.
-- Safe to re-run (all statements are idempotent).
-- ============================================================

-- Per-student 3D Aura save data, split into two pieces on purpose:
--  - aura3d_wallet: money, inventory, and pets. Survives a "Reset Build".
--  - aura3d_build:  everything placed/built in the world. Cleared by "Reset Build".
alter table students add column if not exists aura3d_wallet jsonb;
alter table students add column if not exists aura3d_build jsonb;
alter table students add column if not exists aura3d_saved_at timestamptz;

-- These new columns inherit whatever row-level security policy already lets
-- a student update their own `students` row (the same one that already lets
-- them save their robot_color_index / face_pixels / bot_elements from the
-- client) - no new policy needed for this table.

-- ------------------------------------------------------------
-- Teacher-wide 3D Aura settings (day/night, fog distance, pet follow
-- distances). One row per teacher; every student under that teacher reads
-- the same row. Kept as its own table (rather than a column on `profiles`)
-- so its access rules are simple and self-contained, and don't depend on
-- whatever policies already exist on `profiles`.
-- ------------------------------------------------------------
create table if not exists aura3d_teacher_settings (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table aura3d_teacher_settings enable row level security;

-- Any signed-in user (teacher or student) can read any teacher's settings row -
-- there's nothing sensitive in it (just day/night + fog + pet-follow-distance
-- numbers), and students need to read their OWN teacher's row to apply it.
drop policy if exists "aura3d_settings_select_any_authenticated" on aura3d_teacher_settings;
create policy "aura3d_settings_select_any_authenticated"
  on aura3d_teacher_settings for select
  using (auth.role() = 'authenticated');

-- A teacher can only create/update their OWN settings row.
drop policy if exists "aura3d_settings_insert_own" on aura3d_teacher_settings;
create policy "aura3d_settings_insert_own"
  on aura3d_teacher_settings for insert
  with check (teacher_id = auth.uid());

drop policy if exists "aura3d_settings_update_own" on aura3d_teacher_settings;
create policy "aura3d_settings_update_own"
  on aura3d_teacher_settings for update
  using (teacher_id = auth.uid());

-- ============================================================
-- That's it. After running this:
--  - Every student's 3D Aura progress will save to their own students row.
--  - The Teacher page's "Reset Build" button clears aura3d_build only.
--  - The Teacher page's "3D Aura Settings" panel writes to
--    aura3d_teacher_settings, and every one of that teacher's students
--    picks the same values up next time they open 3D Aura.
-- ============================================================
