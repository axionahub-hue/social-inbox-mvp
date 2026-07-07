# API de la app

## Estado

La API esta preparada para operar en modo demo y para conectarse despues con Supabase y Meta. Los endpoints server-side son la unica via para ejecutar acciones contra Meta.

La autenticacion interna de usuario usa Supabase Auth desde el cliente con email OTP. No agrega endpoints propios por ahora.

## Endpoints

### `GET /api/health`

Devuelve estado basico de configuracion.

Respuesta:

```json
{
  "ok": true,
  "services": {
    "supabase": "demo",
    "meta": "demo"
  }
}
```

### `POST /api/inbox/action`

Registra o ejecuta una accion del agente sobre un item del inbox.

Payload:

```json
{
  "itemId": "item-1001",
  "externalId": "item-1001",
  "action": "reply",
  "message": "Texto de respuesta"
}
```

Acciones soportadas:

- `reply`
- `like`
- `unlike`
- `hide`
- `unhide`
- `block`
- `archive`
- `unarchive`

Respuesta demo:

```json
{
  "mode": "demo",
  "ok": true,
  "message": "Accion reply registrada en modo demo."
}
```

Si Supabase esta configurado y `itemId` corresponde a una fila real de `inbox_items`, tambien persiste:

- `reply`: inserta un mensaje agente en `inbox_messages`, marca `status = responded`, limpia `unread_count` y actualiza `preview`.
- `like`/`unlike`: actualiza `inbox_items.is_liked`.
- `hide`/`unhide`: actualiza `inbox_items.is_hidden`.
- `block`: actualiza `contacts.is_blocked`.
- `archive`: marca `inbox_items.status = archived` y limpia `unread_count`.
- `unarchive`: marca `inbox_items.status = open` y limpia `unread_count`.

Siempre registra la accion en `action_log` cuando Supabase esta configurado.

### `GET /api/meta/webhook`

Endpoint de verificacion de webhook Meta.

Usa:

- `hub.mode`
- `hub.verify_token`
- `hub.challenge`

Responde el challenge si `hub.verify_token` coincide con `META_WEBHOOK_VERIFY_TOKEN`.

### `POST /api/meta/webhook`

Recibe eventos de Meta.

Validacion:

- `x-hub-signature-256`
- `META_APP_SECRET`

Si Supabase esta configurado, guarda el evento crudo en `webhook_events`.

### `POST /api/meta/oauth/start`

Inicia el flujo OAuth Meta desde una sesion Supabase autenticada.

Headers:

```text
Authorization: Bearer SUPABASE_ACCESS_TOKEN
```

Payload:

```json
{
  "workspaceId": "uuid-del-workspace"
}
```

Respuesta:

```json
{
  "ok": true,
  "redirectUrl": "https://www.facebook.com/...",
  "callbackUrl": "http://localhost:3100/api/meta/oauth/callback",
  "scopes": ["pages_show_list"]
}
```

`scopes` sale de `META_OAUTH_SCOPES` si esta configurado. Si no existe, usa `pages_show_list` para evitar que la prueba local falle por permisos avanzados todavia no habilitados.

Si `META_LOGIN_CONFIG_ID` esta configurado, la URL OAuth incluye `config_id`, `override_default_response_type=true` y `auth_type=rerequest` para pedir permisos mediante Facebook Login for Business.

Si faltan `META_APP_ID` o `META_APP_SECRET`, responde `400` con las variables requeridas.

### `GET /api/meta/oauth/callback`

Recibe el retorno OAuth de Meta.

Comportamiento:

- valida `state` firmado;
- valida que exista `code`;
- valida que el workspace pertenezca al usuario del `state`;
- intercambia el `code` por access token;
- pide token largo;
- lee permisos concedidos y paginas disponibles;
- si existe `business_management`, consulta tambien paginas de negocios via `owned_pages` y `client_pages`;
- guarda paginas Facebook y cuentas Instagram profesionales vinculadas en `connected_accounts`;
- cifra page tokens antes de guardarlos.

Redirecciones relevantes:

- `meta_oauth=accounts_saved`: guardado completado; incluye `pages`, `instagram`, `missing_page_tokens` y `scopes`.
- `page_names`: cuando `accounts_saved`, lista hasta 10 nombres de paginas devueltas por Meta para diagnostico visual.
- `meta_oauth=token_exchange_error`: fallo el intercambio, lectura de cuentas o guardado.
- `meta_oauth=supabase_missing`: falta service role.
- `meta_oauth=workspace_not_found`: el workspace no corresponde al usuario del `state`.

## Reglas

- Las credenciales Supabase anon pueden estar en el cliente; la service role nunca debe exponerse.
- No llamar a Meta desde componentes cliente.
- No enviar tokens de Meta al navegador.
- No guardar tokens Meta sin cifrado server-side.
- No asumir que un evento webhook ya esta normalizado.
- Guardar eventos crudos antes de procesarlos para poder depurar.

### `DELETE /api/meta/accounts/[accountId]`

Desconecta una cuenta del workspace autenticado.

Headers:

```text
Authorization: Bearer SUPABASE_ACCESS_TOKEN
```

Respuesta:

```json
{
  "ok": true,
  "message": "Cuenta desconectada: Nombre."
}
```

Valida que la cuenta pertenezca a un workspace del usuario actual antes de eliminarla.
