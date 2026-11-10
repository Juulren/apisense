-- Account profile: one row per auth user, holding the name shown in the app.
-- Email and password stay in Supabase Auth; nothing sensitive lives here.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_valid check (
    display_name is null
    or (char_length(display_name) between 1 and 50
        and display_name = btrim(display_name)
        and display_name !~ '[[:cntrl:]]')
  )
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
-- Clients read their row and change only the name; creation is the trigger's job.
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create function public.touch_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_profile();

-- Returns a usable name or null; never raises.
create function public.clean_display_name(raw text) returns text
language sql immutable set search_path = '' as $$
  select case
    when raw is null then null
    when btrim(raw) = '' then null
    when char_length(btrim(raw)) > 50 then null
    when btrim(raw) ~ '[[:cntrl:]]' then null
    else btrim(raw)
  end
$$;
revoke all on function public.clean_display_name(text) from public, anon, authenticated;

-- Creates the profile when an account is registered. It must never block sign-up,
-- so any problem is swallowed and the profile is simply created without a name.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    insert into public.profiles(id, display_name)
    values (new.id, public.clean_display_name(new.raw_user_meta_data ->> 'display_name'))
    on conflict (id) do nothing;
  exception when others then
    begin
      insert into public.profiles(id) values (new.id) on conflict (id) do nothing;
    exception when others then
      null;
    end;
  end;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts that already exist get an empty profile.
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;
