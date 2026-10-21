create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Secrets are provisioned separately in Vault; never commit credentials.
create function public.invoke_hive_summary_job() returns bigint language plpgsql security definer set search_path = '' as $$
declare project_url text; cron_secret text; request_id bigint;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name='apisense_project_url' limit 1;
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name='apisense_cron_secret' limit 1;
  if project_url is null or cron_secret is null then return null; end if;
  select net.http_post(url:=project_url||'/functions/v1/generate-hive-summary', headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',cron_secret),body:='{}'::jsonb,timeout_milliseconds:=10000) into request_id;
  return request_id;
end;
$$;
revoke all on function public.invoke_hive_summary_job() from public, anon, authenticated;
select cron.schedule('apisense-hive-summaries','* * * * *','select public.invoke_hive_summary_job()');
