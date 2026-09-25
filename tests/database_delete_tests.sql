begin;
do $$
declare t public.tickets; x uuid; kind text; rejected boolean; before_count bigint;
begin
 select count(*) into before_count from public.tickets;
 foreach kind in array array['clean','wrong_folio','direct','normal','retag','notes','sticky','task','antecedent','evidence','legacy','audit','disabled'] loop
  set local role anon;
  insert into public.tickets(business_unit,title,is_test) values('SUDMAR','QA transaccional eliminación',kind not in ('normal','retag')) returning * into t;
  if kind='notes' then update public.tickets set logbook='Seguimiento real' where id=t.id; end if;
  if kind='sticky' then
   update public.tickets set work_performed='Trabajo registrado' where id=t.id;
   update public.tickets set work_performed=null where id=t.id;
  end if;
  reset role;
  if kind='task' then insert into public.tasks(ticket_id,title) values(t.id,'QA'); end if;
  if kind='antecedent' then
   insert into public.tickets(business_unit,title) values('SUDMAR','QA principal') returning id into x;
   insert into public.tasks(ticket_id,antecedent_ticket_id,title) values(x,t.id,'QA');
  end if;
  if kind='evidence' then insert into public.evidence(ticket_id,file_name) values(t.id,'QA.txt'); end if;
  if kind='legacy' then insert into public.legacy_tasks(ticket_folio,title) values(t.folio,'QA'); end if;
  if kind='audit' then insert into public.audit_log(entity_type,entity_id,action) values('ticket',t.id::text,'QA'); end if;
  if kind='disabled' then update sudmar_private.ticket_deletion_pilot set enabled=false; end if;
  set local role anon;
  rejected:=false;
  begin
   if kind='direct' then
    delete from public.tickets where id=t.id returning id into x;
    rejected:=x is null;
   elsif kind='retag' then update public.tickets set is_test=true where id=t.id;
   else perform public.delete_test_ticket(t.id,case when kind='wrong_folio' then t.folio||'x' else t.folio end);
   end if;
  exception when raise_exception then rejected:=true;
  end;
  if kind='clean' then
   if rejected or exists(select 1 from public.tickets where id=t.id) then raise exception 'FAIL: clean'; end if;
  elsif not rejected or not exists(select 1 from public.tickets where id=t.id) then raise exception 'FAIL: %',kind;
  end if;
  reset role;
  if kind='disabled' then update sudmar_private.ticket_deletion_pilot set enabled=true; end if;
 end loop;
 set local role anon;
 select * into t from public.tickets where not is_test order by created_at limit 1;
 rejected:=false;
 begin perform public.delete_test_ticket(t.id,t.folio); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'FAIL: historical protection'; end if;
 reset role;
end $$;
select 'PASS: clean delete, wrong folio, direct delete, normal, immutable test mark, notes, erased history, task, antecedent, evidence, legacy, audit, disabled pilot, historical protection' as result;
rollback;
