# Operación técnica y catálogos

Implementación del 25 de septiembre de 2026. Base previa: `95861ce3a6452e82ca743dabb24b75d996959a17`.
Rama de respaldo: `backup/pre-operational-redesign-20260925`.

## Datos y compatibilidad

- Respaldo de 838 filas en `sudmar_backup.operational_20260925`, fuera de la API y sin permisos para `anon`/`authenticated`.
- Se conservan 586 tickets, 3 actividades, los clientes, equipos y personal originales. No se eliminaron filas.
- Catálogos nuevos: `service_categories`, `equipment_models`, `equipment_serials`, `activity_types`, `activity_statuses`.
- 17 categorías por unidad y 17 tipos de actividad. Los estados personalizados tienen grupo estadístico obligatorio y marca de cancelación.
- `tickets.operational_status` es el único estado operativo; `legacy_status`, `legacy_stage` y `legacy_diagnosis` conservan texto original. No se elimina `stage` del almacenamiento.
- Clasificación inicial segura: 433 CONCLUIDO, 9 EN EJECUCIÓN, 38 EN ESPERA, 3 REGISTRADO. Otros 103 registros requieren clasificación y no se cuentan como activos ni terminados automáticamente.
- Se agregaron `request_context`, `technical_findings`, `work_performed`, `final_condition` y referencias de catálogo. La descripción y el título se generan en el servidor desde las cuatro respuestas.
- La bitácora y el diagnóstico histórico no se reinterpretan automáticamente como trabajos realizados.
- `tasks.ticket_id` conserva la relación principal obligatoria. `antecedent_ticket_id` es una relación opcional con otra atención previa.
- Saúl González: Gerencia de Ventas / Ventas. Manuel Cervantes conserva Compras y agrega Ventas. Cargo, área anterior y responsabilidades de campo se conservan.
- ENERGÍA ADAPTABLE se normaliza como cliente conservando su identificador y referencias. Las unidades históricas siguen consultables; las nuevas son SUDMAR/PRETTL.

## Inventario

Fuente: `Inventario Almacen.xlsx`, hoja `INVENTARIO`, columnas A (serie), B (modelo), E (tipo), a partir de fila 5.
Se normalizan espacios y mayúsculas, sin inferir tipos desde nombres de modelo.

- 1,065 filas con modelo.
- 85 modelos sin contradicciones, 1,038 combinaciones únicas modelo/serie.
- 1 duplicado de combinación eliminado del catálogo; el archivo fuente se conserva intacto.
- 130 tickets vinculados por modelo exacto normalizado y 64 por modelo + serie.
- Tipos originales normalizados: GENERADORES A DIESEL, OTROS, PORTATILES, TORRES DE ILUMINACION, TRANSFERENCIAS.
- Pendientes de confirmación: ESE 2006 DBS-GT ES (GENERADORES A DIESEL / GENERADORES A GASOLINA), ESE 804 SDHS-DC (GENERADORES A DIESEL / PORTATILES). Sus 26 filas no se reclasifican automáticamente.

## Interfaz

Captura guiada, catálogos buscables con alta persistente, SLA-01 a SLA-04 con borde lateral y badge, estado separado, tipo de equipo automático, filtros globales por tipo y SLA, ayudas ocultas accesibles al tocar, resumen para cédula y copia al portapapeles. El grupo pendiente de validación se muestra por separado para evitar perderlo de las estadísticas.

Actividades: un solo tipo, área según responsable, antecedente opcional, checklist sin categoría, observaciones y resultado/resolución. Los estados de cierre requieren resultado y resolución.

## Verificación

`node --test tests/*.test.mjs`: reglas de dominio, filtros, validación guiada, cédula, checklist y compatibilidad histórica.
`node tests/ui.e2e.mjs`: alta y reutilización de cliente, categoría dependiente, modelo/serie/tipo, captura guiada, checklist de 15 trabajos, errores de permisos sin perder el formulario, estado personalizado, cierre de actividad, edición de ticket, copia, filtros y anchos 390/768/1360.
`tests/database_operations.sql`: pruebas con el rol piloto `anon`, dentro de una transacción con rollback. Verifica duplicados, cierres, reaperturas y resolución obligatoria sin conservar datos de prueba.

## Seguridad y reversión

Se mantiene el acceso piloto existente mediante clave publicable y RLS; no se usa service-role en el navegador. Los catálogos permiten lectura/alta, sin actualización o borrado público. El respaldo no está expuesto.
El asesor de seguridad no reportó errores ni advertencias: solo avisos informativos de RLS sin políticas en tablas ya bloqueadas y el respaldo privado.
No restaurar toda la base desde el respaldo después de nuevas capturas: primero comparar y preservar los registros posteriores. La rama de respaldo conserva el código, pero volver a ella requiere revisar la compatibilidad de estados con el nuevo esquema.
