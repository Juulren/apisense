-- Alert events and push tokens (plan 0.3.1, pieces B and C).
-- An event is a short, neutral message for a person: a node reported a sound
-- that differs from the usual, or a node stopped reporting. It never states why.

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hive_id uuid not null references public.hives(id) on delete cascade,
  kind text not null check (kind in ('verdict', 'node_silent')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 240),
  created_at timestamptz not null default now(),
  -- A sender takes a short lease before sending, so two overlapping runs never send the same event twice.
  claimed_at timestamptz,
  sent_at timestamptz
);
create index on public.alert_events(hive_id, kind, created_at desc);
create index on public.alert_events(created_at) where sent_at is null;
alter table public.alert_events enable row level security;
revoke all on public.alert_events from anon, authenticated;
grant select on public.alert_events to authenticated;
create policy alert_events_select_own on public.alert_events
  for select to authenticated using (user_id = (select auth.uid()));

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (char_length(token) between 20 and 4096),
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);
create index on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;
-- People can see and delete their own tokens; creating them goes through
-- claim_push_token, which also caps how many one account can hold.
grant select, delete on public.push_tokens to authenticated;
create policy push_tokens_select_own on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));
-- A phone token belongs to whoever signed in last on that phone.
create function public.claim_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into public.push_tokens(user_id, token, platform)
  values (me, p_token, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  -- At most five phones per account: the newest ones.
  delete from public.push_tokens t
  where t.user_id = me and t.id not in (
    select id from public.push_tokens where user_id = me order by updated_at desc, id desc limit 5);
end $$;
revoke all on function public.claim_push_token(text, text) from public, anon;
grant execute on function public.claim_push_token(text, text) to authenticated;

-- 1) A node message that differs from the usual creates one event per hive every
--    two hours (the node repeats every 10-15 minutes; people get one nudge, not a flood).
--    It must never block the node's insert.
create function public.alert_on_different_verdict() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner uuid; code text;
begin
  begin
    if new.class_code <> 0 and new.source = 'lora' then
      select a.user_id, h.code into owner, code
      from public.hives h join public.apiaries a on a.id = h.apiary_id
      where h.id = new.hive_id and h.deleted_at is null and a.deleted_at is null;
      if owner is not null and not exists (
        select 1 from public.alert_events e
        where e.hive_id = new.hive_id and e.kind = 'verdict'
          and e.created_at > now() - interval '2 hours'
      ) then
        insert into public.alert_events(user_id, hive_id, kind, title, body)
        values (owner, new.hive_id, 'verdict', 'Sonido diferente al habitual',
                left(code, 40) || ': el nodo reportó un sonido diferente al habitual. Revisa la colmena.');
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end $$;
revoke all on function public.alert_on_different_verdict() from public, anon, authenticated;
create trigger alert_on_different_verdict after insert on public.edge_verdicts
  for each row execute function public.alert_on_different_verdict();

-- 2) A node silent for three hours creates one event per day (until it reports again).
create function public.detect_silent_nodes() returns integer
language plpgsql security definer set search_path = '' as $$
declare made integer := 0; r record; hours integer;
begin
  for r in
    select h.id as hive_id, h.code, a.user_id, m.updated_at as linked_at,
           (select max(v.recorded_at) from public.edge_verdicts v
             where v.hive_id = h.id and v.source = 'lora' and v.deleted_at is null) as last_at
    from public.iot_microphones m
    join public.hives h on h.id = m.hive_id and h.deleted_at is null
    join public.apiaries a on a.id = h.apiary_id and a.deleted_at is null
    where m.dev_eui is not null and m.deleted_at is null
  loop
    if coalesce(r.last_at, r.linked_at) < now() - interval '3 hours'
       and not exists (
         select 1 from public.alert_events e
         where e.hive_id = r.hive_id and e.kind = 'node_silent'
           and e.created_at > now() - interval '24 hours'
       ) then
      hours := greatest(3, floor(extract(epoch from (now() - coalesce(r.last_at, r.linked_at))) / 3600)::integer);
      insert into public.alert_events(user_id, hive_id, kind, title, body)
      values (r.user_id, r.hive_id, 'node_silent', 'Nodo sin reportar',
              left(r.code, 40) || ' no envía mensajes desde hace ' || hours || ' h.');
      made := made + 1;
    end if;
  end loop;
  return made;
end $$;
revoke all on function public.detect_silent_nodes() from public, anon, authenticated;

-- Takes up to p_limit unsent events with a two-minute lease (skipping rows another
-- run holds) and expires what is too old to be useful. Service role only.
create function public.claim_pending_alerts(p_limit integer) returns setof public.alert_events
language plpgsql security definer set search_path = '' as $$
begin
  update public.alert_events set sent_at = now()
  where sent_at is null and created_at < now() - interval '2 hours';
  return query
  update public.alert_events e set claimed_at = now()
  where e.id in (
    select id from public.alert_events
    where sent_at is null and (claimed_at is null or claimed_at < now() - interval '2 minutes')
    order by created_at limit greatest(1, least(p_limit, 200)) for update skip locked)
  returning e.*;
end $$;
revoke all on function public.claim_pending_alerts(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_alerts(integer) to service_role;

create function public.prune_alert_events() returns void language sql security definer set search_path = '' as $$
  delete from public.alert_events where created_at < now() - interval '30 days';
$$;
revoke all on function public.prune_alert_events() from public, anon, authenticated;

-- 3) The send-push function is called every minute (same pattern as the hive
--    summaries; the secret and URL live in Vault, never in this file).
create function public.invoke_send_push_job() returns bigint language plpgsql security definer set search_path = '' as $$
declare project_url text; cron_secret text; request_id bigint;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'apisense_project_url' limit 1;
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name = 'apisense_cron_secret' limit 1;
  if project_url is null or cron_secret is null then return null; end if;
  select net.http_post(url := project_url || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', cron_secret),
    body := '{}'::jsonb, timeout_milliseconds := 10000) into request_id;
  return request_id;
end $$;
revoke all on function public.invoke_send_push_job() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('apisense-send-push', '* * * * *', 'select public.invoke_send_push_job()');
    perform cron.schedule('apisense-detect-silent-nodes', '*/10 * * * *', 'select public.detect_silent_nodes()');
    perform cron.schedule('apisense-prune-alert-events', '23 3 * * *', 'select public.prune_alert_events()');
  end if;
end $$;
