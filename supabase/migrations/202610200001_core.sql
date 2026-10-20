create table public.apiaries (
  id uuid primary key, user_id uuid not null references auth.users(id), name text not null,
  latitude double precision check(latitude between -90 and 90), longitude double precision check(longitude between -180 and 180),
  check_interval_minutes integer not null default 15 check(check_interval_minutes between 1 and 10080),
  updated_at timestamptz not null default now(), synced_at timestamptz, deleted_at timestamptz
);
create table public.hives (
  id uuid primary key, apiary_id uuid not null references public.apiaries(id), code text not null,
  queen_status text not null default 'unknown', health_score double precision check(health_score between 0 and 100), last_audio_check_at timestamptz,
  updated_at timestamptz not null default now(), synced_at timestamptz, deleted_at timestamptz
);
create table public.iot_microphones (
  id uuid primary key, hive_id uuid not null references public.hives(id), mac_address text not null, firmware_version text not null,
  battery_level double precision not null check(battery_level between 0 and 100), sampling_rate_hz integer not null check(sampling_rate_hz between 1000 and 96000),
  is_online integer not null default 0 check(is_online in (0,1)), last_seen_at timestamptz, calibration_db double precision not null default 0,
  updated_at timestamptz not null default now(), synced_at timestamptz, deleted_at timestamptz, unique(id,hive_id)
);
create table public.audio_samples (
  id uuid primary key, hive_id uuid not null references public.hives(id), device_id uuid not null,
  recorded_at timestamptz not null, duration_seconds double precision not null check(duration_seconds > 0 and duration_seconds <= 30),
  dominant_freq_hz double precision not null check(dominant_freq_hz >= 0), amplitude_db double precision not null,
  mfcc_features_json text not null, audio_file_url text,
  acoustic_classification text not null check(acoustic_classification in ('healthy','swarming','queenless','pest_disturbance','unknown')),
  confidence_score double precision not null check(confidence_score between 0 and 1),
  source text not null check(source in ('simulator','ble','mqtt')), classifier_version text not null,
  updated_at timestamptz not null default now(), synced_at timestamptz, deleted_at timestamptz,
  foreign key(device_id,hive_id) references public.iot_microphones(id,hive_id)
);
create table public.ai_summaries (
  id uuid primary key, hive_id uuid not null references public.hives(id), period_start timestamptz not null, period_end timestamptz not null,
  overall_status text not null check(overall_status in ('optimal','warning','critical')), summary_text text not null, recommended_action text not null,
  samples_analyzed_count integer not null check(samples_analyzed_count > 0), created_at timestamptz not null default now(), engine_version text not null,
  updated_at timestamptz not null default now(), synced_at timestamptz, deleted_at timestamptz,
  check(period_end > period_start), unique(hive_id,period_start,period_end,engine_version)
);
create table public.inspections (
  id uuid primary key, hive_id uuid not null references public.hives(id), inspected_at timestamptz not null, notes text not null,
  tags_json text not null, queen_seen integer not null check(queen_seen in (0,1)),
  updated_at timestamptz not null default now(), synced_at timestamptz, deleted_at timestamptz
);

create index on public.apiaries(user_id);
create index on public.hives(apiary_id);
create index on public.iot_microphones(hive_id);
create index on public.audio_samples(hive_id,recorded_at);
create index on public.ai_summaries(hive_id,period_end);
create index on public.inspections(hive_id,inspected_at);

create function public.stamp_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := clock_timestamp(); return new; end;
$$;
create function public.sync_clock() returns timestamptz language sql stable set search_path = '' as $$ select now(); $$;
revoke all on function public.sync_clock() from public, anon;
grant execute on function public.sync_clock() to authenticated;

create function public.owns_apiary(apiary uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.apiaries a where a.id=apiary and a.user_id=(select auth.uid()));
$$;
create function public.owns_hive(hive uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.hives h join public.apiaries a on a.id=h.apiary_id where h.id=hive and a.user_id=(select auth.uid()));
$$;
revoke all on function public.owns_apiary(uuid), public.owns_hive(uuid) from public, anon;
grant execute on function public.owns_apiary(uuid), public.owns_hive(uuid) to authenticated;

alter table public.apiaries enable row level security;
create policy apiary_owner on public.apiaries for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
alter table public.hives enable row level security;
create policy hive_owner on public.hives for all to authenticated using(public.owns_apiary(apiary_id)) with check(public.owns_apiary(apiary_id));

do $$ declare t text; begin
  foreach t in array array['apiaries','hives','iot_microphones','audio_samples','ai_summaries','inspections'] loop
    execute format('create trigger stamp before insert or update on public.%I for each row execute function public.stamp_updated_at()',t);
    execute format('create index on public.%I(updated_at,id)',t);
    execute format('grant select,insert,update on public.%I to authenticated',t);
  end loop;
  foreach t in array array['iot_microphones','audio_samples','ai_summaries','inspections'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy hive_owner on public.%I for all to authenticated using(public.owns_hive(hive_id)) with check(public.owns_hive(hive_id))',t);
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hive-audio','hive-audio',false,10485760,array['audio/wav','audio/flac']) on conflict(id) do nothing;
create policy audio_owner_read on storage.objects for select to authenticated using(bucket_id='hive-audio' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy audio_owner_insert on storage.objects for insert to authenticated with check(bucket_id='hive-audio' and (storage.foldername(name))[1]=(select auth.uid())::text and public.owns_hive(((storage.foldername(name))[2])::uuid));
create policy audio_owner_update on storage.objects for update to authenticated using(bucket_id='hive-audio' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='hive-audio' and (storage.foldername(name))[1]=(select auth.uid())::text and public.owns_hive(((storage.foldername(name))[2])::uuid));
