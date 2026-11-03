-- Manual cohorts of worker brood. Dates estimate progress; they do not confirm emergence.
create table public.brood_cycles (
  id uuid primary key,
  hive_id uuid not null references public.hives(id),
  cohort_label text not null check(length(trim(cohort_label)) between 1 and 80),
  started_on date not null,
  state text not null check(state in ('active','emerged','stopped')),
  observed_stage text not null check(observed_stage in ('unknown','egg','larva','capped','emerged')),
  observed_at timestamptz, ended_at timestamptz,
  updated_at timestamptz not null default now(), synced_at timestamptz, deleted_at timestamptz,
  check((state='active' and ended_at is null) or (state<>'active' and ended_at is not null)),
  check((observed_stage='unknown' and observed_at is null) or (observed_stage<>'unknown' and observed_at is not null)),
  check(state<>'emerged' or observed_stage='emerged')
);
create index on public.brood_cycles(hive_id,started_on);
create index on public.brood_cycles(updated_at,id);
create trigger stamp before insert or update on public.brood_cycles
  for each row execute function public.stamp_updated_at();
alter table public.brood_cycles enable row level security;
create policy hive_owner on public.brood_cycles for all to authenticated
  using(public.owns_hive(hive_id)) with check(public.owns_hive(hive_id));
revoke all on public.brood_cycles from anon;
grant select,insert,update on public.brood_cycles to authenticated;
