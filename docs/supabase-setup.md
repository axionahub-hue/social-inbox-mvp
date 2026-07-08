# Setup Supabase

## Objetivo

Pasar de modo demo a modo autenticado sin cambiar la arquitectura de la app. Supabase se usa para Auth, workspaces, preferencias, respuestas rapidas, eventos webhook y logs de acciones.

## Estado actual

- El codigo cliente activa Supabase solo si existen `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Los endpoints server-side usan `SUPABASE_SERVICE_ROLE_KEY` para registrar webhooks y acciones.
- El modelo inicial esta en `supabase/schema.sql`.
- `inbox_items` debe estar agregado a `supabase_realtime` para que la UI refresque la bandeja en segundos cuando entra un item nuevo.
- `inbox_items.ingest_source` registra si una conversacion entro por webhook, polling rapido, sync manual u origen pendiente.
- `meta_connections` guarda el user token largo de Meta cifrado para diagnostico e integraciones Marketing API/Ads.
- `action_queue` guarda acciones reales contra Meta para liberar la UI rapido y resolver exito/fallo de forma persistente.
- El repo incluye `npm run check:supabase` para validar que `.env.local` tiene variables y que el proyecto responde por REST/Auth.
- No hay `.env.local` en el repo y no se deben comitear secretos.

## Datos necesarios

Para conectar la app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Para que Codex aplique el schema directamente:

- connection string SQL del proyecto, o
- password de base de datos y project ref para usar CLI, o
- ejecucion manual de `supabase/schema.sql` desde Supabase SQL Editor.

## Checklist operativo

1. Crear proyecto en Supabase.
2. En Supabase SQL Editor, ejecutar completo `supabase/schema.sql`.
   - Si el proyecto ya existia antes del soporte Realtime, volver a ejecutar el bloque `do $$ ... alter publication supabase_realtime add table inbox_items ... end $$;` incluido en el schema.
   - Si el proyecto ya existe y solo se necesita la cola de acciones, ejecutar `supabase/migrations/20260708_action_queue.sql`.
3. Copiar `.env.example` a `.env.local`.
4. Completar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.
5. En Supabase Auth, configurar Site URL:

```text
http://localhost:3100
```

6. Agregar Redirect URL local:

```text
http://localhost:3100/**
```

7. Ejecutar:

```bash
npm run check:supabase
npm run dev
```

8. Abrir `http://localhost:3100`, enviar magic link desde el panel `Sesion` y validar que la app indique Supabase conectado.
9. Crear, editar y eliminar una respuesta rapida con sesion activa.
10. Ocultar/mostrar una cuenta conectada y recargar para validar persistencia de preferencias.

## Correccion de duplicados en desarrollo

Si una sesion de desarrollo creo mas de un workspace `Personal` para el mismo usuario antes de aplicar el indice unico, ejecutar una sola vez:

```text
supabase/fixes/2026-07-06-dedupe-personal-workspaces.sql
```

Luego volver a ejecutar `npm run check:supabase`.

## Vercel

En Vercel se deben crear las mismas variables de entorno. Despues del primer deploy, actualizar Supabase Auth:

- Site URL: URL final de Vercel.
- Redirect URLs: URL final de Vercel con comodin `/**`.

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` nunca va al cliente.
- `.env.local` no se comitea.
- RLS debe permanecer habilitado antes de usar datos reales.
- Los tokens de Meta se guardaran cifrados en `connected_accounts.access_token_encrypted`; no deben exponerse en navegador.

## Validacion esperada

`npm run check:supabase` debe mostrar:

```text
Supabase config check
- .env.local: found
- client vars: present
- server vars: present
- https://...supabase.co/rest/v1/workspaces: OK
- https://...supabase.co/auth/v1/settings: OK
Result: Supabase config is reachable and ready for app validation.
```
