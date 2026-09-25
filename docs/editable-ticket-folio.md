# Captura y edición del folio

Crear ticket y el detalle incluyen «Número de ticket / folio». Al crear se sugiere el siguiente número a partir de los folios numéricos cargados; es editable y no reserva un número. Se permiten folios de texto y ceros iniciales. Se eliminan espacios exteriores y se exige un valor.

El repositorio comprueba duplicados antes de escribir. La restricción existente `tickets_folio_unique` protege también contra solicitudes concurrentes; su error se traduce a un mensaje claro. La comparación conserva la semántica exacta de texto existente. Los cambios se guardan mediante PATCH por UUID, nunca mediante upsert por folio.

Después de guardar se recargan tickets y actividades, se reconstruyen folios principales/antecedentes a partir de sus UUID y se vuelve a abrir el mismo ticket. Los filtros activos que coincidan exactamente con el folio anterior se actualizan. Las vistas guardadas por texto conservan su consulta original.

La migración agrega `legacy_tasks.ticket_id`, relaciona los históricos por su folio actual y conserva `ticket_folio` como dato de origen. Las nuevas importaciones también resuelven esa relación. El registro privado de eliminación de pruebas actualiza su folio sin reiniciar su bloqueo permanente. No se cambian UUID, actividades, evidencias ni datos históricos originales.

Validación: 16 pruebas de lógica; navegador Chromium en escritorio/tableta/móvil con creación manual, duplicado al crear/editar y edición con actividad vinculada; SQL real con rol anon dentro de transacciones revertidas para creación, duplicados, renombrado histórico, relaciones UUID, evidencias y eliminación de prueba renombrada; regresión de los 14 casos de eliminación. Supabase Advisors no reportó errores ni advertencias; conserva siete avisos informativos previos de tablas deliberadamente sin acceso mediante RLS ([detalle](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).

Migración remota `20260925172120_editable_ticket_folio_compatibility.sql`: versión asignada por Supabase al aplicar el SQL, conservada en el repositorio.
