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
  "externalId": "provider-comment-or-post-id",
  "action": "reply",
  "message": "Texto de respuesta",
  "replyMode": "public_comment",
  "recipientExternalId": "provider-user-id"
}
```

`itemId` es el UUID interno de `inbox_items`. `externalId` debe ser el ID real del comentario/post/mensaje del proveedor cuando exista; la UI usa `provider_comment_id` y cae a `provider_post_id` o al ID interno solo como fallback demo.

Para `reply` sobre comentarios, `replyMode` define el canal:

- `public_comment`: responde sobre el comentario original. La integracion Meta debe usar el edge de respuesta publica del comentario y conservar `recipientExternalId` para etiquetado/notificacion del autor cuando el proveedor lo permita.
- `private_message`: responde por canal privado. En Facebook debe cablearse a Messenger/private replies; en Instagram debe cablearse a DM/private replies segun permisos disponibles.

Acciones soportadas:

- `reply`
- `delete_message`
- `like`
- `unlike`
- `hide`
- `unhide`
- `block`
- `unblock`
- `archive`
- `unarchive`
- `mark_read`
- `mark_unread`

Respuesta demo:

```json
{
  "mode": "demo",
  "ok": true,
  "message": "Accion reply registrada en modo demo."
}
```

Si Supabase esta configurado y `itemId` corresponde a una fila real de `inbox_items`, el endpoint valida sesion Supabase por `Authorization: Bearer SUPABASE_ACCESS_TOKEN` antes de persistir o ejecutar contra Meta.

Para comentarios Facebook reales (`source = post_comment` o `ad_comment`) con `provider_comment_id` y page token cifrado, ejecuta contra Meta:

- `reply` con `replyMode = public_comment`: `/{comment-id}/comments`.
- `reply` con `replyMode = private_message`: `me/messages` con `recipient.comment_id` y `message.text`.
- Cuando `replyMode = public_comment`, despues de publicar en el comentario la app tambien intenta enviar copia del mismo texto por Messenger Send API usando `recipient.comment_id`.
- `like`: `/{comment-id}/likes`.
- `unlike`: `DELETE /{comment-id}/likes`.
- `hide`/`unhide`: actualiza `is_hidden` sobre `/{comment-id}`.

Despues de una respuesta exitosa de Meta o una accion interna exitosa, persiste:

- `reply`: inserta un mensaje agente en `inbox_messages`, guarda `provider_message_id` cuando Meta devuelve ID, marca `status = responded`, limpia `unread_count` y actualiza `preview`.
- `delete_message`: exige `provider_message_id`; intenta borrar primero en Meta y solo si Meta confirma elimina la respuesta agente local.
- `like`/`unlike`: actualiza `inbox_items.is_liked`.
- `hide`/`unhide`: actualiza `inbox_items.is_hidden`.
- `block`: actualiza `contacts.is_blocked = true`.
- `unblock`: actualiza `contacts.is_blocked = false`.
- `archive`: marca `inbox_items.status = archived` y limpia `unread_count`.
- `unarchive`: marca `inbox_items.status = open` y limpia `unread_count`.
- `mark_read`: limpia `unread_count`; mantiene `status = responded` si la conversacion ya estaba respondida, si no marca `status = open`.
- `mark_unread`: marca `inbox_items.status = new` y deja `unread_count = 1`.

Siempre registra la accion en `action_log` cuando Supabase esta configurado.

Nota: Graph acepto `message_tags` al crear replies de Page, pero lo ignoro silenciosamente y guardo el nombre como texto plano. Por eso la app no simula menciones en respuestas publicas. `block`/`unblock` todavia se persiste internamente en `contacts.is_blocked`; falta confirmar y probar el endpoint Meta correcto para bloqueo de usuarios de Page. Para Facebook la UI muestra solo `Me gusta` porque la escritura estable cableada es `/{comment-id}/likes`; las reacciones diferenciadas quedan pendientes hasta tener un endpoint Meta soportado/probado para escribir `LOVE`, `HAHA`, etc.

Nota private replies: aunque `pages_messaging` este concedido, Meta puede rechazar comentarios especificos con `(#100, subcode 1893060)` cuando no acepta ese `comment_id` como private reply. En ese caso la app no persiste respuesta privada y debe mostrar el motivo especifico.

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

Si Supabase esta configurado:

- guarda el evento crudo en `webhook_events`;
- procesa cambios `Page/feed` con `item = comment` y `verb = add|edited`;
- procesa eventos `entry.messaging[]` de Messenger como hilos privados `source = messenger`;
- busca la pagina en `connected_accounts` por `provider_account_id`;
- usa el page token cifrado para enriquecer comentario/publicacion;
- persiste el comentario en `contacts`, `inbox_items` e `inbox_messages`;
- persiste mensajes entrantes de Messenger en `contacts`, `inbox_items` e `inbox_messages`, deduplicando por `message.mid`;
- marca `webhook_events.processed_at` cuando el procesamiento termina sin errores.

### `POST /api/meta/oauth/start`

Inicia el flujo OAuth Meta desde una sesion Supabase autenticada.

Headers:

```text
Authorization: Bearer SUPABASE_ACCESS_TOKEN
```

Payload:

```json
{
  "workspaceId": "uuid-del-workspace",
  "mode": "fast"
}
```

`mode` es opcional. `fast` se usa en la auto-sincronizacion para priorizar latencia con cuentas en paralelo y menos profundidad de lectura. `full` es el valor por defecto y se usa en el boton manual para revisar mas historico.

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
- cifra page tokens antes de guardarlos;
- intenta suscribir cada pagina Facebook con page token a los webhooks Page `feed,messages`.

Redirecciones relevantes:

- `meta_oauth=accounts_saved`: guardado completado; incluye `pages`, `instagram`, `missing_page_tokens`, `webhook_subscribed_pages`, `webhook_subscription_failures` y `scopes`.
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

### `POST /api/meta/sync/comments`

Sincroniza comentarios organicos recientes de paginas Facebook conectadas.

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

Comportamiento:

- valida sesion Supabase;
- valida que el workspace pertenezca al usuario;
- selecciona cuentas Facebook reales del workspace;
- omite cuentas sin `pages_read_engagement` y `pages_read_user_content`;
- descifra page tokens solo en servidor;
- en `mode = fast`, procesa cuentas en paralelo con limites reducidos;
- consulta publicaciones recientes y luego el edge `/comments` de cada post con `order=reverse_chronological`;
- filtra comentarios por `created_time` de las ultimas 72 horas;
- guarda contactos, conversaciones y mensajes en `contacts`, `inbox_items` e `inbox_messages`.

Respuesta:

```json
{
  "ok": true,
  "message": "Sincronizacion Facebook: 3 comentario(s) de las ultimas 72h, 2 nuevo(s), 1 actualizado(s).",
  "accounts": {
    "total": 4,
    "eligible": 4,
    "skippedForPermission": 0
  },
  "comments": {
    "found": 3,
    "inserted": 2,
    "updated": 1,
    "since": "2026-07-04T12:00:00.000Z"
  },
  "accountSummaries": [
    {
      "account": "Nombre de pagina",
      "found": 3,
      "inserted": 2,
      "updated": 1
    }
  ],
  "errors": []
}
```

Si no existen `pages_read_engagement` y `pages_read_user_content`, responde controlado con `eligible = 0`.

### `POST /api/meta/webhook/diagnostics`

Diagnostica la configuracion Webhooks Meta para el workspace autenticado.

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

Comportamiento:

- valida sesion Supabase;
- consulta `/{app-id}/subscriptions` con app token para confirmar objeto `Page` y campo `feed`;
- consulta `/{page-id}/subscribed_apps` con page token por cada pagina Facebook conectada;
- devuelve los ultimos eventos `webhook_events` guardados para comparar configuracion con entregas reales.

### `POST /api/meta/ads/diagnostics`

Diagnostica si el workspace tiene base lista para Marketing API y comentarios de Ads.

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

Comportamiento:

- valida sesion Supabase;
- lee `meta_connections`, donde se guarda el user token largo cifrado de Meta;
- exige scope `ads_read`;
- consulta `/me/adaccounts` para listar cuentas publicitarias visibles;
- si falta schema, reautorizacion o permisos, responde `ready = false` con `reason`.

### `POST /api/meta/sync/ad-comments`

Sincroniza comentarios de anuncios Meta detectables por Marketing API.

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

Comportamiento:

- valida sesion Supabase;
- valida que el workspace pertenezca al usuario;
- exige token largo de usuario Meta en `meta_connections`;
- exige scope `ads_read`;
- lista cuentas publicitarias visibles con Marketing API;
- revisa una pasada rapida acotada: hasta 25 cuentas publicitarias, 8 anuncios por cuenta, 20 posts/stories de anuncio unicos y 10 comentarios por post;
- toma `effective_object_story_id` u `object_story_id` como post/story asociado al anuncio;
- filtra solo anuncios cuyo Page ID corresponde a paginas Facebook conectadas en el workspace;
- lee comentarios del post/story usando el page token cifrado;
- filtra comentarios por `created_time` de las ultimas 72 horas;
- guarda contactos, conversaciones y mensajes como `source = ad_comment`;
- marca `ingest_source = ads_manual` y guarda `provider_ad_id`.

Respuesta:

```json
{
  "ok": true,
  "message": "Sincronizacion Ads: 2 comentario(s) de las ultimas 72h, 1 nuevo(s), 1 actualizado(s).",
  "targets": {
    "found": 12,
    "matchedPages": 4
  },
  "comments": {
    "found": 2,
    "inserted": 1,
    "updated": 1,
    "since": "2026-07-04T12:00:00.000Z"
  },
  "errors": []
}
```

Limitacion: esta primera version cubre anuncios cuyo creative expone `effective_object_story_id` u `object_story_id`. Algunos formatos de anuncio pueden requerir campos adicionales de creative o lectura por Ad Creative API.
