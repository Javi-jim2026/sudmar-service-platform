begin;
set local role anon;
do $$
declare c uuid; t uuid; a uuid; cat uuid; m uuid; s uuid; dt timestamptz;
begin
 insert into public.clients(name) values('QA Operación transaccional 20260925') returning id into c;
 begin
  insert into public.clients(name) values(' qa   operación transaccional 20260925 ');
  raise exception 'FAIL duplicate was allowed';
 exception when unique_violation then null; end;
 select id into cat from public.service_categories where business_unit='SUDMAR' limit 1;
 select id into m from public.equipment_models limit 1;
 select id into s from public.equipment_serials where model_id=m limit 1;
 insert into public.tickets(folio,client_id,business_unit,service_category_id,catalog_model_id,catalog_serial_id,request_context,operational_status,opened_at)
 values('QA-ROLLBACK-20260925',c,'SUDMAR',cat,m,s,'{"what":"No funciona","where":"Motor de arranque","condition":"Al encender en frío","required":"Diagnóstico eléctrico en sitio"}','REGISTRADO',now()) returning id into t;
 update public.tickets set operational_status='CONCLUIDO' where id=t;
 select closed_at into dt from public.tickets where id=t;
 if dt is null then raise exception 'FAIL close timestamp'; end if;
 update public.tickets set operational_status='EN EJECUCIÓN' where id=t;
 if exists(select 1 from public.tickets where id=t and closed_at is not null) then raise exception 'FAIL reopen timestamp'; end if;
 update public.tickets set operational_status='CANCELADO' where id=t;
 if not exists(select 1 from public.tickets where id=t and closed_at is not null) then raise exception 'FAIL cancellation timestamp'; end if;
 insert into public.tasks(task_code,ticket_id,title,task_type,activity_status,start_at,checklist)
 values('QA-ROLLBACK',t,'Diagnóstico','Diagnóstico','POR INICIAR',now(),'[{"id":"one","text":"Prueba eléctrica","completed":true}]') returning id into a;
 begin
  update public.tasks set activity_status='COMPLETADA' where id=a;
  raise exception 'FAIL resolution required';
 exception when raise_exception then if sqlerrm='FAIL resolution required' then raise; end if; end;
 update public.tasks set activity_status='COMPLETADA',resolution='Pruebas completadas',outcome='REALIZADA' where id=a;
 if not exists(select 1 from public.tasks where id=a and completed_at is not null) then raise exception 'FAIL task timestamp'; end if;
 update public.tasks set activity_status='EN EJECUCIÓN' where id=a;
 if exists(select 1 from public.tasks where id=a and completed_at is not null) then raise exception 'FAIL task reopen'; end if;
end $$;
rollback;
select 'All transactional checks passed; no test records retained.' as result;
