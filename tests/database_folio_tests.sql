begin;
do $$
declare t public.tickets; other_id uuid; task_id uuid; evidence_id uuid; historical_id uuid; rejected boolean;
begin
 set local role anon;
 insert into public.tickets(folio,business_unit,title,is_test) values('QA-FOLIO-001','SUDMAR','QA folio',true) returning * into t;
 if t.folio <> 'QA-FOLIO-001' or t.id is null then raise exception 'Manual create failed'; end if;
 update public.tickets set folio='QA-FOLIO-002' where id=t.id;
 perform public.delete_test_ticket(t.id,'QA-FOLIO-002');
 if exists(select 1 from public.tickets where id=t.id) then raise exception 'Renamed test deletion failed'; end if;
 insert into public.tickets(folio,business_unit,title) values('QA-FOLIO-001','SUDMAR','QA original') returning * into t;
 insert into public.tickets(folio,business_unit,title) values('QA-FOLIO-OTHER','SUDMAR','QA other') returning id into other_id;
 rejected:=false;
 begin insert into public.tickets(folio,business_unit,title) values(t.folio,'SUDMAR','Duplicate'); exception when unique_violation then rejected:=true; end;
 if not rejected then raise exception 'Duplicate create accepted'; end if;
 rejected:=false;
 begin update public.tickets set folio=t.folio where id=other_id; exception when unique_violation then rejected:=true; end;
 if not rejected then raise exception 'Duplicate update accepted'; end if;
 reset role;
 insert into public.tasks(ticket_id,antecedent_ticket_id,title) values(t.id,other_id,'QA linked') returning id into task_id;
 insert into public.tasks(ticket_id,antecedent_ticket_id,title) values(other_id,t.id,'QA antecedent');
 insert into public.evidence(ticket_id,file_name) values(t.id,'QA.txt') returning id into evidence_id;
 insert into public.legacy_tasks(ticket_folio,title) values(t.folio,'QA historical');
 set local role anon;
 update public.tickets set folio='QA-FOLIO-RENAMED' where id=t.id;
 reset role;
 if not exists(select 1 from public.tasks where id=task_id and ticket_id=t.id and antecedent_ticket_id=other_id) or not exists(select 1 from public.tasks where ticket_id=other_id and antecedent_ticket_id=t.id) then raise exception 'Task links changed'; end if;
 if not exists(select 1 from public.evidence where id=evidence_id and ticket_id=t.id) then raise exception 'Evidence link changed'; end if;
 if not exists(select 1 from public.legacy_tasks where ticket_id=t.id and ticket_folio=t.folio) then raise exception 'Legacy link lost'; end if;
 select id into historical_id from public.tickets where source_row is not null limit 1;
 if historical_id is not null then
  set local role anon;
  update public.tickets set folio='QA-HISTORICAL-RENAME' where id=historical_id;
  if not found then raise exception 'Historical update failed'; end if;
  reset role;
 end if;
end $$;
select 'PASS: manual create, rename, duplicate create/update, UUID activities/antecedents/evidence, historical links, renamed test deletion' as result;
rollback;
