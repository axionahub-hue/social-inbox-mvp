# Arquitectura

## Objetivo

Mantener un MVP simple sin crear deuda estructural. La app puede operar en modo demo, pero la frontera con Meta y Supabase ya existe.

## Componentes

- `src/app/page.tsx`: inbox responsive y acciones de agente.
- `src/lib/types.ts`: contrato de dominio compartido.
- `src/lib/demo-data.ts`: datos locales para validar experiencia sin permisos Meta.
- `src/lib/meta.ts`: cliente de acciones y verificacion de webhooks.
- `src/lib/supabase.ts`: clientes Supabase browser/server.
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

## Reglas de infraestructura

- Los tokens de Meta no deben exponerse al cliente.
- Las acciones contra Meta siempre pasan por API server-side.
- Los webhooks se validan con `META_WEBHOOK_VERIFY_TOKEN` y `META_APP_SECRET`.
- Supabase debe usar RLS antes de tener mas de un usuario real.
- El modo demo no debe mezclarse con datos reales: se identifica con `provider_mode = demo`.
