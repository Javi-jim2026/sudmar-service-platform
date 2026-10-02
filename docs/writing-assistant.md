# Asistente de redacción SUDMAR

La interfaz y la Edge Function `sudmar-text-assistant` están preparadas para:

- Corregir ortografía, acentos, puntuación y errores de escritura.
- Mejorar claridad sin agregar hechos.
- Convertir el texto a una redacción técnica profesional sin cambiar datos técnicos.
- Proponer títulos cortos para tickets.

## Activación

La clave de OpenAI **no debe** guardarse en GitHub ni en el JavaScript público.

En Supabase, configura el secreto de Edge Functions:

- `OPENAI_API_KEY`: clave del proyecto de OpenAI.
- `OPENAI_MODEL` (opcional): por defecto se usa `gpt-5.6-luna`.

La Edge Function usa la Responses API y devuelve únicamente la propuesta. Los términos técnicos detectados (modelo, serie, valores eléctricos y códigos) se envían como protegidos y la función rechaza la propuesta si alguno cambia.

## Seguridad actual

La plataforma todavía no usa Supabase Auth, por lo que la función se despliega temporalmente sin verificación JWT. Restringe el origen a GitHub Pages, limita el tamaño de texto y aplica una cuota en memoria por IP. Cuando se active autenticación de usuarios, cambiar `verify_jwt` a `true` y restringir el acceso por usuario/rol.
