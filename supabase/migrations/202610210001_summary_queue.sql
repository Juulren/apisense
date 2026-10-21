-- Cron drains a fair, bounded queue. Private state is never exposed via the API.
create schema if not exists apisense_private;
revoke all on schema apisense_private from public, anon, authenticated;

create table apisense_private.hive_summary_jobs (
  hive_id uuid primary key references public.hives(id) on delete cascade,
  available_at timestamptz not null default now(),
  window_end timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0
);
create index on apisense_private.hive_summary_jobs(available_at, hive_id);
revoke all on apisense_private.hive_summary_jobs from public, anon, authenticated;

create function public.claim_hive_summary_jobs(batch_size integer default 10)
returns table(hive_id uuid, lease_token uuid, window_end timestamptz, check_interval_minutes integer)
language plpgsql security definer set search_path = '' as $$
begin
  if batch_size is null or batch_size < 1 or batch_size > 25 then raise exception 'Invalid batch size'; end if;
  insert into apisense_private.hive_summary_jobs(hive_id, available_at)
    select h.id, coalesce((select max(s.created_at) from public.ai_summaries s
      where s.hive_id=h.id and s.deleted_at is null) + make_interval(mins=>a.check_interval_minutes), now())
    from public.hives h join public.apiaries a on a.id=h.apiary_id
    where h.deleted_at is null and a.deleted_at is null
    on conflict do nothing;

  return query
  with candidates as (
    select j.hive_id from apisense_private.hive_summary_jobs j
    join public.hives h on h.id=j.hive_id
    join public.apiaries a on a.id=h.apiary_id
    where j.available_at <= now() and (j.lease_until is null or j.lease_until <= now())
      and h.deleted_at is null and a.deleted_at is null
    order by j.available_at, j.hive_id limit batch_size for update of j skip locked
  ), claimed as (
    update apisense_private.hive_summary_jobs j
    set lease_token=gen_random_uuid(), lease_until=now()+interval '5 minutes', window_end=coalesce(j.window_end,now())
    from candidates c where j.hive_id=c.hive_id
    returning j.hive_id, j.lease_token, j.window_end
  )
  select c.hive_id,c.lease_token,c.window_end,a.check_interval_minutes
  from claimed c join public.hives h on h.id=c.hive_id join public.apiaries a on a.id=h.apiary_id;
end;
$$;

create function public.finish_hive_summary_job(job_hive_id uuid, job_lease_token uuid, succeeded boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  update apisense_private.hive_summary_jobs j set
    available_at=now()+case when succeeded then make_interval(mins=>a.check_interval_minutes)
      else make_interval(secs=>least(3600,15*power(2,least(j.attempts,8)))::double precision) end,
    window_end=case when succeeded then null else j.window_end end,
    attempts=case when succeeded then 0 else j.attempts+1 end,
    lease_token=null, lease_until=null
  from public.hives h join public.apiaries a on a.id=h.apiary_id
  where j.hive_id=job_hive_id and h.id=j.hive_id and j.lease_token=job_lease_token
    and j.lease_until>now();
  get diagnostics affected = row_count;
  return affected=1;
end;
$$;

revoke all on function public.claim_hive_summary_jobs(integer), public.finish_hive_summary_job(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.claim_hive_summary_jobs(integer), public.finish_hive_summary_job(uuid,uuid,boolean) to service_role;
