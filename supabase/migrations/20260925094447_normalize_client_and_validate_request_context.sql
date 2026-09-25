update public.clients set name='ENERGÍA ADAPTABLE' where public.catalog_key(name)='ENERGIA ADAPTABLE';
create function public.valid_guided_request(v jsonb) returns boolean
language sql immutable set search_path='' as $$
 select v is null or (jsonb_typeof(v)='object'
 and not exists(select 1 from unnest(array['what','where','condition','required']) k
 where jsonb_typeof(v->k) is distinct from 'string' or length(btrim(v->>k))<4)
 and (select count(*) from unnest(array['where','condition','required']) k
 where translate(lower(btrim(v->>k)),'áéíóú','aeiou') not in
 ('presenta falla','revisar equipo','no funciona','cliente reporta problema','sin datos','no se sabe','no aplica','pendiente','equipo','falla','revision','normal','ninguna'))>=2)
$$;
alter table public.tickets add constraint tickets_guided_request_valid check(public.valid_guided_request(request_context));
