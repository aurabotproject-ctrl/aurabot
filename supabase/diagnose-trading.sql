-- ============================================================
-- TRADING DIAGNOSTIC — read-only. Changes nothing, deletes nothing.
--
-- Run block 1 first. It is almost certainly the answer.
-- ============================================================


-- ------------------------------------------------------------
-- 1. CAN THE DATABASE TELL WHO EACH STUDENT IS?
--
-- Every trading permission rule is built on app_current_student_id().
-- That function maps a logged-in user to their students row, two ways:
--
--     students.auth_user_id = auth.uid()          ← preferred
--     profiles.student_id, where profiles.role = 'student'   ← fallback
--
-- If NEITHER matches, the function returns NULL for that child. Then:
--   • inserting a trade offer is refused by row-level security
--   • accept_trade_offer() returns 'not_a_student'
--   • ...while everything else in the app keeps working, because the
--     rest of the app filters by student_id directly instead of
--     relying on this function.
--
-- That is exactly the shape of "only trading is broken".
--
-- WHAT YOU WANT TO SEE: every row saying 'OK'.
-- Any row saying BROKEN is a child who cannot trade.
-- ------------------------------------------------------------
select
  s.name                                   as student,
  case
    when s.auth_user_id is not null        then 'OK  (via students.auth_user_id)'
    when p.id is not null and p.role = 'student'
                                           then 'OK  (via profiles.student_id)'
    when p.id is not null and p.role is distinct from 'student'
                                           then 'BROKEN — profile role is ''' || coalesce(p.role,'NULL') || ''', must be ''student'''
    else 'BROKEN — no login linked to this student at all'
  end                                      as can_they_trade,
  s.auth_user_id                           as students_auth_user_id,
  p.id                                     as profile_id,
  p.role                                   as profile_role,
  s.teacher_id
from students s
left join profiles p on p.student_id = s.id
order by
  case when s.auth_user_id is not null or (p.id is not null and p.role = 'student')
       then 1 else 0 end,     -- broken ones first
  s.name;


-- ------------------------------------------------------------
-- 2. IS ANY STUDENT MISSING A TEACHER?
--
-- Inserting a trade offer also requires the offer's teacher_id to match
-- the student's own teacher. A student with a NULL teacher_id can never
-- pass that check, so their offers are silently refused.
-- ------------------------------------------------------------
select name, id, teacher_id,
       case when teacher_id is null then 'BROKEN — no teacher set' else 'OK' end as status
from students
order by (teacher_id is not null), name;


-- ------------------------------------------------------------
-- 3. WHAT HAS ACTUALLY HAPPENED SO FAR?
--
-- If offers exist and are all 'pending', the children CAN send them and
-- the problem is at the accepting end. If there are NO offers at all,
-- sending is what's failing. This single number splits the search in half.
-- ------------------------------------------------------------
select
  (select count(*) from trade_listings)                        as listings_total,
  (select count(*) from trade_listings where status = 'open')  as listings_open,
  (select count(*) from trade_offers)                          as offers_total,
  (select count(*) from trade_offers where status = 'pending') as offers_pending,
  (select count(*) from trade_offers where status = 'accepted')as offers_accepted,
  (select count(*) from trade_offers where status = 'declined')as offers_declined;


-- ------------------------------------------------------------
-- 4. THE MOST RECENT OFFERS, IF ANY
-- ------------------------------------------------------------
select
  o.created_at,
  f.name  as from_student,
  t.name  as to_student,
  o.status,
  array_length(o.requested_card_ids, 1) as wants_n_cards,
  array_length(o.offered_card_ids, 1)   as offers_n_cards
from trade_offers o
left join students f on f.id = o.from_student_id
left join students t on t.id = o.to_student_id
order by o.created_at desc
limit 20;


-- ------------------------------------------------------------
-- 5. ARE THE TRADING TABLES REACHABLE AT ALL?
--
-- You want trade_listings and trade_offers here, for 'authenticated',
-- with SELECT/INSERT/UPDATE/DELETE. Missing = permission denied in the
-- browser.
-- ------------------------------------------------------------
select table_name, grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('trade_listings', 'trade_offers', 'cards', 'student_star_points')
  and grantee = 'authenticated'
group by table_name, grantee
order by table_name;
