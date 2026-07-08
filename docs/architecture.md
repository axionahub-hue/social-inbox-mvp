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
- `src/app/api/meta/accounts/[accountId]/route.ts`: desconexion de cuentas conectadas del workspace.
- `src/app/api/meta/sync/comments/route.ts`: sincronizacion manual de comentarios organicos de Facebook.
- `src/app/api/meta/sync/ad-comments/route.ts`: sincronizacion manual de comentarios de anuncios Meta via Marketing API.
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
- Los scopes OAuth son configurables con `META_OAUTH_SCOPES`; por defecto solo se pide `pages_show_list` para validar el flujo local.
- Si `META_LOGIN_CONFIG_ID` existe, OAuth incluye `config_id` y `override_default_response_type=true` para usar Facebook Login for Business.
- El callback valida `state` y `code`, intercambia el codigo por token, pide token largo, lee permisos concedidos y consulta paginas disponibles.
- El token largo de usuario Meta se guarda cifrado en `meta_connections` para integraciones server-side como Marketing API/Ads.
- La consulta de paginas usa `/me/accounts`; si el token tiene `business_management`, tambien consulta negocios del usuario y sus `owned_pages`/`client_pages`.
- Las paginas Facebook y cuentas Instagram profesionales vinculadas se guardan en `connected_accounts`.
- Los page tokens se cifran server-side con AES-256-GCM antes de persistirlos.
- Cuando una pagina Facebook devuelve page token, el callback intenta suscribir la app a los webhooks Page `feed,messages` mediante `/{page-id}/subscribed_apps`.
- `META_TOKEN_ENCRYPTION_KEY` permite usar una clave dedicada; si falta, desarrollo local cae a `META_APP_SECRET`.

## Carga de inbox

- Sin sesion Supabase, la app usa `src/lib/demo-data.ts`.
- Con sesion Supabase, la app carga `connected_accounts`, `contacts`, `inbox_items` e `inbox_messages`.
- Si el workspace autenticado no tiene cuentas conectadas, la app siembra las cuentas/conversaciones demo en Supabase para validar experiencia real sin permisos Meta.
- La UI muestra `Inbox: Supabase` o `Inbox: demo local` para hacer visible el origen de datos.
- `ChannelConnection.id` representa el ID real de `connected_accounts` cuando hay sesion Supabase; en modo demo representa el ID local del fixture.
- Las cuentas con `access_token_encrypted` se muestran como reales; las cuentas sin token cifrado quedan marcadas como demo.
- Las cuentas descubiertas por Meta sin token cifrado quedan como `needs_review`; los fixtures locales quedan como `demo`.
- El usuario puede desconectar cuentas no deseadas del workspace; la eliminacion borra la fila de `connected_accounts` y sus inbox relacionados por cascada.
- Cada item del inbox muestra metadatos operativos de plataforma, cuenta conectada y tipo de origen para evitar ambiguedad cuando haya Facebook, Instagram y futuras redes.
- La seleccion por checkbox opera sobre los items visibles y reutiliza `/api/inbox/action` para marcar leido/no leido, archivar y desarchivar.
- En desktop, el shell opera como tres paneles de altura fija: cuentas con scroll propio, bandeja con scroll propio y conversacion con footer fijo para composer/respuestas/acciones.
- La columna de cuentas muestra nombres completos, ojo global, ojo por cuenta, menu de cuenta y boton fijo para anadir cuenta.
- En mobile, el panel de cuentas/configuracion se pliega arriba; la lista de inbox ocupa la pantalla principal y al elegir un item se muestra el panel de conversacion con boton `Volver a bandeja`.
- Las vistas operativas son `Bandeja`, `Respondidos` y `Archivados`. `Bandeja` excluye `responded` y `archived`; al responder, el item pasa automaticamente a `Respondidos`.
- El panel de conversacion separa contexto, mensaje y composer: el contexto muestra el texto completo de la publicacion; las acciones de reaccion/ocultar viven junto al mensaje recibido; bloquear vive en la cabecera del autor; archivar queda en el footer del composer.
- En comentarios, el composer exige elegir modo de respuesta: `public_comment` para responder sobre el comentario y notificar/etiquetar al autor cuando Meta lo permita, o `private_message` para responder por Messenger/DM. La decision viaja a `/api/inbox/action` como `replyMode`.
- En Facebook, una respuesta publica sobre comentario intenta ademas enviar una copia por `private_replies`; el ID del reply publico devuelto por Meta se guarda en `inbox_messages.provider_message_id` para permitir borrado posterior.
- Para abrir la publicacion original, la UI usa `originalUrl` si existe y, en Facebook, deriva una URL desde `provider_post_id`. El permalink exacto de Meta queda como mejora de datos persistidos cuando se agregue una columna dedicada.

## Sincronizacion de comentarios Facebook

- `POST /api/meta/sync/comments` usa page tokens cifrados guardados en `connected_accounts`.
- El endpoint descifra tokens solo server-side.
- Solo procesa cuentas con `pages_read_engagement` y `pages_read_user_content` concedidos.
- Lee las ultimas publicaciones publicadas, consulta cada post individual para obtener `message` completo y luego consulta el edge `/comments` de cada post con `order=reverse_chronological` para priorizar comentarios nuevos.
- Por defecto solo importa comentarios con `created_time` dentro de las ultimas 72 horas. No se importa historico salvo que se cree un flujo separado para eso.
- Normaliza cada comentario a `contacts`, `inbox_items` e `inbox_messages`.
- Guarda `provider_post_id` y `provider_comment_id` para que las acciones server-side puedan apuntar al recurso externo correcto.
- Guarda `inbox_items.ingest_source` para distinguir si el item entro por `webhook`, `polling_fast`, `polling_full`, `ads_manual` o quedo como `unknown`.
- Si Meta no devuelve `from` en un comentario, el contacto queda como `Autor no disponible` en vez de inventar identidad.
- La UI se suscribe a Supabase Realtime sobre `inbox_items` para refrescar la bandeja cuando entra o cambia una conversacion.
- La UI ejecuta auto-sincronizacion cada 5 segundos mientras la app esta abierta como respaldo cuando Meta no entregue un webhook. Esa llamada usa `mode = fast`, procesa cuentas en paralelo y lee menos publicaciones/comentarios para priorizar latencia.
- El boton manual `Sincronizar comentarios FB` usa `mode = full` para una lectura mas profunda cuando se necesita auditar historico.
- Los webhooks reales son el mecanismo profesional para eventos instantaneos 24/7; requieren URL HTTPS publica, suscripcion del objeto Page a los campos `feed` y `messages`, y suscripcion de cada Page a la app. El OAuth intenta suscribir cada Page automaticamente cuando recibe page token. El endpoint guarda eventos crudos, normaliza cambios `Page/feed` de comentarios usando el mismo persistidor de inbox que la sincronizacion manual y normaliza `entry.messaging[]` como conversaciones Messenger.
- `/api/meta/webhook/diagnostics` compara configuracion real de Meta (`/{app-id}/subscriptions`, `/{page-id}/subscribed_apps`) contra ultimos eventos recibidos para distinguir endpoint sano de falta de entrega real por Meta.

## Messenger

- Los mensajes entrantes de Messenger llegan por webhook Page `messages`.
- Cada evento `entry.messaging[]` se deduplica por `message.mid` y se guarda como `inbox_items.source = messenger`.
- El contacto queda identificado por el Page-scoped sender id (`facebook:PSID`) cuando Meta no entrega nombre en el webhook.
- Las respuestas desde un item Messenger usan Send API `me/messages` con `recipient.id = PSID`. Esto es distinto a una private reply de comentario, que usa `recipient.comment_id`.

## Instagram comentarios y DM

- Las cuentas Instagram se guardan como `connected_accounts.network = instagram` usando el Instagram Business Account ID asociado a una Page.
- `POST /api/meta/sync/instagram-comments` lee media reciente y comentarios de cada cuenta Instagram elegible.
- Solo procesa cuentas con `instagram_basic` e `instagram_manage_comments`.
- Los comentarios Instagram se normalizan como `network = instagram` y `source = post_comment`; asi reutilizan bandeja, filtros, responder, ocultar/mostrar y eliminar sin cambiar el enum de Supabase.
- La UI ejecuta auto-sincronizacion de comentarios Instagram cada 10 segundos mientras la app esta abierta y los permisos estan concedidos.
- Las respuestas publicas Instagram usan el edge `/{ig-comment-id}/replies`.
- Ocultar/mostrar Instagram usa `/{ig-comment-id}` con `hide=true|false`.
- Eliminar comentarios Instagram usa `DELETE /{ig-comment-id}`.
- El webhook `/api/meta/webhook` queda preparado para `object = instagram`: normaliza cambios `comments` y eventos `entry.messaging[]` como `instagram_dm`.
- Los DM Instagram entrantes se guardan como `inbox_items.source = instagram_dm`; las respuestas intentan usar el Send API de Instagram con `recipient.id`.
- Para que DM Instagram funcione en tiempo real faltan activar los webhooks/tópicos Instagram correspondientes en Meta Developers y reautorizar con `instagram_manage_messages`.
- Para reacciones/likes en comentarios Instagram se agrega `instagram_manage_engagement` como permiso objetivo.

## Comentarios de Ads

- Los comentarios de Ads no se tratan como comentarios organicos de Page.
- La base Ads usa Marketing API y requiere `ads_read` mas token largo de usuario Meta guardado en `meta_connections`.
- `/api/meta/ads/diagnostics` valida si existe schema/token/scope y lista `/me/adaccounts`.
- `/api/meta/sync/ad-comments` lista anuncios recientes, lee el creative y usa `effective_object_story_id` u `object_story_id` para encontrar el post/story asociado al anuncio.
- La sincronizacion filtra solo Pages conectadas al workspace y usa el page token cifrado para leer comentarios.
- La pasada manual de Ads esta acotada para no bloquear la UI: no pagina todo el historico de anuncios, deduplica por post/story y limita cuantos posts de anuncio revisa por llamada.
- La UI ejecuta una pasada automatica de Ads cada 30 segundos mientras la app esta abierta y existen permisos `ads_read` + `pages_read_engagement`. Esa pasada usa `mode = full` y limites de pagina maximos habituales de Graph (`100`) para anuncios y comentarios. El boton manual queda como respaldo de diagnostico, no como requisito operativo.
- Por defecto solo importa comentarios con `created_time` dentro de las ultimas 72 horas. No se importa historico de Ads.
- Los comentarios importados se normalizan como `source = ad_comment`; usan `ingest_source = ads_auto` si entran por auto-sync y `ads_manual` si entran por boton manual; guardan `provider_ad_id`.
- Esta primera version puede no cubrir todos los formatos de anuncio; si un creative no expone story/post asociado, se debe ampliar la lectura de campos de creative.

## Bloqueo de autores

- En Facebook, `block` y `unblock` intentan aplicar primero en Meta con el edge Page `/{page_id}/blocked` y el Page Scoped ID del autor.
- La app solo actualiza `contacts.is_blocked` si Meta confirma la accion.
- La cabecera de conversacion muestra una accion visible `Bloquear autor` / `Desbloquear`.
- La columna de cuentas incluye el apartado `Autores bloqueados` para listar autores bloqueados y desbloquearlos sin buscar una conversacion especifica.
- El bloqueo externo de Instagram queda pendiente hasta validar el endpoint correcto por plataforma.

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
- La UI usa metadata visual por plataforma para mostrar etiqueta e icono de cada cuenta. Cuando se sumen TikTok o Google Business Profile, se debe ampliar `Network`, el enum `network` de Supabase y el mapa visual de plataformas en la misma entrega.
- La preferencia de cuentas visibles se guarda en `localStorage` en modo demo.
- Con Supabase autenticado, la preferencia se guarda por usuario/workspace en `user_preferences`.
- El panel Meta calcula capacidades disponibles desde los scopes reales guardados en las cuentas conectadas.

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
- `/api/inbox/action` recibe el bearer token Supabase desde la UI, valida que el item pertenezca al usuario y solo entonces descifra el page token para ejecutar acciones reales.
- Las acciones reales cableadas en este corte aplican a comentarios Facebook: respuesta publica, private reply, like/unlike y ocultar/mostrar. Bloquear usuario y reacciones diferenciadas quedan como pasos separados.
- Los webhooks se validan con `META_WEBHOOK_VERIFY_TOKEN` y `META_APP_SECRET`.
- Supabase debe usar RLS antes de tener mas de un usuario real.
- El modo demo no debe mezclarse con datos reales: se identifica con `provider_mode = demo`.
- La conexion real de Supabase debe validarse con `npm run check:supabase` antes de probar login o persistencia autenticada.
