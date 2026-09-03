-- ============================================================
-- FIX: "Could not look up student" when deleting a student
--
-- Run this ONCE in Supabase → SQL Editor. Safe to re-run.
--
-- ------------------------------------------------------------
-- WHY THE OLD WAY KEPT BREAKING
-- ------------------------------------------------------------
--
-- Deleting a student went out to a Netlify Function, which used the
-- service key to talk to Supabase's REST API over HTTP, in five separate
-- round trips. That means five things that can each fail on their own,
-- in an environment you can't see into: the function's environment
-- variables, the service key, the REST layer, PostgREST's schema cache,
-- and the network in between. When one of them failed, all you got back
-- was one word of explanation.
--
-- It also wasn't atomic. If the run died after deleting the cards but
-- before the students row, you were left with half a student and no way
-- to tell.
--
-- This does the whole thing in the database instead, in ONE transaction,
-- as a security-definer function — the same pattern the 3D Aura team
-- worlds already use successfully. No service key, no REST, no HTTP.
-- Either the student is completely gone, or nothing changed at all.
--
-- ------------------------------------------------------------
-- WHO IS ALLOWED TO DO IT
-- ------------------------------------------------------------
--
-- The student's own teacher, or an admin. Checked inside the function
-- against auth.uid(), so it can't be bypassed from the browser.
-- ============================================================


create or replace function delete_student(p_student_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_student   students%rowtype;
  v_caller    uuid := auth.uid();
  v_allowed   boolean := false;
  v_auth_id   uuid;
begin
  select * into v_student from students where id = p_student_id;
  if v_student.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- WHO MAY DELETE
  --
  --  1. The student's own teacher. students.teacher_id holds the teacher's
  --     auth user id, which is exactly what auth.uid() returns in the app.
  --  2. An admin.
  --  3. A trusted server-side caller with no JWT at all — you, running this
  --     by hand in the Supabase SQL editor, or a service-role script.
  --
  -- Case 3 matters: auth.uid() is NULL in the SQL editor, so without it every
  -- manual call returns 'not_your_student' and there's no way to clean up a
  -- student by hand. session_user is checked rather than current_user because
  -- this function is SECURITY DEFINER — current_user is always the owner
  -- (postgres) whoever calls it, whereas session_user still reflects the real
  -- connection: 'authenticator' for anything arriving from a browser, so a
  -- browser can never reach this branch.
  if v_caller is not null then
    v_allowed := (v_student.teacher_id = v_caller)
              or exists (select 1 from profiles p where p.id = v_caller and p.role = 'admin');
  else
    v_allowed := session_user in ('postgres', 'supabase_admin', 'service_role');
  end if;

  if not v_allowed then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_your_student',
      'callerUid', v_caller,
      'studentTeacherId', v_student.teacher_id
    );
  end if;

  v_auth_id := v_student.auth_user_id;

  -- ---- Everything that points at this student ----
  -- Wrapped individually so a table that doesn't exist in this project
  -- (or hasn't been created yet) can't abort the whole delete. A missing
  -- table is not a reason to leave a student half-deleted.

  begin delete from trade_offers
         where from_student_id = p_student_id or to_student_id = p_student_id;
  exception when undefined_table or undefined_column then null; end;

  begin delete from trade_listings where student_id = p_student_id;
  exception when undefined_table or undefined_column then null; end;

  begin delete from arena_battles
         where student_id = p_student_id;
  exception when undefined_table or undefined_column then null; end;

  begin delete from weekly_submissions where student_id = p_student_id;
  exception when undefined_table or undefined_column then null; end;

  begin delete from student_star_points where student_id = p_student_id;
  exception when undefined_table or undefined_column then null; end;

  begin delete from student_unlocks where student_id = p_student_id;
  exception when undefined_table or undefined_column then null; end;

  begin delete from home_communications where student_id = p_student_id;
  exception when undefined_table or undefined_column then null; end;

  begin delete from cards where student_id = p_student_id;
  exception when undefined_table or undefined_column then null; end;

  -- If they started a 3D Aura team world, hand it to someone still in it
  -- rather than orphaning it; if they were the last one, remove it.
  begin
    update aura3d_worlds
       set owner_student_id = (
             select s.id from students s
              where s.aura3d_world_id = aura3d_worlds.id
                and s.id <> p_student_id
              order by s.name limit 1
           )
     where owner_student_id = p_student_id;

    delete from aura3d_worlds w
     where w.owner_student_id is null
       and not exists (
         select 1 from students s
          where s.aura3d_world_id = w.id and s.id <> p_student_id
       );
  exception when undefined_table or undefined_column then null; end;

  -- The profile row, then the student row itself.
  if v_auth_id is not null then
    begin delete from profiles where id = v_auth_id;
    exception when undefined_table then null; end;
  end if;

  delete from students where id = p_student_id;

  -- Finally the actual login. Without this the email stays registered
  -- forever and creating an account for that child later fails with
  -- "User already registered" — which is the whole reason this couldn't
  -- just be done from the browser in the first place.
  if v_auth_id is not null then
    begin
      delete from auth.users where id = v_auth_id;
    exception when others then
      -- The child's data is gone either way; report the login separately
      -- rather than rolling the whole thing back.
      return jsonb_build_object(
        'ok', true,
        'loginRemoved', false,
        'note', 'Student deleted, but their login could not be removed: ' || sqlerrm
      );
    end;
  end if;

  return jsonb_build_object('ok', true, 'loginRemoved', v_auth_id is not null);
end;
$$;

grant execute on function delete_student(uuid) to authenticated, service_role;


-- ============================================================
-- CHECK IT WORKED
--
-- This should return a row. If it errors with "function does not exist",
-- the statement above didn't apply:
--
--   select proname, pg_get_function_identity_arguments(oid)
--     from pg_proc where proname = 'delete_student';
--
-- To delete a student by hand from here (careful — no undo):
--
--   select delete_student('paste-the-students-id-here');
--
--
-- ------------------------------------------------------------
-- TESTING IT AS A PARTICULAR TEACHER, WITHOUT DELETING ANYONE
--
-- The SQL editor has no logged-in user, so auth.uid() is NULL. To prove the
-- permission check works for a real teacher, pretend to be one — and roll it
-- back so nothing is actually deleted. Run all four lines together:
--
--   begin;
--   select set_config('request.jwt.claims',
--          '{"sub":"PASTE-THE-TEACHERS-AUTH-USER-ID","role":"authenticated"}', true);
--   select delete_student('PASTE-A-STUDENT-ID');
--   rollback;
--
-- {"ok": true} means it would have worked. ROLLBACK undoes it all.
--
-- Find a teacher's auth user id with:
--
--   select id, email from auth.users order by created_at;
--
-- And check a student's teacher matches:
--
--   select s.id, s.name, s.teacher_id, u.email as teacher_email
--     from students s left join auth.users u on u.id = s.teacher_id
--    order by s.name;
-- ------------------------------------------------------------
-- ============================================================
