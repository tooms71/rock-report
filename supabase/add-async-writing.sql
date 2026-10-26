-- Run once in the Supabase SQL editor BEFORE the new weekly flow goes live.
-- Adds: a box for the facilitator's own agenda topics, an "anomalies and trends" box,
-- and a per-role switch for "discuss this stalled role with the group".
-- Safe to re-run. It only adds columns, so nothing existing is touched.

alter table updates add column if not exists anomalies text;
alter table updates add column if not exists facilitator_topics text;
alter table role_updates add column if not exists discuss boolean not null default false;

-- Comments on people's wins. The table was reserved in the first schema and locked down
-- with the rest; this only adds it to live updates so comments appear on every screen.
do $$
begin
  alter publication supabase_realtime add table comments;
exception when duplicate_object then null;
end $$;
