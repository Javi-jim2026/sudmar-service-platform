# Eliminación temporal de tickets de prueba

Disponible únicamente desde el detalle del ticket. Al crear un ticket se puede marcar **Ticket de prueba** (desmarcado por defecto). La marca no se puede agregar o cambiar posteriormente: los 586 tickets existentes quedan protegidos.

Para eliminar, escribir el folio exacto en la confirmación. El botón permanece deshabilitado hasta que coincide. Volver o cerrar no elimina nada. Los errores del servidor conservan el diálogo y el registro.

## Protección en Supabase

- RPC `delete_test_ticket(uuid,text)` SECURITY INVOKER, limitada al rol `anon` del piloto compartido actual. La política DELETE exige marca de prueba y folio confirmado en la transacción; DELETE directo por REST no encuentra filas elegibles.
- Registro privado creado solo al insertar tickets de prueba. Una marca o fecha falsificada no habilita tickets históricos. Cambios operativos, actividades y evidencias bloquean permanentemente el registro, incluso si después se vacían los textos o se desvincula la actividad.
- Triggers privados SECURITY DEFINER, sin permiso EXECUTE para clientes, revisan registros invisibles por RLS. Es un uso deliberado para comprobar evidencias/históricos y escribir auditoría; la RPC pública mantiene los privilegios del llamador. El piloto no tiene identidad individual: la auditoría lo indica expresamente.
- Se revisan las relaciones FK entrantes (actividad principal, antecedente, evidencias y futuras referencias), las tareas históricas por folio y la auditoría. Se bloquean tablas relacionadas durante la comprobación para impedir inserciones concurrentes que provocarían cascadas. Ante conflicto concurrente la transacción falla sin borrar parcialmente.
- No se modifican FK ni se ejecutan cascadas sobre datos operativos. El borrado conserva una auditoría con folio, motivo, fecha e identificador. Se revocaron TRUNCATE/TRIGGER/REFERENCES de tickets a roles del cliente y DELETE a authenticated.
- La configuración privada caduca a los 30 días de la migración (25 de octubre de 2026, aproximadamente 15:17 UTC). No se renueva al crear otro ticket. Para apagar antes: `update sudmar_private.ticket_deletion_pilot set enabled=false;`. El interruptor visual `config.features.testTicketDeletion` oculta la opción, pero el apagado autoritativo es el de la base de datos.
- No se añadieron credenciales privadas al navegador. El alcance sigue siendo el piloto compartido: conocer la URL/clave pública permite usar sus permisos existentes. La confirmación de folio evita errores; no constituye autenticación individual.

## Validación (25 septiembre 2026)

- Pruebas de aplicación y navegador: confirmación exacta, cancelar, rechazo del servidor, borrado exitoso y ausencia del botón en la lista principal.
- `tests/database_delete_tests.sql`: 14 casos reales con rol anon dentro de una transacción revertida; incluyen historial protegido, marca inmutable, borrado directo bloqueado, seguimiento vaciado, actividad principal/antecedente, evidencia, histórico, auditoría e interruptor apagado.
- API real: ticket #2688 creado explícitamente como prueba y eliminado físicamente. Se verificó su ausencia y que los 586 tickets y 3 actividades originales siguen idénticos. Huella SQL antes/después de las columnas originales: `ac406999e641a9fbd061e885bb423ca9`.
- Supabase Advisors: sin errores ni advertencias; siete avisos informativos por tablas con RLS sin políticas, bloqueadas por defecto (incluye las dos tablas privadas deliberadamente inaccesibles). [Explicación del aviso](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- Los folios consumidos por pruebas no se reutilizan; las secuencias pueden tener saltos.

Migración: `20260925151742_safe_temporary_test_ticket_deletion.sql`, nombre/version generados por Supabase al aplicar la migración remota. CLI no disponible en el entorno; se guardó el SQL aplicado con la versión retornada por el servidor.
