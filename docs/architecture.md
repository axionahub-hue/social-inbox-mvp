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
7. `/api/inbox/action` valida la accion. Si es interna, persiste directo; si toca Meta real, la guarda en `action_queue`, aplica estado optimista y responde rapido al frontend.
8. El procesador de cola ejecuta Meta en segundo plano, registra `action_log` y actualiza `inbox_items`/`inbox_messages` segun exito o fallo.
9. Mientras Meta real no este conectado, `/api/inbox/action` mantiene el flujo demo/sincrono para validar la experiencia.

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
- El footer del composer incluye acciones fijas de archivar/desarchivar e insertar emojis sin mover la caja de respuesta.
- En comentarios, el composer exige elegir modo de respuesta: `public_comment` para responder sobre el comentario y notificar/etiquetar al autor cuando Meta lo permita, o `private_message` para responder por Messenger/DM. La decision viaja a `/api/inbox/action` como `replyMode`.
- En Facebook, una respuesta publica sobre comentario intenta ademas enviar una copia por `private_replies`; el ID del reply publico devuelto por Meta se guarda en `inbox_messages.provider_message_id` para permitir borrado posterior.
- Para abrir la publicacion original, la UI usa `provider_permalink_url` cuando existe. Esto es critico para comentarios anidados, porque la URL derivada desde `provider_post_id` solo abre el post/reel y no necesariamente el hilo exacto. Si la columna aun no existe en un entorno, la UI cae a la URL derivada desde `provider_post_id`.
- Para hilos anidados, `inbox_items` guarda `parent_comment_id`, `parent_comment_author` y `parent_comment_text` cuando Meta entrega o permite resolver el comentario padre. La vista interna muestra `Comentario padre`, `Respuesta recibida` y `Respuesta publicada` para entender el hilo sin abrir Facebook o Instagram. Si una actualizacion posterior llega sin esos datos, el persistidor no pisa el contexto ya guardado.
- Las acciones reales contra Meta usan cola persistente. Mientras estan en proceso, `inbox_items.action_state = pending` y las respuestas agente quedan con `inbox_messages.delivery_status = pending`. Si Meta confirma, se limpia el estado pendiente. Si Meta rechaza, la conversacion vuelve a `Bandeja` como no leida (`status = new`, `unread_count = 1`), queda con `action_state = failed`, muestra warning y conserva el error en `action_error`.

## Sincronizacion de comentarios Facebook

- `POST /api/meta/sync/comments` usa page tokens cifrados guardados en `connected_accounts`.
- El endpoint descifra tokens solo server-side.
- Solo procesa cuentas con `pages_read_engagement` y `pages_read_user_content` concedidos.
- Lee las ultimas publicaciones publicadas, consulta cada post individual para obtener `message` completo y luego consulta el edge `/comments` de cada post con `order=reverse_chronological` para priorizar comentarios nuevos.
- Por defecto solo importa comentarios con `created_time` dentro de las ultimas 72 horas. No se importa historico salvo que se cree un flujo separado para eso.
- Normaliza cada comentario a `contacts`, `inbox_items` e `inbox_messages`.
- Guarda `provider_post_id` y `provider_comment_id` para que las acciones server-side puedan apuntar al recurso externo correcto.
- `provider_comment_id` debe ser unico por `workspace_id + account_id`. Webhook y polling pueden entregar el mismo comentario en paralelo; el persistidor limpia duplicados y la base usa `inbox_items_unique_provider_comment_idx` como garantia final.
- Guarda `inbox_items.ingest_source` para distinguir si el item entro por `webhook`, `polling_fast`, `polling_full`, `ads_manual` o quedo como `unknown`.
- Si Meta no devuelve `from` en un comentario, el contacto queda como `Autor pendiente` en vez de inventar identidad o pisar un autor real ya guardado.
- Si el autor del comentario coincide con el `provider_account_id` de la cuenta conectada, el persistidor lo ignora: es una respuesta publicada por la propia Page/IG y no debe volver a Bandeja como no leida.
- La UI se suscribe a Supabase Realtime sobre `inbox_items` para refrescar la bandeja cuando entra o cambia una conversacion.
- La UI ejecuta auto-sincronizacion cada 5 segundos mientras la app esta abierta y visible como respaldo cuando Meta no entregue un webhook. Esa llamada usa `mode = fast`, procesa cuentas en paralelo y lee menos publicaciones/comentarios para priorizar latencia.
- Para cuidar la cuota Free de Supabase, la UI no recarga la bandeja desde Supabase si una auto-sincronizacion no inserto ni actualizo comentarios. La carga de inbox queda limitada a los ultimos 120 items y Realtime agrupa refrescos con debounce.
- El boton manual `Sincronizar comentarios FB` usa `mode = full` para una lectura mas profunda cuando se necesita auditar historico.
- Los webhooks reales son el mecanismo profesional para eventos instantaneos 24/7; requieren URL HTTPS publica, suscripcion del objeto Page a los campos `feed` y `messages`, y suscripcion de cada Page a la app. El OAuth intenta suscribir cada Page automaticamente cuando recibe page token. El endpoint guarda eventos crudos, normaliza cambios `Page/feed` de comentarios usando el mismo persistidor de inbox que la sincronizacion manual y normaliza `entry.messaging[]` como conversaciones Messenger.
- `/api/meta/webhook/diagnostics` compara configuracion real de Meta (`/{app-id}/subscriptions`, `/{page-id}/subscribed_apps`) contra ultimos eventos recibidos para distinguir endpoint sano de falta de entrega real por Meta.

## Messenger

- Los mensajes entrantes de Messenger llegan por webhook Page `messages`.
- Cada evento `entry.messaging[]` se deduplica por `message.mid` y se guarda como `inbox_items.source = messenger`.
- El webhook intenta resolver el nombre real de Messenger consultando `/{page-id}/conversations?user_id={PSID}&fields=id,participants` con el Page token. Si Meta no devuelve participante, el contacto queda identificado por el Page-scoped sender id (`facebook:PSID`) como fallback.
- Si un mensaje privado llega sin `text` pero con `attachments`, el persistidor guarda una etiqueta operativa legible: `Audio recibido`, `Imagen recibida`, `GIF recibido`, `Video recibido`, `Archivo recibido` o `Sticker recibido`.
- En Messenger, el pulgar arriba rapido puede llegar como dos attachments (`image` + `sticker`) con `sticker_id = 369239263222822`; el webhook prioriza `sticker` y lo muestra como `Pulgar arriba recibido`.
- Si un flujo posterior trae menos datos de identidad que un contacto ya enriquecido, no puede degradar el nombre/handle existente.
- Las respuestas desde un item Messenger usan Send API `me/messages` con `recipient.id = PSID`. Esto es distinto a una private reply de comentario, que usa `recipient.comment_id`.

## Instagram comentarios y DM

- Las cuentas Instagram se guardan como `connected_accounts.network = instagram` usando el Instagram Business Account ID asociado a una Page.
- `POST /api/meta/sync/instagram-comments` lee media reciente y comentarios de cada cuenta Instagram elegible.
- Solo procesa cuentas con `instagram_basic` e `instagram_manage_comments`.
- Los comentarios Instagram se normalizan como `network = instagram` y `source = post_comment`; asi reutilizan bandeja, filtros, responder, ocultar/mostrar y eliminar sin cambiar el enum de Supabase.
- En webhooks Instagram, el evento puede traer solo `media_id` y texto de comentario. Antes de persistir, el backend consulta el media (`caption`, `permalink`) con el Page token para que la vista muestre el texto completo de la publicacion.
- La sincronizacion intenta leer replies de comentarios Instagram via `/{ig-comment-id}/replies`; cuando Meta lo permite, esas replies se guardan con referencia, autor y texto del comentario padre para mostrarlas como hilos anidados.
- Si una actualizacion posterior de Instagram llega sin `caption` o `permalink`, el persistidor no pisa el titulo/permalink ya enriquecido del item.
- Los comentarios Instagram escritos por la propia cuenta conectada se descartan durante la ingesta para evitar duplicar respuestas agente como items entrantes. La comparacion usa tanto el Instagram Business Account ID como el handle (`instagram:{username}`), porque Meta puede devolver replies con username en vez de ID numerico.
- La UI ejecuta auto-sincronizacion de comentarios Instagram cada 10 segundos mientras la app esta abierta, visible y los permisos estan concedidos.
- Las respuestas publicas Instagram usan el edge `/{ig-comment-id}/replies`.
- Ocultar/mostrar Instagram usa `/{ig-comment-id}` con `hide=true|false`.
- Eliminar comentarios Instagram usa `DELETE /{ig-comment-id}`.
- Like/unlike en comentarios Instagram usa `/{ig-user-id}/likes` con `comment_id`.
- A diferencia de Facebook, una respuesta publica Instagram no intenta enviar copia privada automatica. La respuesta por DM queda separada y depende de que Meta habilite la capacidad de Instagram Messaging para la app.
- El webhook `/api/meta/webhook` queda preparado para `object = instagram`: normaliza cambios `comments` y eventos `entry.messaging[]` como `instagram_dm`.
- Los DM Instagram entrantes se guardan como `inbox_items.source = instagram_dm`; las respuestas intentan usar el Send API de Instagram con `recipient.id`.
- Las respuestas de Instagram DM usan Send API `me/messages` con Page token y `recipient.id = IGSID` recibido en el webhook.
- Al recibir un DM Instagram, el webhook intenta enriquecer el contacto con User Profile API usando el IGSID para guardar nombre y username cuando Meta lo permite.
- Los DM Instagram con texto y emojis se guardan como texto normal. Los attachments sin texto se etiquetan igual que Messenger; en prueba real, audio llego como `audio`, foto como `image`, sticker de corazon como texto `❤` y GIF como `image` con URL `.gif`.
- Los contactos Instagram de comentarios y DMs siguen la regla de no degradacion: una carga posterior con fallback (`Autor Instagram` o `Instagram ######`) no reemplaza un nombre/handle real ya guardado.
- Para que DM Instagram funcione en tiempo real hay que activar Webhooks `Instagram` con el campo `messages` en Meta Developers y reautorizar con `instagram_manage_messages`.
- Si Meta devuelve `(#3) Application does not have the capability`, la app tiene el scope pero falta habilitar acceso avanzado/capacidad de Instagram Messaging en Meta.
- Para reacciones/likes en comentarios Instagram se agrega `instagram_manage_engagement` como permiso objetivo.

## Comentarios de Ads

- Los comentarios de Ads no se tratan como comentarios organicos de Page.
- La base Ads usa Marketing API y requiere `ads_read` mas token largo de usuario Meta guardado en `meta_connections`.
- `/api/meta/ads/diagnostics` valida si existe schema/token/scope y lista `/me/adaccounts`.
- `/api/meta/sync/ad-comments` lista anuncios recientes, lee el creative y usa `effective_object_story_id` u `object_story_id` para encontrar el post/story asociado al anuncio.
- La sincronizacion filtra solo Pages conectadas al workspace y usa el page token cifrado para leer comentarios.
- Si un comentario de Ads llega sin `from`, la sincronizacion intenta una segunda lectura directa por `comment_id` antes de persistirlo. En pruebas reales, algunos comentarios de Ads devuelven `200 OK` pero sin campo `from` tanto por `/POST_ID/comments` como por `/{comment_id}`; esos casos quedan como `Autor pendiente` para no afirmar una identidad falsa.
- Caso validado: el comentario Ads `Info por fa` de Academia Expertos de la Musica entro por `ads_auto`; no hubo webhook crudo para ese `comment_id`. Graph v18-v25, Page token guardado y Page token fresco devuelven `id`, `message`, `created_time`, `is_hidden` y `permalink_url`, pero no `from`. La Page tiene tareas `MODERATE`, `MANAGE`, `MESSAGING`, `ADVERTISE` y scopes `pages_read_user_content`/`pages_read_engagement` concedidos. El siguiente bloqueo probable queda fuera del codigo: app en modo no publicado o permisos sin Full/Advanced Access para datos de usuarios reales.
- Cuando Meta empiece a devolver `from`, `persistFacebookComment` actualiza `contact_id` en items existentes para backfillear autores pendientes sin recrear conversaciones.
- Si un comentario entra primero como organico con autor real y luego Ads lo reclasifica como `ad_comment` sin `from`, el persistidor conserva el `contact_id` real existente y solo actualiza la clasificacion/metadatos del anuncio.
- Para evitar que el usuario vea un comentario como organico y luego cambie a Ads, la UI retiene comentarios recientes `post_comment` durante una ventana corta de clasificacion cuando `ads_read` esta disponible. En esa ventana dispara una sincronizacion Ads inmediata y no cuenta ni muestra el item en Bandeja hasta que se defina o venza la espera.
- La pasada manual de Ads esta acotada para no bloquear la UI: no pagina todo el historico de anuncios, deduplica por post/story y limita cuantos posts de anuncio revisa por llamada.
- La UI ejecuta una pasada automatica de Ads cada 30 segundos mientras la app esta abierta, visible y existen permisos `ads_read` + `pages_read_engagement`. Esa pasada usa `mode = fast` para no barrer volumen innecesario en cada ciclo. El boton manual usa `mode = full` como respaldo de diagnostico, no como requisito operativo.
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
- Las acciones contra Meta no deben bloquear la UI. Deben pasar por `action_queue`, conservar snapshot anterior y resolver exito/fallo de forma persistente.
- `/api/inbox/action` recibe el bearer token Supabase desde la UI, valida que el item pertenezca al usuario y solo entonces descifra el page token para ejecutar acciones reales.
- Las acciones reales cableadas en este corte aplican a comentarios Facebook: respuesta publica, private reply, like/unlike y ocultar/mostrar. Bloquear usuario y reacciones diferenciadas quedan como pasos separados.
- Los webhooks se validan con `META_WEBHOOK_VERIFY_TOKEN` y `META_APP_SECRET`.
- Supabase debe usar RLS antes de tener mas de un usuario real.
- El modo demo no debe mezclarse con datos reales: se identifica con `provider_mode = demo`.
- La conexion real de Supabase debe validarse con `npm run check:supabase` antes de probar login o persistencia autenticada.
