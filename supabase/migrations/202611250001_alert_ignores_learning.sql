-- A node that is still learning the hive's usual sound (flag 8) or has no time yet is not judging:
-- whatever class code it carries, it must not create a "sonido diferente" event.
create or replace function public.alert_on_different_verdict() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner uuid; code text;
begin
  begin
    if new.class_code <> 0 and (new.flags & 8) = 0 and new.source = 'lora' then
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
