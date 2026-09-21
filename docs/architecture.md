# Arquitectura y continuidad

## Módulos actuales

| Archivo | Responsabilidad |
| --- | --- |
| `prototype/index.html` | Estructura accesible, navegación y diálogos |
| `prototype/styles.css` | Estilos, variables visuales y adaptación al teléfono |
| `prototype/src/config.js` | Marca, colores, logo, origen de datos y opciones |
| `prototype/src/core.js` | Filtros, agrupación, métricas, CSV y reglas puras |
| `prototype/src/repository.js` | Acceso a la copia de datos; punto de sustitución por API |
| `prototype/src/app.js` | Interacciones, navegación y presentación |
| `prototype/src/icons.js` | Iconos vectoriales locales |
| `prototype/data/operations.json` | Metadatos, tickets y tareas del corte |
| `prototype/data/workbook-reference.json` | Hojas de referencia conservadas del Excel |
| `prototype/data/import-report.json` | Conciliación y observaciones de importación |
| `tools/import_workbook.py` | Lectura reproducible del libro sin modificarlo |
| `tools/build_preview.py` | Vista HTML independiente para revisión interna |

## Contrato de consulta

Los filtros generales seleccionan tickets y se mantienen al cambiar de vista. Las métricas y las tareas se calculan sobre esa misma selección. Los filtros locales de tareas aplican después, por responsable y estado de la actividad; no modifican el responsable del ticket.

Cada ticket conserva su folio original y fila de origen. Las tareas se enlazan por igualdad exacta de folio, sin búsqueda aproximada. Los identificadores derivados de filas sirven para esta importación; no deben usarse como identificadores persistentes cuando se implementen altas y ediciones.

Se preserva el área calculada en el Excel. Aunque el proceso deseado relaciona etapa y área, el libro actual contiene fórmulas basadas en unidad de negocio. La automatización futura necesita una tabla de reglas validada, sin recalificar estos datos silenciosamente.

En este corte, activo significa estado reconocido distinto de cerrado o cancelado: 141 tickets. Fuera de plazo significa activo con meta de cierre anterior al día actual en `America/Mexico_City`. Fechas faltantes y estados desconocidos no se clasifican como vencidos. Las fechas de apertura, meta y cierre son días de calendario; las marcas de importación se guardan como instantes ISO.

La vista de equipos agrupa las series válidas y conserva todos los modelos asociados. Es una consulta a los tickets disponibles, no un expediente completo de recepción ni prueba de un cambio físico de modelo. Un servicio puede carecer de equipo o serie y se conserva igualmente.

El directorio se lee desde CLIENTES; cuando se aplican filtros generales se relaciona por nombre normalizado de compañía. Alias comerciales requieren un catálogo de clientes único en la siguiente fase.

## Modelo previsto para la base compartida

| Entidad | Propósito |
| --- | --- |
| Equipo | Identidad interna inmutable; serie original; modelo de origen y actual; condición y ubicación |
| Ticket | Solicitud, cliente, nivel, estado, proceso, área responsable y fechas; relación opcional con equipos |
| Tarea | Actividad vinculada a ticket o etapa, responsables de cualquier área, plazo y resultado |
| Evento | Historial con actor, fecha, cambio, motivo y relaciones con equipo, ticket y tarea |
| Documento / evidencia | Archivo almacenado, tipo, versión, autor, fecha y asociación al evento correspondiente |
| Cliente / contacto | Identidad única, contactos y alias de nombres existentes |
| Usuario / área | Acceso, responsabilidades y permisos |

El expediente se compone de eventos y documentos asociados a la identidad del equipo. Cambiar modelo, etiqueta, caseta o propietario no debe crear una identidad nueva ni eliminar la anterior. La serie puede no estar disponible durante el tránsito; la futura base debe permitir un identificador interno desde esa etapa.

El flujo operativo contempla tránsito, inspección y calidad, asignación y pruebas, preparación/adecuaciones, prueba final antes de salida, entrega y seguimiento. Debe admitir decisiones, devoluciones a etapas previas, tareas paralelas y participación de compras, ventas, almacén e ingenieros de campo. No se impone una secuencia rígida en esta versión de consulta.

## Acceso y edición futura

Sustituir `SnapshotRepository` por un adaptador de API. Las escrituras deberán validar permisos en servidor, conservar historial y resolver ediciones concurrentes. `localStorage` únicamente contiene vistas de filtros; no es una base compartida ni se usa para almacenar expedientes.

La futura carga de fotos deberá guardar el archivo y sus metadatos dentro del expediente. Un enlace de carpeta nunca es suficiente para acreditar evidencias. Los permisos sobre fotos y reportes deben coincidir con los permisos del equipo o servicio.

No publicar los datos actuales mediante alojamiento estático público. Incorporar autenticación y protección de los endpoints antes del acceso de todo el equipo. El manifest y el service worker constituyen preparación para PWA; no equivalen a publicación, instalación en dispositivos reales ni funcionamiento de datos sin conexión.
