-- Run this once in the Supabase SQL editor BEFORE using the new "Build the agenda" step.
-- It lets a session be in the new "agenda" phase. It changes no data and is safe to re-run.
do $$
declare old_check text;
begin
  select conname into old_check from pg_constraint
    where conrelid = 'sessions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%phase%';
  if old_check is not null then
    execute format('alter table sessions drop constraint %I', old_check);
  end if;
  alter table sessions add constraint sessions_phase_check
    check (phase in ('lobby', 'writing', 'reveal', 'agenda', 'closed'));
end $$;
