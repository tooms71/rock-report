-- Run once in the Supabase SQL editor BEFORE using the open-roles buttons in the writing form.
-- Adds a table that records, per person per week, the status they tapped for each of their
-- open roles. Nothing is written back to Notion. Locked down like the other tables.
-- Safe to re-run. (The "drop policy" line below is why Supabase shows a warning: it only
-- replaces this table's own rule.)

create table if not exists role_updates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  notion_page_id text not null,
  role_title text not null,
  role_url text,
  status text not null check (status in ('on_track', 'stalled', 'offer_extended', 'offer_accepted')),
  note text,
  updated_at timestamptz not null default now(),
  unique (participant_id, notion_page_id)
);

alter table role_updates enable row level security;
drop policy if exists "carrara people" on role_updates;
create policy "carrara people" on role_updates for all to authenticated
  using (public.is_carrara_user()) with check (public.is_carrara_user());

-- Live updates, like the other tables.
do $$
begin
  alter publication supabase_realtime add table role_updates;
exception when duplicate_object then null;
end $$;
