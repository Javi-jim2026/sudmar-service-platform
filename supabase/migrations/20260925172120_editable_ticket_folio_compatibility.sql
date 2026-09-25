-- Preserve the source folio of imported tasks while adding a stable relationship.
alter table public.legacy_tasks add column ticket_id uuid references public.tickets(id);
update public.legacy_tasks l set ticket_id=t.id from public.tickets t where l.ticket_folio=t.folio;
create index legacy_tasks_ticket_id_idx on public.legacy_tasks(ticket_id);

create function public.link_legacy_ticket() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if NEW.ticket_id is null then
  select id into NEW.ticket_id from public.tickets where folio=NEW.ticket_folio;
 end if;
 return NEW;
end $$;
revoke all on function public.link_legacy_ticket() from public,anon,authenticated;
create trigger link_legacy_ticket before insert or update of ticket_folio on public.legacy_tasks
for each row execute function public.link_legacy_ticket();

-- Keep the existing private deletion guard and its permissions. Renaming a clean
-- test ticket must not disable deletion or reset a permanent operational block.
do $$
declare definition text;
begin
 select pg_get_functiondef('sudmar_private.guard_test_ticket()'::regprocedure) into definition;
 if position('elsif TG_OP = ''UPDATE'' then' in definition)=0 then
  raise exception 'Unexpected test-ticket guard definition';
 end if;
 definition:=replace(definition,'elsif TG_OP = ''UPDATE'' then',
 'elsif TG_OP = ''UPDATE'' then
  if NEW.folio is distinct from OLD.folio then
   update sudmar_private.test_ticket_registry set folio=NEW.folio where ticket_id=OLD.id;
  end if;');
 execute definition;
end $$;
notify pgrst,'reload schema';
