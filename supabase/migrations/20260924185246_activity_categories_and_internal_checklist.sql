-- Additive migration: existing activity fields and RLS policies are preserved.
alter table public.tasks
  add column category text,
  add column checklist jsonb;

create function public.valid_activity_checklist(items jsonb)
returns boolean language plpgsql immutable security invoker
set search_path = '' as $$
declare item jsonb; ids text[] := '{}'; item_id text;
begin
  if items is null then return true; end if;
  if jsonb_typeof(items) <> 'array' then return false; end if;
  if jsonb_array_length(items) > 500 then return false; end if;
  for item in select value from jsonb_array_elements(items) loop
    if jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item->'id') is distinct from 'string'
      or jsonb_typeof(item->'text') is distinct from 'string'
      or jsonb_typeof(item->'completed') is distinct from 'boolean'
      then return false; end if;
    item_id := item->>'id';
    if length(item_id) = 0 or item_id = any(ids)
      or length(btrim(item->>'text')) = 0 or length(item->>'text') > 1000
      then return false; end if;
    ids := array_append(ids,item_id);
  end loop;
  return true;
end $$;
revoke all on function public.valid_activity_checklist(jsonb) from public;
grant execute on function public.valid_activity_checklist(jsonb) to anon, authenticated, service_role;
alter table public.tasks
  add constraint tasks_category_allowed check (category is null or category in ('OPERACIONES','COMPRAS','ADMINISTRATIVA','COMERCIAL','OTRA')),
  add constraint tasks_checklist_valid check (public.valid_activity_checklist(checklist));
-- The fields use the same SELECT/INSERT/UPDATE policies as their parent activity.
-- No new public table, policy expansion, SECURITY DEFINER, or data backfill.
notify pgrst, 'reload schema';
