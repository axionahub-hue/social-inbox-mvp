# Arquitectura

## Objetivo

Mantener un MVP simple sin crear deuda estructural. La app puede operar en modo demo, pero la frontera con Meta y Supabase ya existe.

## Componentes

- `src/app/page.tsx`: inbox responsive y acciones de agente.
- `src/lib/types.ts`: contrato de dominio compartido.
- `src/lib/demo-data.ts`: datos locales para validar experiencia sin permisos Meta.
- `src/lib/meta.ts`: cliente de acciones y verificacion de webhooks.
- `src/lib/supabase.ts`: clientes Supabase browser/server.
- `scripts/check-supabase-config.mjs`: verificacion local de variables y alcance REST/Auth de Supabase.
- `src/app/api/inbox/action/route.ts`: entrada unica para acciones de moderacion/respuesta.
- `src/app/api/meta/webhook/route.ts`: callback para webhooks Meta.
- `src/app/api/meta/oauth/start/route.ts`: inicio OAuth Meta con sesion Supabase validada.
- `src/app/api/meta/oauth/callback/route.ts`: callback OAuth Meta con `state` firmado.
- `supabase/schema.sql`: modelo relacional inicial.

## Flujo de datos previsto

1. Usuario conecta Facebook/Instagram por OAuth.
2. La app guarda cuentas, scopes y tokens cifrados.
3. Meta envia webhooks a `/api/meta/webhook`.
4. El webhook se guarda crudo en `webhook_events`.
5. Un procesador normaliza eventos a `inbox_items` e `inbox_messages`.
6. El agente responde desde la UI.
7. `/api/inbox/action` ejecuta la accion en Meta y registra `action_log`.
8. Mientras Meta real no este conectado, `/api/inbox/action` persiste el estado interno en Supabase para validar el flujo operativo completo.

## OAuth Meta

- El inicio OAuth se ejecuta en `/api/meta/oauth/start` y requiere sesion Supabase por bearer token.
- El endpoint valida que el usuario sea propietario del workspace antes de construir la URL de Meta.
- El parametro `state` se firma server-side y expira a los 10 minutos.
- El callback valida `state` y `code`, pero todavia no intercambia tokens.
- No se guardan tokens Meta hasta implementar cifrado server-side.

## Carga de inbox

- Sin sesion Supabase, la app usa `src/lib/demo-data.ts`.
- Con sesion Supabase, la app carga `connected_accounts`, `contacts`, `inbox_items` e `inbox_messages`.
- Si el workspace autenticado no tiene cuentas conectadas, la app siembra las cuentas/conversaciones demo en Supabase para validar experiencia real sin permisos Meta.
- La UI muestra `Inbox: Supabase` o `Inbox: demo local` para hacer visible el origen de datos.
- `ChannelConnection.id` representa el ID real de `connected_accounts` cuando hay sesion Supabase; en modo demo representa el ID local del fixture.

## Auth y workspace

- Si `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` existen, la UI activa login por email OTP de Supabase.
- Si no hay credenciales, la app mantiene modo demo local.
- Al iniciar sesion, la app busca o crea un workspace `Personal` para `auth.uid()`.
- `workspaces.owner_user_id` define el propietario del workspace.
- `workspaces_owner_user_id_unique_idx` impide mas de un workspace personal por usuario.
- `workspace_members` deja preparado el modelo para sumar usuarios despues, aunque el MVP opera como workspace personal.
- `user_preferences` guarda preferencias por usuario/workspace, empezando por `visible_account_ids`.
- RLS esta habilitado para tablas de aplicacion usando acceso por propietario de workspace.

## Filtros de inbox

- `InboxItem.accountId` es la referencia estable a la cuenta conectada.
- `InboxItem.accountName` es solo texto de presentacion.
- El inbox combina busqueda textual, filtro por red y filtro por cuentas visibles.
- La preferencia de cuentas visibles se guarda en `localStorage` en modo demo.
- Con Supabase autenticado, la preferencia se guarda por usuario/workspace en `user_preferences`.

## Respuestas rapidas

- `QuickReply` define titulo, categoria, cuerpo y tags.
- En modo demo, las respuestas rapidas se editan en cliente y se guardan en `localStorage`.
- Con Supabase autenticado, las respuestas rapidas se cargan y guardan en `quick_replies`.
- El estado inicial sale de `src/lib/demo-data.ts`.
- Si el workspace no tiene respuestas, la app siembra las respuestas demo iniciales en Supabase.
- La UI permite crear, editar, eliminar e insertar una respuesta en el composer.

## Reglas de infraestructura

- Los tokens de Meta no deben exponerse al cliente.
- Los tokens de Meta no deben guardarse sin cifrado server-side.
- Las acciones contra Meta siempre pasan por API server-side.
- Los webhooks se validan con `META_WEBHOOK_VERIFY_TOKEN` y `META_APP_SECRET`.
- Supabase debe usar RLS antes de tener mas de un usuario real.
- El modo demo no debe mezclarse con datos reales: se identifica con `provider_mode = demo`.
- La conexion real de Supabase debe validarse con `npm run check:supabase` antes de probar login o persistencia autenticada.
