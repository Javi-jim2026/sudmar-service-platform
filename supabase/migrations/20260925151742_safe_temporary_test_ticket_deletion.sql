-- Temporary shared pilot: only explicitly marked, newly created test tickets.
create schema if not exists sudmar_private;
revoke all on schema sudmar_private from public, anon, authenticated;
create table sudmar_private.ticket_deletion_pilot (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default true,
 expires_at timestamptz not null default (now() + interval '30 days')
);
insert into sudmar_private.ticket_deletion_pilot default values;
create table sudmar_private.test_ticket_registry (
 ticket_id uuid primary key, folio text not null, blocked boolean not null default false
);
alter table sudmar_private.ticket_deletion_pilot enable row level security;
alter table sudmar_private.test_ticket_registry enable row level security;
revoke all on all tables in schema sudmar_private from public, anon, authenticated;
alter table public.tickets add column is_test boolean not null default false;

-- Privileged code is trigger-only and private: it must see evidence hidden by RLS.
-- There is no user identity in the existing anon pilot; do not fabricate one.
create function sudmar_private.guard_test_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
declare linked boolean; fk record;
begin
 if TG_OP = 'INSERT' then
  if NEW.is_test then
   if not exists(select 1 from sudmar_private.ticket_deletion_pilot where enabled and expires_at > clock_timestamp()) then
    raise exception 'La opción temporal de tickets de prueba está desactivada.';
   end if;
   insert into sudmar_private.test_ticket_registry(ticket_id,folio) values(NEW.id,NEW.folio);
  end if;
 elsif TG_OP = 'UPDATE' then
  if NEW.is_test is distinct from OLD.is_test then
   raise exception 'La marca de prueba solo se define al crear el ticket.';
  end if;
 end if;
 if TG_OP <> 'DELETE' then
  if NEW.is_test and (
    NEW.operational_status is distinct from 'REGISTRADO' or NEW.closed_at is not null
    or NEW.import_batch_id is not null or NEW.source_row is not null or NEW.source_file is not null
    or NEW.source_sheet is not null or NEW.source_payload is not null
    or concat(NEW.logbook,NEW.notes,NEW.diagnosis,NEW.folder_url,NEW.technical_findings,NEW.work_performed,NEW.final_condition,NEW.legacy_status,NEW.legacy_stage,NEW.legacy_diagnosis,NEW.stage) <> ''
  ) then update sudmar_private.test_ticket_registry set blocked=true where ticket_id=NEW.id; end if;
  return NEW;
 end if;
 if not exists(select 1 from sudmar_private.ticket_deletion_pilot where enabled and expires_at > clock_timestamp()) then
  raise exception 'La eliminación temporal está desactivada.';
 end if;
 if not OLD.is_test or not exists(select 1 from sudmar_private.test_ticket_registry where ticket_id=OLD.id and folio=OLD.folio and not blocked) then
  raise exception 'Ticket protegido o con seguimiento. Debe cancelarse/archivarse; no puede eliminarse.';
 end if;
 if current_setting('sudmar.confirm_delete_folio',true) is distinct from OLD.folio then
  raise exception 'Escribe el folio exacto para confirmar la eliminación.';
 end if;
 -- Lock every referencing table before checking, including future foreign keys.
 -- Concurrent writers either finish first and are detected, or wait/fail safely.
 for fk in select c.conrelid::regclass as tbl,a.attname as col
   from pg_catalog.pg_constraint c join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
   where c.contype='f' and c.confrelid='public.tickets'::regclass order by c.conrelid,c.oid
 loop
  execute format('lock table %s in share row exclusive mode',fk.tbl);
  execute format('select exists(select 1 from %s where %I=$1)',fk.tbl,fk.col) into linked using OLD.id;
  if linked then raise exception 'El ticket tiene actividades, evidencias u otros registros. Debe cancelarse/archivarse.'; end if;
 end loop;
 lock table public.legacy_tasks, public.audit_log in share row exclusive mode;
 if exists(select 1 from public.legacy_tasks where ticket_folio=OLD.folio)
 or exists(select 1 from public.audit_log where entity_id in (OLD.id::text,OLD.folio)) then
  raise exception 'El ticket tiene historial operativo. Debe cancelarse/archivarse.';
 end if;
 insert into public.audit_log(entity_type,entity_id,action,changed_by,before_data)
 values('ticket',OLD.id::text,'DELETE_TEST_TICKET','Piloto compartido (sin identidad individual)',jsonb_build_object('folio',OLD.folio,'reason','Eliminación de ticket de prueba confirmada por folio'));
 delete from sudmar_private.test_ticket_registry where ticket_id=OLD.id;
 return OLD;
end $$;
revoke all on function sudmar_private.guard_test_ticket() from public,anon,authenticated;
create trigger zz_guard_test_ticket before insert or update or delete on public.tickets
for each row execute function sudmar_private.guard_test_ticket();

create function sudmar_private.mark_test_ticket_used() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 update sudmar_private.test_ticket_registry set blocked=true
 where ticket_id in ((to_jsonb(NEW)->>'ticket_id')::uuid,(to_jsonb(NEW)->>'antecedent_ticket_id')::uuid,
                    (to_jsonb(OLD)->>'ticket_id')::uuid,(to_jsonb(OLD)->>'antecedent_ticket_id')::uuid);
 return NEW;
end $$;
revoke all on function sudmar_private.mark_test_ticket_used() from public,anon,authenticated;
create trigger mark_test_ticket_used after insert or update on public.tasks
for each row execute function sudmar_private.mark_test_ticket_used();
create trigger mark_test_ticket_used after insert or update on public.evidence
for each row execute function sudmar_private.mark_test_ticket_used();

-- Public endpoint preserves caller RLS; privileged checks are only in triggers.
create function public.delete_test_ticket(p_ticket_id uuid,p_folio text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare deleted_id uuid;
begin
 if p_folio is null or p_folio='' then raise exception 'Escribe el folio exacto.'; end if;
 perform set_config('sudmar.confirm_delete_folio',p_folio,true);
 delete from public.tickets where id=p_ticket_id and folio=p_folio returning id into deleted_id;
 if deleted_id is null then raise exception 'Folio incorrecto, ticket protegido o no disponible. Debe cancelarse/archivarse si tiene historial.'; end if;
 perform set_config('sudmar.confirm_delete_folio','',true);
 return deleted_id;
end $$;
revoke all on function public.delete_test_ticket(uuid,text) from public,anon,authenticated;
grant execute on function public.delete_test_ticket(uuid,text) to anon;
alter table public.tickets enable row level security;
revoke truncate,trigger,references on public.tickets from anon,authenticated;
revoke delete on public.tickets from authenticated;
grant delete on public.tickets to anon;
create policy pilot_delete_test_ticket on public.tickets for delete to anon
using (is_test and folio=current_setting('sudmar.confirm_delete_folio',true));
notify pgrst,'reload schema';
