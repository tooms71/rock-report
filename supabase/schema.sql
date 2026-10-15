-- Rock Report — database schema (SPEC.md §6)
-- Run this in the Supabase SQL Editor for your project.

create extension if not exists "pgcrypto";

-- sessions: one row per week's ritual instance
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  week_of date not null,
  phase text not null default 'lobby' check (phase in ('lobby', 'writing', 'reveal', 'closed')),
  writing_ends_at timestamptz,
  facilitator_participant_id uuid,
  created_at timestamptz not null default now()
);

-- participants: one row per person who joins a session
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now()
);

-- now that participants exists, point sessions.facilitator at it
alter table sessions
  add constraint sessions_facilitator_fk
  foreign key (facilitator_participant_id) references participants(id);

-- updates: one row per participant per session (their five-field submission)
create table if not exists updates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  offers_made int,
  offers_made_note text,
  offers_closed int,
  offers_closed_note text,
  roles_opened text,
  learned_or_surprised text,
  need_brain_on text,
  anything_else text,
  top_priorities text,
  submitted_at timestamptz,
  unique (session_id, participant_id)
);

-- learned_or_surprised is no longer used by the app (its prompt was folded into
-- "Anything else?") but the column is kept so old sessions' data isn't lost.
-- need_brain_on now stores the "Blocked or struggling" answer. The column predates
-- that prompt (it was "where I could use another brain"), so no migration is needed.

-- Safe to re-run: adds columns if this script ran before they existed.
alter table if exists updates add column if not exists anything_else text;
alter table if exists updates add column if not exists top_priorities text;

-- Sign-in with Google: each participant is linked to the signed-in person, so people
-- no longer type a name. One row per person per session. Safe to re-run.
alter table if exists participants
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists participants_session_user_key
  on participants (session_id, user_id) where user_id is not null;

-- reactions: emoji reactions on updates or individual fields, including the 🚩 red flag
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  target_type text not null check (target_type in ('update', 'field')),
  target_update_id uuid not null references updates(id) on delete cascade,
  field_key text,
  emoji text not null,
  participant_id uuid not null references participants(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- comments: v1.1, not used yet — table shape reserved now so it doesn't need reworking later
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  target_type text not null check (target_type in ('update', 'field')),
  target_update_id uuid not null references updates(id) on delete cascade,
  field_key text,
  participant_id uuid not null references participants(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- v1 has no real auth (SPEC.md §2 / §9) — the team is small and trusted,
-- so every table is open to the anon key rather than modeling policies for a user model that doesn't exist yet.
alter table sessions disable row level security;
alter table participants disable row level security;
alter table updates disable row level security;
alter table reactions disable row level security;
alter table comments disable row level security;

-- Realtime: let clients subscribe to live changes on these tables.
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table updates;
alter publication supabase_realtime add table reactions;
