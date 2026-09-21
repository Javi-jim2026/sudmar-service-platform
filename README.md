# SUDMAR · Service Platform

Dashboard interno para consultar tickets, tareas, equipos y clientes. La versión 0.3 incorpora los datos del Excel actualizado el 21 de septiembre de 2026: **574 tickets y 3,475 tareas**.

## Ejecutar

Se necesita Python 3 para servir los archivos. No hay dependencias de JavaScript en producción ni recursos cargados desde CDN.

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory prototype
```

Abrir `http://localhost:8080`. Para ejecutar las pruebas de integridad y reglas de consulta, con Node.js 20 o posterior:

```sh
node --test tests/core.test.mjs
```

## Incluido en esta entrega

- Resumen visual con indicadores calculados sobre los filtros activos.
- Filtros combinables por folio, nivel, cliente, unidad de negocio, área, etapa, responsable, estado, modelo, serie y fechas de inicio, meta o cierre real.
- Búsqueda en títulos, clientes, equipo, bitácora y diagnóstico; vistas de filtros guardadas en el navegador; exportación CSV de la selección.
- Detalle de tickets, tareas asociadas por folio exacto, responsables, notas y enlaces de evidencias.
- Equipos agrupados por número de serie, conservando las distintas denominaciones de modelo registradas.
- Vista por cliente y directorio de contactos del Excel.
- Diseño para computadora y teléfono, sin servicios externos de seguimiento.
- Manifest, iconos y service worker preparados para instalación cuando exista una dirección HTTPS adecuada.

## Alcance de los datos

Esta versión es una **copia de consulta**. No sincroniza futuras ediciones del Excel ni permite captura compartida. La fecha del archivo y la de importación son visibles en la aplicación. Filtrar un periodo muestra registros por sus fechas; no reconstruye estados anteriores que el Excel no conserva.

Los datos operativos y contactos son internos. El repositorio es privado; eso por sí solo no protege un eventual sitio web. El despliegue compartido debe incluir acceso autenticado antes de publicar los JSON. El service worker conserva únicamente la interfaz, sin guardar los datos operativos para uso sin conexión.

## Actualizar desde Excel

```sh
python3 tools/import_workbook.py "/ruta/DASHBOARD OPERACIONES 2026.xlsx" --output prototype/data
```

La importación no modifica el Excel. Lee valores guardados por Excel, incluidas fórmulas ya calculadas. Antes de importar una nueva versión, abrir, recalcular y guardar el archivo en Excel. Revisar `prototype/data/import-report.json` y actualizar los totales esperados de la prueba de aceptación cuando cambie el archivo de referencia.

Se conservaron las 22 tareas sin descripción y el ticket cuyo estado contiene `<`. Este último se muestra como «Sin clasificar» y no se suma a los activos. Los siete enlaces a carpetas no se han inspeccionado. Los indicadores del dashboard se calculan desde TICKETS/TAREAS, no desde el resumen antiguo del libro.

## Personalización y siguientes fases

Modificar nombre, colores y ruta del logo en `prototype/src/config.js`; colocar los recursos de marca en `prototype/assets/brand/`. Los iconos de instalación se pueden sustituir en esa misma carpeta. La interfaz, las reglas de consulta y el acceso a datos están separados para conectar después una API autenticada.

La siguiente fase incorpora base de datos compartida, permisos, captura y asignación de tareas, historial de cambios y expedientes. La gestión de fotografías y la validación de evidencias quedan pendientes conforme al alcance acordado.

Ver [arquitectura y reglas de datos](docs/architecture.md) y [estado de la entrega](docs/README.md).

## Generar una vista de revisión descargable

```sh
python3 tools/build_preview.py --output /ruta/SUDMAR_Dashboard_v0.3.html
```

El archivo resultante contiene los datos del corte y funciona sin servidor, abriéndolo en un navegador. Está destinado a revisión interna y no se sincroniza. La instalación como app requiere la versión alojada en HTTPS.
