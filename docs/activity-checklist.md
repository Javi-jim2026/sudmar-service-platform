# Categorías y lista de trabajos internos

La apertura del formulario de actividades fallaba antes de llamar a Supabase: `renderActivityTicketOptions` consultaba `queryText`, una variable definida solamente en otra función. La corrección cubre tanto el botón superior como el botón dentro del ticket y la búsqueda posterior.

Cada actividad puede clasificarse como OPERACIONES, COMPRAS, ADMINISTRATIVA, COMERCIAL u OTRA. Las actividades existentes conservan su categoría sin asignar hasta que el usuario la elija. El tipo específico (instalación, compra, etc.) se conserva por separado.

OPERACIONES muestra una lista editable de hasta 500 trabajos, de hasta 1000 caracteres cada uno. Cada trabajo tiene identificador, texto y casilla de completado. Son datos internos de la actividad, guardados atómicamente en `tasks.checklist`; no se crean tareas adicionales. Cambiar de categoría oculta la lista sin borrarla.

El avance es el porcentaje redondeado de trabajos completados entre trabajos totales; una lista vacía muestra 0%. Aparece en el detalle de actividad, cada actividad del ticket y el calendario. El estado de la actividad sigue siendo independiente. Las fechas y los campos de observaciones, resultado y resolución se preservan. La edición evita sobrescribir cambios concurrentes mediante `updated_at` y omite campos sin cambios, incluidas fechas completas de la base de datos.

## Base de datos

La migración `20260924185246_activity_categories_and_internal_checklist.sql` corresponde a la versión registrada por Supabase. Agrega solamente `category`, `checklist`, su validación y restricciones. No reclasifica registros históricos ni modifica sus campos existentes. Conserva las políticas RLS del piloto; el checklist hereda los permisos de su actividad. El validador es SECURITY INVOKER y no consulta datos ni eleva privilegios.

## Validación

- `node --test tests/*.test.mjs`: 11 pruebas de dominio, conservación de importación y repositorio.
- `node tests/ui.e2e.mjs` con Playwright 1.62.1: navegador con API simulada, ticket nuevo, ambos botones, búsqueda, 15 trabajos, agregar/editar/eliminar/completar, cambios de categoría, error de escritura sin perder el formulario, avance en ticket/calendario y persistencia tras recarga. No escribe datos operativos.
- GitHub Actions ejecuta ambas baterías antes de publicar.
- Supabase: prueba transaccional con `SET LOCAL ROLE anon`, creación de ticket/actividad, lectura y edición de 15 trabajos, rechazo de categorías/listas inválidas, conservación de observaciones/resolución/estado/fechas y ROLLBACK de todos los registros de prueba.
- Comparación previa/posterior: 584 tickets y 3 actividades; huellas de todos los campos originales idénticas.

## Límites del piloto

El piloto conserva su acceso anónimo actual. La autenticación por usuario sigue siendo una fase pendiente y no se amplían los permisos en esta entrega. Los avisos informativos de Supabase sobre tablas con RLS sin políticas corresponden a audit_log, evidence, import_batches y legacy_tasks; se conservan cerradas al cliente. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Los porcentajes se redondean a enteros. No hay ponderación por duración ni dependencias entre actividades. Una categoría distinta de OPERACIONES no muestra porcentaje de checklist. Las listas ocultas conservan su contenido al guardar.
