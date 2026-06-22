-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- Stores whether the "Special" pack currently acts as a Lucky Dip
-- (mix of all themes) or as a named limited-time card set.

create table if not exists pack_settings (
  pack_id text primary key,
  is_lucky_dip boolean not null default true,
  set_name text,
  updated_at timestamptz not null default now()
);

-- Grant access + disable RLS up front, matching how the other
-- gameplay tables in this app work (avoids the 403 issue from before).
grant select, insert, update, delete on pack_settings to authenticated, anon;
alter table pack_settings disable row level security;

-- Seed the default row for the Special pack (defaults to Lucky Dip mode)
insert into pack_settings (pack_id, is_lucky_dip, set_name)
values ('special', true, null)
on conflict (pack_id) do nothing;

-- Sanity check
select * from pack_settings;
