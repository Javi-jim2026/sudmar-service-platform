# Escritura operativa · OneDrive / Excel

Archivo maestro: **DASHBOARD OPERACIONES 2026.xlsx**

## Principio

El navegador no debe contener credenciales de Microsoft ni escribir directamente al archivo.
La plataforma enviará las altas a un endpoint HTTPS autenticado/controlado. Ese servicio será el único componente con permiso para escribir en OneDrive.

Flujo:

```
SUDMAR Service Platform
        |
        | POST /tickets  o  POST /tasks
        v
Servicio seguro de escritura
        |
        v
DASHBOARD OPERACIONES 2026.xlsx
```

## Alta de ticket

`POST /tickets`

Ejemplo:

```json
{
  "title": "Falla de arranque ESE 260",
  "client": "PLANTI RENT",
  "businessUnit": "GARANTIA",
  "ticketType": "GARANTIA",
  "priority": "1",
  "area": "OPERACIONES",
  "owner": "Javier Jimenez",
  "openedAt": "2026-09-21",
  "dueAt": "2026-09-23",
  "model": "ESE 260 CW/AS",
  "serial": "89331050/0007",
  "description": "Descripción de la solicitud"
}
```

Respuesta esperada:

```json
{
  "ok": true,
  "folio": "2644"
}
```

El servicio debe calcular el siguiente folio en servidor. El navegador nunca debe decidir el consecutivo.

## Alta de tarea

`POST /tasks`

Ejemplo:

```json
{
  "ticketFolio": "2644",
  "taskType": "COMPRA",
  "client": "SECBA",
  "reference": "OTM ABB / refacción",
  "title": "Comprar relevador para tablero ATS",
  "owner": "Manuel Cervantes",
  "area": "Compras",
  "priority": "1",
  "startAt": "2026-09-21",
  "dueAt": "2026-09-22",
  "status": "SIN INICIAR",
  "notes": "Confirmar disponibilidad antes de emitir compra."
}
```

`ticketFolio` puede quedar vacío para tareas administrativas independientes como cobranza, compras internas o seguimientos generales. En esos casos `client` y/o `reference` conservan el contexto de la actividad.

## Reglas mínimas antes de habilitar escritura

1. Las hojas operativas que reciban altas deben convertirse en **Tablas de Excel** con nombres estables.
2. Debe existir un identificador único para cada ticket y cada tarea.
3. El servicio debe validar responsables, estados y campos obligatorios.
4. Debe impedir folios duplicados y reintentos duplicados.
5. Cada escritura debe registrar fecha/hora y usuario que ejecutó la acción.
6. No se debe reemplazar el archivo completo para agregar una fila.
7. La plataforma debe volver a consultar datos después de una escritura para reflejar el nuevo registro.

## Estado actual

La interfaz de **Nuevo ticket** y **Nueva tarea** ya está preparada. Mientras `writeApiUrl` esté vacío en `prototype/src/config.js`, los formularios no realizan modificaciones y muestran un mensaje de conexión pendiente.


## Catálogo de personal

Los campos de responsable deben validar contra el catálogo publicado por la plataforma. El área se deriva automáticamente de la persona seleccionada.

La primera versión utiliza nombres completos como clave de integración. En la fase de autenticación se sustituirá por un identificador estable de usuario.

## Categorías operativas

Para tareas nuevas se debe conservar `taskType`. El dashboard agrupa en:
- COMPRA
- COBRANZA
- FACTURACION
- COTIZACION
- CAMPO
- SEGUIMIENTO

Para el histórico sin `taskType`, la interfaz aplica una clasificación por palabras clave únicamente para visualización; no altera el Excel original.
