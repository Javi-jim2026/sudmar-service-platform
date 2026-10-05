alter table public.tickets add column if not exists resolved_at timestamptz;
alter table public.tasks add column if not exists evidence_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='tasks_evidence_url_https_chk'
      and conrelid='public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_evidence_url_https_chk
      check (evidence_url is null or evidence_url ~* '^https://');
  end if;
end $$;

create or replace function public.sync_ticket_operational_dates()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  terminal boolean;
  old_terminal boolean;
  model uuid;
  req_summary text;
begin
  new.opened_at := coalesce(new.opened_at, now());

  if (tg_op='INSERT' or new.business_unit is distinct from old.business_unit)
     and coalesce(new.business_unit,'') not in ('SUDMAR','PRETTL') then
    raise exception 'Selecciona SUDMAR o PRETTL.';
  end if;

  if tg_op='INSERT' then
    new.operational_status := coalesce(new.operational_status,'REGISTRADO');
  end if;

  if new.operational_status is not null then
    terminal := new.operational_status in ('CONCLUIDO','CANCELADO');
    old_terminal := case when tg_op='UPDATE' then coalesce(old.operational_status in ('CONCLUIDO','CANCELADO'),false) else false end;
    if terminal then
      new.closed_at := coalesce(new.closed_at,now());
    elsif tg_op='INSERT' or old_terminal or (tg_op='UPDATE' and new.operational_status is distinct from old.operational_status) then
      new.closed_at := null;
    end if;

    if new.operational_status='CONCLUIDO' then
      if new.resolved_at is null and (tg_op='INSERT' or old.operational_status is distinct from 'CONCLUIDO') then
        new.resolved_at := now();
      end if;
    else
      new.resolved_at := null;
    end if;

    new.status := new.operational_status;
  end if;

  if new.service_category_id is not null and not exists(
    select 1 from public.service_categories c
    where c.id=new.service_category_id and c.business_unit=new.business_unit
  ) then
    raise exception 'La categoría no corresponde a la unidad.';
  end if;

  if new.catalog_serial_id is not null then
    select model_id into model from public.equipment_serials where id=new.catalog_serial_id;
    if model is distinct from new.catalog_model_id then
      raise exception 'La serie no corresponde al modelo.';
    end if;
  end if;

  if new.due_at < new.opened_at then
    raise exception 'La meta no puede ser anterior al inicio.';
  end if;

  if new.resolved_at is not null and new.resolved_at < new.opened_at then
    raise exception 'La fecha de resolución real no puede ser anterior a la solicitud.';
  end if;

  if new.request_context is not null then
    if not public.valid_guided_request(new.request_context) then
      raise exception 'Completa correctamente la solicitud / incidencia reportada.';
    end if;

    if new.request_context->>'what'='__SUDMAR_SIMPLE_REQUEST__'
       and new.request_context->>'where'='__SUDMAR_SIMPLE_REQUEST__'
       and new.request_context->>'condition'='__SUDMAR_SIMPLE_REQUEST__' then
      req_summary := btrim(coalesce(new.request_context->>'required',''));
    else
      req_summary := concat(
        new.request_context->>'what',' · ',
        new.request_context->>'where',' · ',
        new.request_context->>'condition',
        '. Se requiere: ',new.request_context->>'required'
      );
    end if;

    new.description := req_summary;
    if nullif(btrim(coalesce(new.title,'')),'') is null then
      new.title := left(req_summary,180);
    end if;
  end if;

  return new;
end
$function$;

create or replace function public.sync_activity_operational_state()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare group_name text;
begin
 if tg_op='INSERT' then new.activity_status:=coalesce(new.activity_status,'POR INICIAR'); end if;
 if new.activity_status is not null then
  select group_code into group_name from public.activity_statuses where name=new.activity_status;
  new.status:=new.activity_status;
  if group_name='CERRADA' then
   if length(btrim(coalesce(new.resolution,'')))=0 or length(btrim(coalesce(new.outcome,'')))=0 then raise exception 'Registra resultado y resolución para cerrar.'; end if;
   new.completed_at:=coalesce(new.completed_at,now());
  else
   new.completed_at:=null;
  end if;
 end if;
 if new.completed_at is not null and new.completed_at < new.start_at then
  raise exception 'La fecha de realización real no puede ser anterior al inicio.';
 end if;
 if new.antecedent_ticket_id=new.ticket_id then raise exception 'El antecedente debe ser otra atención.'; end if;
 return new;
end
$function$;
