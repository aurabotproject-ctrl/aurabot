-- ============================================================
-- FIX: card trading is completely non-functional
--
-- Run this ONCE in Supabase → SQL Editor. Safe to re-run.
--
-- ⚠️ This one DOES need an app rebuild and redeploy afterwards, unlike the
--    previous permission fixes — accepting a trade now runs through a
--    database function, and ShopPage.tsx has been changed to call it.
-- ============================================================
--
-- WHAT WAS WRONG
--
-- `trade_listings` and `trade_offers` both had Row Level Security switched
-- ON with no policies at all. RLS denies whatever isn't explicitly allowed,
-- so with zero policies those tables were sealed shut — not just writes,
-- reads too. Listing a card, making an offer, and responding to one could
-- never have worked.
--
-- WHY ACCEPTING A TRADE NEEDED A DIFFERENT APPROACH
--
-- Accepting an offer moves cards BETWEEN two students. Done from the
-- browser, that requires a policy letting a child update cards belonging to
-- a classmate — which is the same as letting any child reassign any
-- classmate's cards to themselves from browser dev tools. In a class of
-- card collectors that's an obvious target.
--
-- So the swap now happens inside accept_trade_offer() below, which runs
-- with the database's own privileges and re-checks everything server-side.
-- The `cards` table needs no new permissions at all as a result.
--
-- It also fixes a real bug in the old approach: the swap was five separate
-- requests, so a dropped connection halfway through could move one side's
-- cards and not the other's, or charge a star fee for a trade that never
-- completed. A database function is one transaction — it either all happens
-- or none of it does.
-- ============================================================


-- ------------------------------------------------------------
-- 1. "Which class is the person making this request in?"
--
-- Trading is scoped to a class: you trade with your own classmates. This
-- returns the teacher_id of the caller's student row, and pairs with
-- app_current_student_id() from the previous migration.
-- ------------------------------------------------------------

create or replace function app_current_student_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.teacher_id from students s where s.id = app_current_student_id();
$$;

grant execute on function app_current_student_teacher_id() to authenticated, service_role;


-- ------------------------------------------------------------
-- 2. Table permissions (the GRANT layer, same as before)
-- ------------------------------------------------------------

grant select, insert, update, delete on table trade_listings to authenticated;
grant select, insert, update, delete on table trade_offers   to authenticated;
grant all on table trade_listings to service_role;
grant all on table trade_offers   to service_role;


-- ------------------------------------------------------------
-- 3. trade_listings — "cards I'm putting up for trade"
--
-- Everyone in the class can see what's on offer; you can only list your own
-- cards, and only take down your own listing. Listings are marked
-- 'completed' by accept_trade_offer(), not from the browser.
-- ------------------------------------------------------------

drop policy if exists "trade_listings_select_own_class" on trade_listings;
create policy "trade_listings_select_own_class"
  on trade_listings for select
  to authenticated
  using (teacher_id = app_current_student_teacher_id() or teacher_id = auth.uid());

drop policy if exists "trade_listings_insert_own" on trade_listings;
create policy "trade_listings_insert_own"
  on trade_listings for insert
  to authenticated
  with check (
    student_id = app_current_student_id()
    and teacher_id = app_current_student_teacher_id()
  );

drop policy if exists "trade_listings_update_own" on trade_listings;
create policy "trade_listings_update_own"
  on trade_listings for update
  to authenticated
  using (student_id = app_current_student_id() or teacher_id = auth.uid())
  with check (student_id = app_current_student_id() or teacher_id = auth.uid());

drop policy if exists "trade_listings_delete_own" on trade_listings;
create policy "trade_listings_delete_own"
  on trade_listings for delete
  to authenticated
  using (student_id = app_current_student_id() or teacher_id = auth.uid());


-- ------------------------------------------------------------
-- 4. trade_offers — "swaps proposed between two students"
--
-- You can only send an offer as yourself. You can withdraw an offer you
-- sent, or decline one sent to you — but accepting goes through the
-- function in section 5, because that's what moves the cards.
-- ------------------------------------------------------------

drop policy if exists "trade_offers_select_own_class" on trade_offers;
create policy "trade_offers_select_own_class"
  on trade_offers for select
  to authenticated
  using (teacher_id = app_current_student_teacher_id() or teacher_id = auth.uid());

drop policy if exists "trade_offers_insert_own" on trade_offers;
create policy "trade_offers_insert_own"
  on trade_offers for insert
  to authenticated
  with check (
    from_student_id = app_current_student_id()
    and teacher_id = app_current_student_teacher_id()
  );

drop policy if exists "trade_offers_update_own_side" on trade_offers;
create policy "trade_offers_update_own_side"
  on trade_offers for update
  to authenticated
  using (
    from_student_id = app_current_student_id()
    or to_student_id = app_current_student_id()
    or teacher_id = auth.uid()
  )
  with check (
    from_student_id = app_current_student_id()
    or to_student_id = app_current_student_id()
    or teacher_id = auth.uid()
  );

drop policy if exists "trade_offers_delete_own" on trade_offers;
create policy "trade_offers_delete_own"
  on trade_offers for delete
  to authenticated
  using (from_student_id = app_current_student_id() or teacher_id = auth.uid());


-- ------------------------------------------------------------
-- 5. accept_trade_offer() — the whole swap, in one transaction
--
-- p_fee_student_ids is the list of students to charge the 1 ⭐ trade fee.
-- The app passes both traders, minus any test accounts — exactly as the old
-- browser-side code did.
--
-- Everything that matters is re-checked here rather than trusted from the
-- browser: that the offer exists, is still pending, is addressed to the
-- caller, and that both sides genuinely still own every card they're
-- putting in. A card that moved in another trade a second earlier makes the
-- whole thing fail cleanly instead of half-completing.
-- ------------------------------------------------------------

create or replace function accept_trade_offer(
  p_offer_id uuid,
  p_fee_student_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_student_id uuid := app_current_student_id();
  v_offer      trade_offers%rowtype;
  v_all_ids    uuid[];
  v_bad        int;
  v_points     int;
begin
  if v_student_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_a_student');
  end if;

  -- Lock the offer so the same trade can't be accepted twice by a double-tap.
  select * into v_offer from trade_offers where id = p_offer_id for update;

  if v_offer.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_offer.to_student_id <> v_student_id then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;
  if v_offer.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_answered');
  end if;

  v_all_ids := coalesce(v_offer.requested_card_ids, '{}') || coalesce(v_offer.offered_card_ids, '{}');

  -- Does each side still own everything they're trading away?
  select count(*) into v_bad
    from cards c
   where c.id = any(coalesce(v_offer.requested_card_ids, '{}'))
     and c.student_id is distinct from v_offer.to_student_id;
  if v_bad > 0 then
    update trade_offers set status = 'declined', responded_at = now() where id = p_offer_id;
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;

  select count(*) into v_bad
    from cards c
   where c.id = any(coalesce(v_offer.offered_card_ids, '{}'))
     and c.student_id is distinct from v_offer.from_student_id;
  if v_bad > 0 then
    update trade_offers set status = 'declined', responded_at = now() where id = p_offer_id;
    return jsonb_build_object('ok', false, 'reason', 'stale');
  end if;

  -- The swap.
  update cards set student_id = v_offer.from_student_id
   where id = any(coalesce(v_offer.requested_card_ids, '{}'));
  update cards set student_id = v_offer.to_student_id
   where id = any(coalesce(v_offer.offered_card_ids, '{}'));

  -- Close any open listing for a card that just changed hands. The old code
  -- only closed listings for the requested cards, which left the offerer's
  -- cards sitting up for trade after they no longer owned them.
  update trade_listings set status = 'completed'
   where card_id = any(v_all_ids) and status = 'open';

  update trade_offers set status = 'accepted', responded_at = now() where id = p_offer_id;

  -- 1 ⭐ trade fee, never below zero.
  if array_length(p_fee_student_ids, 1) is not null then
    update student_star_points
       set points = greatest(0, coalesce(points, 0) - 1)
     where student_id = any(p_fee_student_ids);
  end if;

  -- Any other pending offer involving one of these cards is now impossible.
  update trade_offers
     set status = 'declined', responded_at = now()
   where teacher_id = v_offer.teacher_id
     and status = 'pending'
     and id <> p_offer_id
     and (
       coalesce(requested_card_ids, '{}') && v_all_ids
       or coalesce(offered_card_ids, '{}') && v_all_ids
     );

  select points into v_points from student_star_points where student_id = v_student_id;

  return jsonb_build_object('ok', true, 'starPoints', coalesce(v_points, 0));
end;
$$;

grant execute on function accept_trade_offer(uuid, uuid[]) to authenticated, service_role;


-- ============================================================
-- 6. CHECK IT WORKED
-- ============================================================

select tablename, cmd as applies_to, policyname
  from pg_policies
 where schemaname = 'public'
   and tablename in ('trade_listings', 'trade_offers')
 order by tablename, cmd, policyname;
