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
- `supabase/schema.sql`: modelo relacional inicial.

## Flujo de datos previsto

1. Usuario conecta Facebook/Instagram por OAuth.
2. La app guarda cuentas, scopes y tokens cifrados.
3. Meta envia webhooks a `/api/meta/webhook`.
4. El webhook se guarda crudo en `webhook_events`.
5. Un procesador normaliza eventos a `inbox_items` e `inbox_messages`.
6. El agente responde desde la UI.
7. `/api/inbox/action` ejecuta la accion en Meta y registra `action_log`.

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
- La evolucion natural es persistir esa preferencia por usuario/workspace en Supabase cuando exista autenticacion.

## Respuestas rapidas

- `QuickReply` define titulo, categoria, cuerpo y tags.
- En modo demo, las respuestas rapidas se editan en cliente y se guardan en `localStorage`.
- Con Supabase autenticado, las respuestas rapidas se cargan y guardan en `quick_replies`.
- El estado inicial sale de `src/lib/demo-data.ts`.
- Si el workspace no tiene respuestas, la app siembra las respuestas demo iniciales en Supabase.
- La UI permite crear, editar, eliminar e insertar una respuesta en el composer.

## Reglas de infraestructura

- Los tokens de Meta no deben exponerse al cliente.
- Las acciones contra Meta siempre pasan por API server-side.
- Los webhooks se validan con `META_WEBHOOK_VERIFY_TOKEN` y `META_APP_SECRET`.
- Supabase debe usar RLS antes de tener mas de un usuario real.
- El modo demo no debe mezclarse con datos reales: se identifica con `provider_mode = demo`.
- La conexion real de Supabase debe validarse con `npm run check:supabase` antes de probar login o persistencia autenticada.
