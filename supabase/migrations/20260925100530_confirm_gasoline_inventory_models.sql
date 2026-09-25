-- Inventario Almacen.xlsx / INVENTARIO (A serie, B modelo, E tipo), consulta 2026-09-25.
-- El archivo accesible contiene 25 filas de estos modelos (21 + 4), todas con serie distinta.
-- Se conserva el tipo original de cada fila en esta migración; la confirmación expresa
-- del usuario corrige la clasificación de ambos modelos a GENERADORES A GASOLINA.
insert into public.equipment_models(name,equipment_type)
values ('ESE 2006 DBS-GT ES','GENERADORES A GASOLINA'),
       ('ESE 804 SDHS-DC','GENERADORES A GASOLINA')
on conflict (name_key) do nothing;

with source(model,serial_number,source_row,original_type) as (
 values
  ('ESE 2006 DBS-GT ES','230035-10531',26,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10532',27,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10534',28,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10535',29,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10536',30,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10537',31,'GENERADORES A GASOLINA'),
  ('ESE 804 SDHS-DC','141001-10529',379,'PORTATILES'),
  ('ESE 2006 DBS-GT ES','230035-10516',485,'GENERADORES A DIESEL'),
  ('ESE 2006 DBS-GT ES','230035-10533',502,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10518',535,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10519',536,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10520',537,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10521',538,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10522',539,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10523',540,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10524',541,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10525',542,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10526',543,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10527',544,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10528',545,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10529',546,'GENERADORES A GASOLINA'),
  ('ESE 2006 DBS-GT ES','230035-10530',547,'GENERADORES A GASOLINA'),
  ('ESE 804 SDHS-DC','141001MX10533',923,'PORTATILES'),
  ('ESE 804 SDHS-DC','141001-10537',986,'PORTATILES'),
  ('ESE 804 SDHS-DC','141001-10536',996,'GENERADORES A DIESEL')
)
insert into public.equipment_serials(model_id,serial_number,source_row)
select m.id,s.serial_number,s.source_row
from source s join public.equipment_models m on m.name_key=public.catalog_key(s.model)
on conflict (model_id,serial_key) do nothing;

-- Vincular solamente tickets con coincidencia exacta de modelo y, si existe,
-- de serie. Preservar source_model/source_serial y todos los campos históricos.
update public.tickets t set catalog_model_id=m.id
from public.equipment_models m
where m.name_key in (public.catalog_key('ESE 2006 DBS-GT ES'),public.catalog_key('ESE 804 SDHS-DC'))
  and public.catalog_key(t.source_model)=m.name_key
  and t.catalog_model_id is null;
update public.tickets t set catalog_serial_id=s.id
from public.equipment_serials s
where t.catalog_model_id=s.model_id and public.catalog_key(t.source_serial)=s.serial_key
  and t.catalog_serial_id is null and s.model_id in (
   select id from public.equipment_models where name_key in
   (public.catalog_key('ESE 2006 DBS-GT ES'),public.catalog_key('ESE 804 SDHS-DC')));
