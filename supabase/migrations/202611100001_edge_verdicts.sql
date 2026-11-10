-- Verdicts sent by the hive node (the classifier runs on the ESP32; over LoRaWAN
-- only a small code travels). Inserted by the lora-uplink Edge Function (service
-- role) or by the app; the owner can review them (seen / false alarm / confirmed).
-- Additive only. Apply together with 202611090001 before using 0.2.1+ with a real account.
create table public.edge_verdicts (
  id uuid primary key,
  hive_id uuid not null references public.hives(id),
  device_id uuid,
  recorded_at timestamptz not null,
  source text not null check(source in ('lora','ble','mqtt','simulator')),
  format_version integer not null check(format_version between 0 and 15),
  class_map_version integer not null check(class_map_version between 1 and 15),
  class_code integer not null check(class_code between 0 and 255),
  confidence double precision not null check(confidence between 0 and 1),
  temperature_c double precision check(temperature_c is null or temperature_c between -40 and 85),
  battery_v double precision check(battery_v is null or battery_v between 0 and 6),
  flags integer not null default 0 check(flags between 0 and 15),
  uplink_counter bigint check(uplink_counter is null or uplink_counter >= 0),
  dedupe_key text,
  raw_payload text check(raw_payload is null or length(raw_payload) <= 64),
  review text check(review is null or review in ('seen','false_alarm','confirmed')),
  reviewed_at timestamptz,
  review_note text check(review_note is null or length(review_note) <= 500),
  updated_at timestamptz not null default now(), synced_at timestamptz, deleted_at timestamptz,
  check((review is null and reviewed_at is null) or (review is not null and reviewed_at is not null))
);
-- TTN retries a webhook until it gets a 200: the uplink counter makes it idempotent.
create unique index edge_verdicts_dedupe on public.edge_verdicts(dedupe_key);
create index on public.edge_verdicts(hive_id,recorded_at);
create index on public.edge_verdicts(updated_at,id);
create trigger stamp before insert or update on public.edge_verdicts
  for each row execute function public.stamp_updated_at();
alter table public.edge_verdicts enable row level security;
create policy hive_owner on public.edge_verdicts for all to authenticated
  using(public.owns_hive(hive_id)) with check(public.owns_hive(hive_id));
revoke all on public.edge_verdicts from anon;
grant select,insert,update on public.edge_verdicts to authenticated;

-- A LoRaWAN DevEUI identifies one physical node: it maps to exactly one hive.
alter table public.iot_microphones
  add column if not exists dev_eui text check(dev_eui is null or dev_eui ~ '^[0-9a-f]{16}$');
create unique index if not exists iot_microphones_dev_eui on public.iot_microphones(dev_eui);

-- ---------------------------------------------------------------------------
-- Security hardening (advisor review).
--
-- 1) Only the server creates LoRaWAN verdicts. A signed-in owner may insert
--    verdicts from the app's own transports (ble/mqtt/simulator) without a dedupe
--    key, and may change ONLY the review fields afterwards. Without this, an owner
--    could forge a verdict or squat another node's dedupe key.
create function public.guard_edge_verdict() returns trigger language plpgsql set search_path = '' as $$
declare keep text[] := array['review','reviewed_at','review_note','deleted_at','updated_at','synced_at'];
begin
  -- Service role / server-side requests carry no user id: not restricted here.
  if (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' then
    if new.source = 'lora' or new.dedupe_key is not null then
      raise exception 'Solo el servidor crea veredictos LoRaWAN' using errcode = '42501';
    end if;
  elsif (to_jsonb(new) - keep) is distinct from (to_jsonb(old) - keep) then
    raise exception 'Solo se puede cambiar la revisión del veredicto' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard before insert or update on public.edge_verdicts
  for each row execute function public.guard_edge_verdict();

-- 2) A DevEUI is printed on the node's label: knowing it must not be enough to
--    receive that node's data. The project owner registers each node with a claim
--    code (only its SHA-256 is stored; table not readable by users); a user links a
--    node only after proving the code through claim_lora_node(). Ten wrong codes
--    lock that node for fifteen minutes.
create table public.lora_nodes (
  dev_eui text primary key check(dev_eui ~ '^[0-9a-f]{16}$'),
  claim_hash text not null check(claim_hash ~ '^[0-9a-f]{64}$'),
  owner uuid references auth.users(id) on delete set null,
  failed_attempts integer not null default 0,
  last_failed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.lora_nodes enable row level security;
revoke all on public.lora_nodes from anon, authenticated;

create function public.claim_lora_node(p_dev_eui text, p_claim_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare node public.lora_nodes; digest text; me uuid := (select auth.uid());
begin
  if me is null then return false; end if;
  if p_dev_eui is null or p_dev_eui !~ '^[0-9a-f]{16}$'
     or length(coalesce(p_claim_code,'')) not between 8 and 128 then return false; end if;
  select * into node from public.lora_nodes where dev_eui = p_dev_eui for update;
  if not found then return false; end if;
  if node.failed_attempts >= 10 and node.last_failed_at > now() - interval '15 minutes' then
    return false;
  end if;
  digest := encode(sha256(convert_to(p_claim_code, 'UTF8')), 'hex');
  if node.claim_hash <> digest then
    update public.lora_nodes set failed_attempts = case when node.last_failed_at > now() - interval '15 minutes' then node.failed_attempts + 1 else 1 end,
      last_failed_at = now() where dev_eui = p_dev_eui;
    return false;
  end if;
  if node.owner is not null and node.owner <> me then return false; end if;
  update public.lora_nodes set owner = me, failed_attempts = 0, last_failed_at = null where dev_eui = p_dev_eui;
  return true;
end $$;
revoke all on function public.claim_lora_node(text, text) from public, anon;
grant execute on function public.claim_lora_node(text, text) to authenticated;

create function public.guard_dev_eui() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and new.dev_eui is not null
     and (tg_op = 'INSERT' or new.dev_eui is distinct from old.dev_eui) then
    if not exists (select 1 from public.lora_nodes n where n.dev_eui = new.dev_eui and n.owner = (select auth.uid())) then
      raise exception 'DevEUI sin reclamar con su código de vinculación' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger guard_dev_eui before insert or update on public.iot_microphones
  for each row execute function public.guard_dev_eui();

-- 3) Retention: ordinary "usual sound" uplinks (one every 10-15 minutes per node)
--    are kept 30 days; alerts and anything reviewed are kept.
create function public.prune_edge_verdicts() returns void language sql security definer set search_path = '' as $$
  delete from public.edge_verdicts
  where class_code = 0 and review is null and recorded_at < now() - interval '30 days';
$$;
revoke all on function public.prune_edge_verdicts() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('prune-edge-verdicts', '17 3 * * *', 'select public.prune_edge_verdicts()');
  end if;
end $$;
