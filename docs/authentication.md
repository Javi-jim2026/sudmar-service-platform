# Autenticación SUDMAR

## Objetivo

La aplicación debe dejar de ser accesible de forma anónima. El acceso operativo se moverá de GitHub Pages a Azure Static Web Apps con autenticación Microsoft.

## Esquema inicial

- Proveedor de identidad: Microsoft Entra ID.
- Rol de acceso interno: `sudmar`.
- Cualquier usuario sin ese rol recibe redirección a inicio de sesión.
- GitHub como proveedor de inicio de sesión queda bloqueado.
- Los archivos del sitio, incluyendo JSON de operación, quedan detrás de la misma regla de acceso cuando se sirven desde Azure Static Web Apps.
- El repositorio principal se volverá privado después de confirmar el despliegue de Azure.

## Usuarios previstos

El sistema de invitaciones de Azure Static Web Apps asignará el rol `sudmar` a cada miembro autorizado.

Catálogo inicial:
- Rodolfo Martinez
- Saul Gonzalez
- Javier Jimenez
- Dulce Flores
- Manuel Cervantes
- Raul Mariano
- Enrique Gonzalez
- Hernan Reyes
- Daniel Hernandez

No guardar contraseñas ni secretos en GitHub.

## Pasos de despliegue en Azure

1. Crear un recurso **Static Web App** en Azure.
2. Conectar el repositorio `Javi-jim2026/sudmar-service-platform`.
3. Seleccionar rama `main`.
4. Definir la ubicación de la aplicación como `prototype`.
5. No definir API todavía.
6. Confirmar el primer despliegue.
7. Entrar a **Role Management**.
8. Invitar a cada usuario autorizado usando Microsoft Entra ID y asignar el rol `sudmar`.
9. Probar acceso desde una cuenta autorizada.
10. Probar acceso desde ventana privada/no autenticada.
11. Cuando Azure esté confirmado, cambiar el repositorio GitHub a **Private** y retirar GitHub Pages.

## Fase siguiente

Cuando estén disponibles las cuentas corporativas exactas:
- agregar roles de sistema (administrador, supervisor, agente),
- relacionar la identidad autenticada con `personnel.json`,
- registrar quién crea/modifica cada ticket o tarea,
- conectar la escritura segura al Excel de OneDrive.
