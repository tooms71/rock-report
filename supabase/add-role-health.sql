-- Run once in the Supabase SQL editor BEFORE the new role colours go live.
-- Role statuses become: going well (green), slow (yellow), struggling (gray, shown to the
-- team as yellow), blocked (red; the old "stalled"), plus the two offer statuses.
-- Widens the allowed values. Safe to re-run; existing rows are untouched.

do $$
declare old_check text;
begin
  select conname into old_check from pg_constraint
    where conrelid = 'role_updates'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%';
  if old_check is not null then
    execute format('alter table role_updates drop constraint %I', old_check);
  end if;
  alter table role_updates add constraint role_updates_status_check
    check (status in ('on_track', 'slow', 'struggling', 'stalled', 'offer_extended', 'offer_accepted'));
end $$;
