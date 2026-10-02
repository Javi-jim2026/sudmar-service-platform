create or replace function public.valid_guided_request(v jsonb)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select v is null or (
    jsonb_typeof(v)='object'
    and (
      (
        v->>'what'='__SUDMAR_SIMPLE_REQUEST__'
        and v->>'where'='__SUDMAR_SIMPLE_REQUEST__'
        and v->>'condition'='__SUDMAR_SIMPLE_REQUEST__'
        and jsonb_typeof(v->'required')='string'
        and length(btrim(v->>'required'))>=4
      )
      or
      (
        not exists(
          select 1
          from unnest(array['what','where','condition','required']) k
          where jsonb_typeof(v->k) is distinct from 'string'
             or length(btrim(v->>k))<4
        )
        and (
          select count(*)
          from unnest(array['where','condition','required']) k
          where translate(lower(btrim(v->>k)),'áéíóú','aeiou') not in
            ('presenta falla','revisar equipo','no funciona','cliente reporta problema','sin datos','no se sabe','no aplica','pendiente','equipo','falla','revision','normal','ninguna')
        )>=2
      )
    )
  )
$function$;
