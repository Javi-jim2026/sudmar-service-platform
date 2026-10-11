# Gestión multiequipo · SUDMAR

Gestión multiequipo es optativa y está desactivada por defecto. El formulario de ticket convencional no se modifica. Al habilitarla se puede agregar hasta 100 series, de modelos iguales o distintos, con seguimiento individual: estado, técnico, fecha, hallazgos, trabajo, resultado y enlace de evidencia. El ticket conserva folio, responsable, estado e indicadores únicos.

## Persistencia

Los tickets conservan un registro de serie principal compatible con el módulo histórico. La tabla `ticket_equipment` asocia todas las series y la función `replace_ticket_equipment` valida modelos/series y actualiza estas asociaciones de manera transaccional. Los tickets antiguos no se migran automáticamente; los folios desactivados tampoco cambian.

## Límites y seguridad

El sistema actual usa llave pública y permisos anónimos operativos, por lo que los nuevos permisos de la tabla son equivalentes a los de `tickets`; debe desplegarse autenticación con autorización por rol antes de exponer información sensible. Durante la creación la inserción del ticket y la vinculación se realizan en dos solicitudes; un error de vinculación conserva el ticket, lo informa y permite volver a editarlo. La función de asociación sí es atómica. Una serie repetida en el mismo ticket no está permitida. Al quitar una unidad con seguimiento, la interfaz solicita confirmación.

## Verificación

La prueba E2E cubre formulario normal, habilitación opcional, varios modelos y series, trabajo individual, actualización posterior y búsqueda de antecedentes por cualquier serie.
