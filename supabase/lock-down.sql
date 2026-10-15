-- Lock the database so only signed-in Carrara people can read or write anything.
--
-- RUN THIS LAST, after sign-in with Google works in the app. Once it runs, anyone who is
-- not signed in with an @carrara.is account (including anyone holding the public key
-- that ships inside the web page) is refused by the database itself.
--
-- Safe to re-run.

create or replace function public.is_carrara_user()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@carrara.is'
$$;

alter table sessions     enable row level security;
alter table participants enable row level security;
alter table updates      enable row level security;
alter table reactions    enable row level security;
alter table comments     enable row level security;

drop policy if exists "carrara people" on sessions;
drop policy if exists "carrara people" on participants;
drop policy if exists "carrara people" on updates;
drop policy if exists "carrara people" on reactions;
drop policy if exists "carrara people" on comments;

create policy "carrara people" on sessions     for all to authenticated
  using (public.is_carrara_user()) with check (public.is_carrara_user());
create policy "carrara people" on participants for all to authenticated
  using (public.is_carrara_user()) with check (public.is_carrara_user());
create policy "carrara people" on updates      for all to authenticated
  using (public.is_carrara_user()) with check (public.is_carrara_user());
create policy "carrara people" on reactions    for all to authenticated
  using (public.is_carrara_user()) with check (public.is_carrara_user());
create policy "carrara people" on comments     for all to authenticated
  using (public.is_carrara_user()) with check (public.is_carrara_user());

-- No policy is granted to the "anon" role, so signed-out requests get nothing.
