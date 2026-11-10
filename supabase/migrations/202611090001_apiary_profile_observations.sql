-- Additive only (0.2.0): older app versions keep working because every new
-- column is nullable or has a default. Apply before installing 0.2.0 with a real
-- account: the app upserts these columns and fails with "unknown column" otherwise.
alter table public.apiaries
  add column if not exists region_preset text check(region_preset is null or region_preset in ('yucatan','custom')),
  add column if not exists seasons_json text check(seasons_json is null or octet_length(seasons_json) <= 4096),
  add column if not exists weather_enabled integer not null default 0 check(weather_enabled in (0,1)),
  add column if not exists checkin_frequency text not null default 'weekly' check(checkin_frequency in ('daily','weekly','off'));
alter table public.inspections
  add column if not exists queen_state text check(queen_state is null or queen_state in ('seen','not_seen','virgin_seen')),
  add column if not exists eggs_state text check(eggs_state is null or eggs_state in ('none','fresh','multiple')),
  add column if not exists queen_cells text check(queen_cells is null or queen_cells in ('none','present')),
  add column if not exists activity text check(activity is null or activity in ('low','normal','high')),
  add column if not exists population text check(population is null or population in ('down','stable','up')),
  add column if not exists stores text check(stores is null or stores in ('low','medium','high'));
