# SUDMAR — Punto de recuperación antes de KPI y reportes (08/10/2026)

## Código protegido
- Repositorio: `Javi-jim2026/sudmar-service-platform`.
- Rama de respaldo inmutable para esta entrega: `backup/pre-operaciones-kpi-2026-10-08`.
- Commit antes de todos los cambios: `5c6080cba3b5131423f9a16eba5c65e852d01b82`.
- Página: `https://javi-jim2026.github.io/sudmar-service-platform/`.

### Volver al diseño anterior
Conservar la rama de respaldo. Desde una clonación del repositorio, en una nueva rama de recuperación desde `main`:

```bash
git fetch origin
git switch main
git pull --ff-only
git switch -c restore/pre-operaciones-kpi
git restore --source origin/backup/pre-operaciones-kpi-2026-10-08 -- prototype/src/app.js prototype/src/enhancements.js prototype/src/operations.js prototype/src/ops-pilot.js prototype/ops-pilot.css prototype/index.html prototype/sw.js tests/ui.e2e.mjs
# Los archivos nuevos ops-pilot.js / ops-pilot.css pueden requerir git rm, pues no existían en la rama de respaldo.
git status
```
Comparar resultados, hacer commit y desplegar con el workflow de GitHub Actions. No forzar la rama `main` ni usar `git reset --hard` para evitar sobrescribir nuevos desarrollos.

## Base de datos: medidas de reversión **solo si se solicitan**
Se modificó únicamente la condición `active` del personal, el rol/área de los cuatro miembros y el trigger de estado en `tasks`. Se agregó la columna nullable `tasks.cancelled_at`. **No se borraron tickets, actividades ni empleados**. No borrar `cancelled_at` en rollback; dejarla en la DB es seguro.

Los nombres que antes de este despliegue estaban activos: Javier Jimenez, Daniel Hernandez, Enrique Gonzalez, Hernan Reyes, Dulce Flores, Manuel Cervantes, Raul Mariano, Rodolfo Martinez y Saul Gonzalez.

Si se quiere volver a activar la selección histórica:

```sql
update public.personnel set active=true,updated_at=now()
where name in (
 'Javier Jimenez','Daniel Hernandez','Enrique Gonzalez','Hernan Reyes',
 'Dulce Flores','Manuel Cervantes','Raul Mariano','Rodolfo Martinez','Saul Gonzalez'
);
update public.personnel set role='Proyectos', area='Proyectos',updated_at=now()
where name='Enrique Gonzalez';
update public.personnel set role='Gerente Operativo',area='Operaciones',updated_at=now()
where name='Javier Jimenez';
```

**Atención:** las configuraciones exactas anteriores de `operational_areas` no se exportaron antes del ajuste; validarlas con el catálogo de referencia o una copia de la base antes de restaurarlas. No asumir que roles y áreas se pueden reconstruir perfectamente desde GitHub. Para una restauración exacta de datos, usar los respaldos oficiales de Supabase si están disponibles.

La lógica anterior del trigger de actividad trataba cualquier estado del grupo `CERRADA` como fecha de cierre `completed_at`. Si se regresa al código anterior y se necesita recuperar esta lógica, restaurar el cuerpo anterior de `public.sync_activity_operational_state()` consultando la migración `20261005073000_actual_resolution_and_activity_evidence.sql` en la rama de respaldo. Preferible mantener la separación correcta de cancelaciones.

## KPI y evaluaciones del piloto
Los reportes diarios, incidencias y evaluaciones personales del piloto se almacenan **solo en localStorage del navegador** bajo `sudmar-operations-pilot-v1`. No se sincronizan con Supabase, ni con otro navegador, ni identifican al usuario con autenticación. Conservar/exportar ese almacenamiento antes de limpiar caché o datos del sitio. La versión anterior sencillamente ignora estos registros: no es necesario eliminarlos para hacer rollback.

## Restricciones pendientes
Antes de introducir técnicos reales: autenticación, autorizaciones por rol, datos personales protegidos, bitácora de auditoría, fuentes comprobables de asistencia, persistencia multiusuario y política de privacidad para evaluaciones 360°. No utilizar resultados del piloto como base de medidas disciplinarias.
