-- ============================================================
-- 3D Aura — Shared co-op worlds + teacher-editable kiosk quiz banks
--
-- Run this ONCE in Supabase → SQL Editor, AFTER migration_aura3d.sql.
-- Safe to re-run (every statement is idempotent).
--
-- What this adds:
--   1. aura3d_worlds            — one row per shared world (up to 5 students)
--   2. students.aura3d_world_id — which shared world a student is in (null = own world)
--   3. students.aura3d_world_locked — true once they've left a shared world; blocks re-joining
--   4. aura3d_question_banks    — teacher's replacement kiosk quiz questions
--   5. A set of security-definer RPCs that enforce all the co-op rules
--      server-side, so the 5-person cap and the one-way join lock can't be
--      bypassed by editing anything in the browser.
-- ============================================================


-- ============================================================
-- 1. SHARED WORLDS
-- ============================================================

create table if not exists aura3d_worlds (
  id            uuid primary key default gen_random_uuid(),
  invite_code   text not null unique,
  owner_student_id uuid references students(id) on delete set null,
  teacher_id    uuid,
  -- Shared team economy: bankBalance + inventory for everyone in the world.
  -- (Pets stay personal and continue to live on each student's own row.)
  wallet        jsonb not null default '{}'::jsonb,
  -- Everything placed/built in the world: worldGrid + buildGrid.
  build         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists aura3d_worlds_invite_code_idx on aura3d_worlds (invite_code);

-- Which shared world (if any) this student is currently in.
-- NULL means they're playing their own personal world, saved on their own row
-- in students.aura3d_wallet / students.aura3d_build as before.
alter table students add column if not exists aura3d_world_id uuid;

-- Pets are bought with star points (a real classroom reward), so they belong to
-- the child rather than to a world. Pulling them out of the aura3d_wallet blob
-- means they survive joining a team world instead of being wiped along with the
-- personal world. Leaving a team world DOES clear them, as intended.
-- Older saves still have pets nested inside aura3d_wallet->'pets'; the game
-- falls back to that and rewrites them here on the next save.
alter table students add column if not exists aura3d_pets jsonb;

-- Set to true the moment a student LEAVES a shared world. Once true they can
-- never join (or create) another shared world again — they're returned to a
-- brand-new personal world, from scratch. This is the "think carefully before
-- you join, and before you leave" rule.
alter table students add column if not exists aura3d_world_locked boolean not null default false;

-- Foreign key added separately so re-running this file can't fail on a
-- constraint that already exists.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_aura3d_world_id_fkey'
  ) then
    alter table students
      add constraint students_aura3d_world_id_fkey
      foreign key (aura3d_world_id) references aura3d_worlds(id) on delete set null;
  end if;
end $$;

create index if not exists students_aura3d_world_id_idx on students (aura3d_world_id);


-- ============================================================
-- 2. HELPERS
--
-- These are `security definer` on purpose: they need to look up the caller's
-- student row and world membership WITHOUT being filtered by the very RLS
-- policies that are built on top of them (which would recurse). They only
-- ever read, and only ever answer questions about the caller themselves.
-- ============================================================

-- Maps the logged-in auth user to their students.id.
create or replace function aura3d_current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.student_id from profiles p
      where p.id = auth.uid() and p.role = 'student' limit 1),
    (select s.id from students s where s.auth_user_id = auth.uid() limit 1)
  );
$$;

-- True if the caller is currently a member of the given world.
create or replace function aura3d_is_world_member(p_world_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from students s
     where s.id = aura3d_current_student_id()
       and s.aura3d_world_id = p_world_id
  );
$$;

-- True if the caller is the teacher of at least one student in the given world.
-- Lets a teacher read/reset a shared world their class built.
create or replace function aura3d_is_world_teacher(p_world_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from students s
     where s.aura3d_world_id = p_world_id
       and s.teacher_id = auth.uid()
  );
$$;

-- Short, human-readable invite code. Deliberately excludes the characters
-- that get misread when a child copies a code off someone else's screen
-- (0/O, 1/I/L, 5/S, 8/B), so codes are always unambiguous when typed by hand.
create or replace function aura3d_generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet text := 'ACDEFGHJKMNPQRTUVWXY2346789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from aura3d_worlds w where w.invite_code = candidate);
  end loop;
  return candidate;
end;
$$;


-- ============================================================
-- 3. ROW LEVEL SECURITY ON aura3d_worlds
--
-- Reads and saves go straight from the game client, so members need direct
-- select/update on their own world row. Creating, joining and leaving are
-- NOT done through these policies — they go through the RPCs further down,
-- which is what enforces the 5-person cap and the join lock.
-- ============================================================

alter table aura3d_worlds enable row level security;

drop policy if exists "aura3d_worlds_select_member_or_teacher" on aura3d_worlds;
create policy "aura3d_worlds_select_member_or_teacher"
  on aura3d_worlds for select
  using (aura3d_is_world_member(id) or aura3d_is_world_teacher(id));

drop policy if exists "aura3d_worlds_update_member_or_teacher" on aura3d_worlds;
create policy "aura3d_worlds_update_member_or_teacher"
  on aura3d_worlds for update
  using (aura3d_is_world_member(id) or aura3d_is_world_teacher(id))
  with check (aura3d_is_world_member(id) or aura3d_is_world_teacher(id));

-- No insert/delete policy on purpose: worlds are only ever created by
-- aura3d_create_world() and only ever tidied up by aura3d_leave_world().


-- ============================================================
-- 4. THE CO-OP RPCs
-- ============================================================

-- Everything the game needs to know about the caller's world situation,
-- in one round trip at boot.
create or replace function aura3d_world_state()
returns jsonb
language plpgsql
volatile   -- not STABLE: it heals a dangling membership row, and Postgres
           -- refuses to run an UPDATE inside a non-volatile function
security definer
set search_path = public
as $$
declare
  v_student_id uuid := aura3d_current_student_id();
  v_student    students%rowtype;
  v_world      aura3d_worlds%rowtype;
  v_members    jsonb;
begin
  if v_student_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_a_student');
  end if;

  select * into v_student from students where id = v_student_id;

  if v_student.aura3d_world_id is null then
    return jsonb_build_object(
      'ok', true,
      'inWorld', false,
      'locked', coalesce(v_student.aura3d_world_locked, false)
    );
  end if;

  select * into v_world from aura3d_worlds where id = v_student.aura3d_world_id;

  -- Membership row pointing at a world that no longer exists: heal it rather
  -- than trapping the student in a broken state.
  if v_world.id is null then
    update students set aura3d_world_id = null where id = v_student_id;
    return jsonb_build_object(
      'ok', true, 'inWorld', false,
      'locked', coalesce(v_student.aura3d_world_locked, false)
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id,
           'name', s.name,
           'isOwner', s.id = v_world.owner_student_id
         ) order by s.name), '[]'::jsonb)
    into v_members
    from students s
   where s.aura3d_world_id = v_world.id;

  return jsonb_build_object(
    'ok', true,
    'inWorld', true,
    'locked', coalesce(v_student.aura3d_world_locked, false),
    'worldId', v_world.id,
    'inviteCode', v_world.invite_code,
    'isOwner', v_world.owner_student_id = v_student_id,
    'members', v_members,
    'memberCount', jsonb_array_length(v_members),
    'wallet', v_world.wallet,
    'build', v_world.build
  );
end;
$$;

-- Turns the caller's PERSONAL world into a shared one and hands back an
-- invite code. Their current money, inventory and build come with them, so
-- creating a shared world never costs the creator anything — it's only
-- LEAVING one that wipes progress.
create or replace function aura3d_create_world()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_student_id uuid := aura3d_current_student_id();
  v_student    students%rowtype;
  v_world_id   uuid;
  v_code       text;
begin
  if v_student_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_a_student');
  end if;

  select * into v_student from students where id = v_student_id;

  if v_student.aura3d_world_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_in_world');
  end if;

  if coalesce(v_student.aura3d_world_locked, false) then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;

  v_code := aura3d_generate_invite_code();

  insert into aura3d_worlds (invite_code, owner_student_id, teacher_id, wallet, build)
  values (
    v_code,
    v_student_id,
    v_student.teacher_id,
    coalesce(v_student.aura3d_wallet, '{}'::jsonb),
    coalesce(v_student.aura3d_build,  '{}'::jsonb)
  )
  returning id into v_world_id;

  update students set aura3d_world_id = v_world_id where id = v_student_id;

  return jsonb_build_object('ok', true, 'worldId', v_world_id, 'inviteCode', v_code);
end;
$$;

-- Joins an existing shared world by code. This is the destructive one: the
-- joiner's personal world is wiped, because from now on the shared world is
-- their only world.
create or replace function aura3d_join_world(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_student_id uuid := aura3d_current_student_id();
  v_student    students%rowtype;
  v_world      aura3d_worlds%rowtype;
  v_count      int;
begin
  if v_student_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_a_student');
  end if;

  select * into v_student from students where id = v_student_id;

  if coalesce(v_student.aura3d_world_locked, false) then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;

  if v_student.aura3d_world_id is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_in_world');
  end if;

  select * into v_world from aura3d_worlds
   where invite_code = upper(btrim(p_code));

  if v_world.id is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_code');
  end if;

  -- Lock the world row for the duration of this transaction so two students
  -- tapping "Join" at the same instant can't both slip past the cap of 5.
  perform 1 from aura3d_worlds where id = v_world.id for update;

  select count(*) into v_count from students where aura3d_world_id = v_world.id;
  if v_count >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'world_full');
  end if;

  -- Their personal world is gone the moment they join. Pets are lifted out of
  -- the old wallet blob first so star-bought pets come with them.
  update students
     set aura3d_world_id = v_world.id,
         aura3d_pets     = coalesce(v_student.aura3d_pets, v_student.aura3d_wallet -> 'pets'),
         aura3d_wallet   = null,
         aura3d_build    = null,
         aura3d_saved_at = now()
   where id = v_student_id;

  return jsonb_build_object('ok', true, 'worldId', v_world.id, 'inviteCode', v_world.invite_code);
end;
$$;

-- Leaves the shared world. The student is dropped back into a brand-new
-- personal world (no money, no inventory, no builds, no pets) and is
-- permanently blocked from joining or creating another shared world.
create or replace function aura3d_leave_world()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_student_id uuid := aura3d_current_student_id();
  v_student    students%rowtype;
  v_world_id   uuid;
  v_remaining  int;
begin
  if v_student_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_a_student');
  end if;

  select * into v_student from students where id = v_student_id;
  v_world_id := v_student.aura3d_world_id;

  if v_world_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_in_world');
  end if;

  -- Fresh start, exactly as described: money, pets and all.
  update students
     set aura3d_world_id     = null,
         aura3d_world_locked = true,
         aura3d_wallet       = null,
         aura3d_build        = null,
         aura3d_pets         = null,
         aura3d_saved_at     = now()
   where id = v_student_id;

  -- If that was the last member, the world has nobody left in it — remove it
  -- so abandoned worlds don't pile up and codes can be reused.
  select count(*) into v_remaining from students where aura3d_world_id = v_world_id;
  if v_remaining = 0 then
    delete from aura3d_worlds where id = v_world_id;
  else
    -- Hand ownership to a remaining member if the owner is the one leaving,
    -- so the world always has someone who can show the invite code.
    update aura3d_worlds
       set owner_student_id = (
             select s.id from students s where s.aura3d_world_id = v_world_id order by s.name limit 1
           )
     where id = v_world_id
       and (owner_student_id is null or owner_student_id = v_student_id);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function aura3d_world_state()        to authenticated;
grant execute on function aura3d_create_world()       to authenticated;
grant execute on function aura3d_join_world(text)     to authenticated;
grant execute on function aura3d_leave_world()        to authenticated;


-- ============================================================
-- 5. TEACHER-EDITABLE KIOSK QUIZ BANKS
--
-- One row per (teacher, bank). A missing row simply means "this teacher
-- hasn't changed that bank", and the game falls back to the built-in
-- default questions in quiz-questions.js — which is also exactly what the
-- "Restore Default" button does: it deletes the row.
--
-- bank_key is one of: 'landmark', 'words', 'people', 'art'
-- questions is: [{ "q": "...", "o": ["a","b","c","d"], "a": 0 }, ...] × 10
-- ============================================================

create table if not exists aura3d_question_banks (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  bank_key   text not null check (bank_key in ('landmark', 'words', 'people', 'art')),
  title      text,
  questions  jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (teacher_id, bank_key)
);

alter table aura3d_question_banks enable row level security;

-- Students need to read their own teacher's banks. There's nothing sensitive
-- in a quiz question, and the answer index is already sent to the browser by
-- the existing built-in banks, so this matches the current security model.
drop policy if exists "aura3d_banks_select_any_authenticated" on aura3d_question_banks;
create policy "aura3d_banks_select_any_authenticated"
  on aura3d_question_banks for select
  using (auth.role() = 'authenticated');

drop policy if exists "aura3d_banks_insert_own" on aura3d_question_banks;
create policy "aura3d_banks_insert_own"
  on aura3d_question_banks for insert
  with check (teacher_id = auth.uid());

drop policy if exists "aura3d_banks_update_own" on aura3d_question_banks;
create policy "aura3d_banks_update_own"
  on aura3d_question_banks for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists "aura3d_banks_delete_own" on aura3d_question_banks;
create policy "aura3d_banks_delete_own"
  on aura3d_question_banks for delete
  using (teacher_id = auth.uid());


-- ============================================================
-- Done. After running this:
--   • Students can create a shared world and invite up to 4 others.
--   • Joining wipes the joiner's personal world; leaving wipes everything
--     and permanently blocks re-joining. Both rules are enforced in the
--     database, not just in the game's UI.
--   • Teachers can replace any of the 4 kiosk quiz banks with their own
--     topic and 10 questions, and restore the originals at any time.
-- ============================================================
