-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- Adds a flag so newly-created students are forced to set their own
-- PIN on first login, instead of keeping whatever temporary PIN the
-- teacher (or bulk-import) gave them.

alter table students add column if not exists must_change_pin boolean not null default true;

-- Don't force this on students who already exist and are used to their PIN —
-- only new accounts created from now on should be required to change it.
update students set must_change_pin = false;

-- Sanity check
select id, name, must_change_pin from students order by name;
