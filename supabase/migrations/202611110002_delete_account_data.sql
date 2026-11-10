-- Removes everything an account owns, child rows first (the foreign keys have no
-- cascade). Called only by the delete-account Edge Function with the service
-- role, after it re-checked the password. The auth user is deleted afterwards
-- through the Auth admin API, which also removes the profile (on delete cascade).
-- The user's apiaries are locked first and rows are chosen by subquery, so a row
-- inserted while this runs cannot slip between the lookup and the deletes.

create function public.delete_account_data(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if target is null then
    raise exception 'target required' using errcode = '22004';
  end if;
  perform 1 from public.apiaries where user_id = target for update;

  delete from public.edge_verdicts where hive_id in (select h.id from public.hives h join public.apiaries a on a.id = h.apiary_id where a.user_id = target);
  delete from public.brood_cycles where hive_id in (select h.id from public.hives h join public.apiaries a on a.id = h.apiary_id where a.user_id = target);
  delete from public.inspections where hive_id in (select h.id from public.hives h join public.apiaries a on a.id = h.apiary_id where a.user_id = target);
  delete from public.ai_summaries where hive_id in (select h.id from public.hives h join public.apiaries a on a.id = h.apiary_id where a.user_id = target);
  delete from public.audio_samples where hive_id in (select h.id from public.hives h join public.apiaries a on a.id = h.apiary_id where a.user_id = target);
  delete from public.iot_microphones where hive_id in (select h.id from public.hives h join public.apiaries a on a.id = h.apiary_id where a.user_id = target);
  delete from public.hives where apiary_id in (select id from public.apiaries where user_id = target);
  delete from public.apiaries where user_id = target;
  -- A claimed node goes back to "unclaimed" (the column is also nulled by the FK).
  update public.lora_nodes set owner = null where owner = target;
end $$;

revoke all on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
