# Bitacora de programacion

## 2026-07-06

### Base inicial del MVP

- Resumen: se creo una app Next.js con inbox unificado demo, acciones de respuesta/moderacion, cliente Meta inicial, cliente Supabase y esquema SQL.
- Areas tocadas: `src/app/page.tsx`, `src/lib/*`, `src/app/api/*`, `supabase/schema.sql`, `README.md`, `docs/architecture.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, `POST /api/inbox/action`, revision responsive desktop/mobile.
- Pendiente: conectar OAuth Meta, Supabase real y normalizacion de webhooks.

### Puerto local 3100

- Resumen: se fijo el puerto local en `3100` porque `3000` esta ocupado por otro proyecto.
- Areas tocadas: `package.json`, `.env.example`, `README.md`.
- Validacion: `npm run lint`, `npm run build`, busqueda de referencias al puerto anterior.
- Pendiente: mantener este puerto sincronizado si cambia la configuracion de desarrollo.

### Plan de filtros por cuentas conectadas

- Resumen: se documento el plan para permitir mostrar/ocultar cuentas conectadas individuales ademas del filtro Facebook/Instagram.
- Areas tocadas: `docs/account-filter-plan.md`, `docs/work-directive.md`, `README.md`.
- Validacion: `npm run lint`, `npm run build`.
- Pendiente: completado en la entrada `Filtros por cuentas conectadas`.

### Directiva de documentacion viva

- Resumen: se agrego una directiva para mantener documentacion profesional aunque el alcance sea pequeno.
- Areas tocadas: `docs/documentation-directive.md`, `docs/api.md`, `docs/user-guide.md`, `docs/programming-log.md`, `docs/work-directive.md`, `README.md`.
- Validacion: `npm run lint`, `npm run build`, `git diff --check`.
- Pendiente: actualizar la bitacora en cada cambio relevante.

### Filtros por cuentas conectadas

- Resumen: se agrego `accountId` a los items de inbox, filtros por cuentas visibles/ocultas, estado vacio y persistencia local en `localStorage`.
- Areas tocadas: `src/lib/types.ts`, `src/lib/demo-data.ts`, `src/app/page.tsx`, `README.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/account-filter-plan.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, revision desktop/mobile en `http://localhost:3100`, prueba de ocultar/mostrar cuenta conectada.
- Pendiente: persistir preferencias por usuario/workspace cuando exista autenticacion y Supabase real.

### CRUD local de respuestas rapidas

- Resumen: se agrego administracion local de respuestas rapidas con crear, editar, eliminar, insertar en composer y persistencia en `localStorage`.
- Areas tocadas: `src/app/page.tsx`, `README.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, revision desktop en `http://localhost:3100`, prueba de crear respuesta rapida e insertarla en el composer.
- Pendiente: mover persistencia a Supabase con autenticacion y validar mobile con automatizacion estable o prueba manual.

### Supabase Auth y persistencia preparada

- Resumen: se agrego login Supabase por email OTP, fallback demo local, carga/guardado de respuestas rapidas en Supabase cuando hay sesion, preferencias por usuario/workspace y RLS inicial en el esquema.
- Areas tocadas: `src/app/page.tsx`, `supabase/schema.sql`, `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, revision desktop en `http://localhost:3100` sin credenciales Supabase.
- Pendiente: crear proyecto Supabase real, aplicar esquema, configurar Auth email OTP y probar flujo autenticado con credenciales reales.

### Verificacion operativa de Supabase

- Resumen: se agrego `npm run check:supabase` para validar `.env.local`, variables publicas/server y alcance REST/Auth del proyecto Supabase antes de probar login real.
- Areas tocadas: `scripts/check-supabase-config.mjs`, `package.json`, `README.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/supabase-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run check:supabase` confirma que faltan credenciales locales, `npm run lint`, `npm run build`, `git diff --check`.
- Pendiente: cargar credenciales Supabase reales, aplicar `supabase/schema.sql` y probar email OTP.

### Ajuste de validacion Supabase real

- Resumen: se ajusto `npm run check:supabase` para probar la tabla `workspaces` del schema aplicado y se ignoran archivos locales con passwords para evitar commits accidentales.
- Areas tocadas: `scripts/check-supabase-config.mjs`, `.gitignore`, `docs/supabase-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run check:supabase`, `npm run lint`, `npm run build`, `GET /api/health` con `supabase: configured`.
- Pendiente: probar login email OTP desde la UI.

### Bootstrap idempotente de workspace

- Resumen: se detecto login real Supabase activo y se corrigio una carrera de desarrollo que podia crear dos workspaces personales para el mismo usuario. Se agrego indice unico por `owner_user_id` y SQL de limpieza para entornos ya afectados.
- Areas tocadas: `src/app/page.tsx`, `supabase/schema.sql`, `supabase/fixes/2026-07-06-dedupe-personal-workspaces.sql`, `docs/architecture.md`, `docs/supabase-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `npm run check:supabase`; se limpio un workspace duplicado sin datos asociados en el proyecto Supabase real.
- Pendiente: ejecutar `supabase/fixes/2026-07-06-dedupe-personal-workspaces.sql` en SQL Editor para crear el indice unico en la base real y confirmar siembra de respuestas rapidas luego de recargar sesion.

### Inbox Supabase con seed demo

- Resumen: se agrego carga autenticada de `connected_accounts`, `contacts`, `inbox_items` e `inbox_messages` desde Supabase, seed demo por workspace vacio, fallback local sin sesion y etiqueta visual de origen `Inbox: Supabase`/`Inbox: demo local`.
- Areas tocadas: `src/app/page.tsx`, `README.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/account-filter-plan.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`; conteo Supabase real con `connected_accounts: 2`, `contacts: 4`, `inbox_items: 4`, `inbox_messages: 9`, `quick_replies: 1`.
- Pendiente: persistir acciones de respuesta, like, ocultar/mostrar y bloquear sobre las tablas Supabase.

### Persistencia de acciones de inbox

- Resumen: se extendio `/api/inbox/action` para persistir `reply`, `like`, `unlike`, `hide`, `unhide`, `block` y `archive` sobre `inbox_items`, `inbox_messages` y `contacts`, manteniendo `action_log`.
- Areas tocadas: `src/lib/types.ts`, `src/lib/meta.ts`, `src/app/api/inbox/action/route.ts`, `src/app/page.tsx`, `README.md`, `docs/api.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, prueba HTTP de `like`, `unlike`, `hide`, `unhide`, `reply`, `archive` y `block` contra un `inbox_item` real; todas devolvieron `persisted=true`. Conteos posteriores: `inbox_items: 4`, `inbox_messages: 10`, `contacts: 4`, `action_log: 8`.
- Pendiente: conectar acciones a Meta real cuando exista OAuth/tokens.

### UX de archivados y respuestas rapidas

- Resumen: se separo la bandeja principal de la vista `Archivados`, se agrego `unarchive` persistido y se oculto el panel de respuestas rapidas detras de un boton con icono junto al composer.
- Areas tocadas: `src/app/page.tsx`, `src/lib/types.ts`, `src/lib/meta.ts`, `src/app/api/inbox/action/route.ts`, `README.md`, `docs/api.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, prueba HTTP `archive`/`unarchive` con `persisted=true`, revision UI en `http://localhost:3100` confirmando boton `Archivados` y panel de respuestas rapidas oculto hasta tocar el icono.
- Pendiente: validar ergonomia mobile del nuevo panel de respuestas rapidas.

### Regla de cierre dinamico

- Resumen: se agrego a la directiva operativa que cada entrega debe cerrar indicando que hace el usuario y cual es el siguiente paso recomendado de Codex.
- Areas tocadas: `docs/work-directive.md`, `docs/programming-log.md`.
- Validacion: `git diff --check`.
- Pendiente: aplicar esta regla en todos los cierres siguientes.

### Validacion mobile de archivados y respuestas rapidas

- Resumen: se valido la vista movil de `Archivados` y del panel de respuestas rapidas; se ajusto la lista de respuestas para apilar tarjetas en mobile y evitar controles fuera del viewport.
- Areas tocadas: `src/app/page.tsx`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, revision en viewport 390x844 sin overflow horizontal, boton `Archivados` visible, panel abierto desde icono y `outsideControlCount: 0`.
- Pendiente: continuar con el siguiente bloque funcional de Meta OAuth o configuracion de cuentas conectadas.

### Preparacion OAuth Meta

- Resumen: se agrego panel `Configuracion Meta`, inicio OAuth server-side con sesion Supabase, callback OAuth con `state` firmado y documentacion operativa de Meta.
- Areas tocadas: `src/lib/meta.ts`, `src/app/api/meta/oauth/start/route.ts`, `src/app/api/meta/oauth/callback/route.ts`, `src/app/page.tsx`, `README.md`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/meta-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, `POST /api/meta/oauth/start` sin credenciales Meta devuelve 400 controlado, callback con `state` invalido redirige a `meta_oauth=invalid_state`, revision UI del panel Meta sin overflow.
- Pendiente: agregar cifrado server-side de tokens, intercambiar `code` por token y guardar cuentas reales en `connected_accounts`.

### Scopes OAuth Meta configurables

- Resumen: se ajusto el inicio OAuth para pedir `pages_show_list` por defecto y permitir ampliar scopes con `META_OAUTH_SCOPES`, evitando que Meta bloquee la prueba local por permisos avanzados todavia no habilitados.
- Areas tocadas: `src/lib/meta.ts`, `src/app/page.tsx`, `.env.example`, `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/user-guide.md`, `docs/meta-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health` con `supabase: configured` y `meta: configured`, `GET /api/meta/oauth/callback` con `state` invalido redirige a `meta_oauth=invalid_state`, `git diff --check`.
- Pendiente: reintentar `Iniciar OAuth Meta` y, si vuelve con `code_received`, implementar cifrado e intercambio de token.

### Callback OAuth Meta con guardado de cuentas

- Resumen: se implemento intercambio de `code` por token, extension a token largo, lectura de permisos concedidos, lectura de paginas/Instagram vinculado, cifrado AES-GCM de page tokens y upsert de cuentas reales en `connected_accounts`.
- Areas tocadas: `src/lib/meta.ts`, `src/app/api/meta/oauth/callback/route.ts`, `src/app/page.tsx`, `.env.example`, `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/user-guide.md`, `docs/meta-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health` con `supabase: configured` y `meta: configured`, `git diff --check`.
- Pendiente: ampliar permisos Meta y suscribir webhooks reales para comentarios, ads y DMs.

### Diagnostico visual de cuentas Meta

- Resumen: se marco cada cuenta conectada como real o demo segun tenga token cifrado, y se agrego diagnostico en Configuracion Meta para ver cuentas reales/demo, Facebook/Instagram reales, scopes concedidos y capacidades pendientes.
- Areas tocadas: `src/app/page.tsx`, `docs/architecture.md`, `docs/user-guide.md`, `docs/meta-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health` con `supabase: configured` y `meta: configured`, `git diff --check`.
- Pendiente: usar el diagnostico para decidir el siguiente scope incremental a solicitar a Meta.

### Soporte de Facebook Login for Business config

- Resumen: se agrego soporte opcional para `META_LOGIN_CONFIG_ID`; cuando existe, la URL OAuth envia `config_id`, `override_default_response_type=true` y `auth_type=rerequest` para probar permisos avanzados desde una configuracion de Facebook Login for Business.
- Areas tocadas: `src/lib/meta.ts`, `.env.example`, `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/meta-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health` con `supabase: configured` y `meta: configured`, `POST /api/meta/oauth/start` sin sesion devuelve `401`, `git diff --check`.
- Pendiente: crear configuracion en Meta, cargar `META_LOGIN_CONFIG_ID` y reintentar OAuth con `pages_manage_metadata`.

### Paginacion y nombres devueltos por Meta

- Resumen: se ajusto la lectura de `/me/accounts` para usar `limit=100`, seguir paginacion de Graph y mostrar hasta 10 nombres de paginas devueltas en el mensaje OAuth.
- Areas tocadas: `src/lib/meta.ts`, `src/app/api/meta/oauth/callback/route.ts`, `src/app/page.tsx`, `.gitignore`, `docs/api.md`, `docs/meta-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health` con `supabase: configured` y `meta: configured`, callback con `state` invalido redirige a `meta_oauth=invalid_state`, `git diff --check`.
- Pendiente: reintentar OAuth para confirmar si Graph devuelve mas paginas o solo `Ecuakaraoke Original`.

### Descubrimiento de paginas via Business Manager

- Resumen: se agrego fallback opcional con `business_management`; si Meta concede ese scope, el callback consulta `me/businesses` y fusiona paginas `owned_pages`/`client_pages` con las de `/me/accounts`.
- Areas tocadas: `src/lib/meta.ts`, `src/app/api/meta/oauth/callback/route.ts`, `src/app/page.tsx`, `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/meta-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health` con `supabase: configured` y `meta: configured`, callback con `state` invalido redirige a `meta_oauth=invalid_state`, `git diff --check`.
- Pendiente: agregar `business_management` a la configuracion Meta y a `META_OAUTH_SCOPES`, reintentar OAuth y comparar paginas devueltas.

### Desconexion de cuentas Meta no deseadas

- Resumen: se agrego endpoint autenticado para eliminar cuentas conectadas del workspace, boton de desconexion en el panel lateral, estados visuales `Real`, `Pendiente` y `Demo`, y nombres de cuenta multilínea para no recortar paginas largas.
- Areas tocadas: `src/app/api/meta/accounts/[accountId]/route.ts`, `src/app/page.tsx`, `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health` con `supabase: configured` y `meta: configured`, `DELETE /api/meta/accounts/[accountId]` sin sesion devuelve `401`, viewport 390px sin overflow horizontal, `git diff --check`.
- Pendiente: usar la UI para desconectar paginas no deseadas y decidir si luego se agrega una lista persistente de ignoradas para futuros OAuth.

### Etiquetas visuales de plataforma

- Resumen: se agregaron etiquetas e iconos de plataforma en tarjetas de cuentas y toggles de cuentas visibles para distinguir Facebook/Instagram sin depender del nombre.
- Areas tocadas: `src/app/page.tsx`, `docs/architecture.md`, `docs/account-filter-plan.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health` con `supabase: configured` y `meta: configured`, viewport 390px sin overflow horizontal y con badges `FB`/`IG`, `git diff --check`.
- Pendiente: ampliar `Network`, schema y metadata visual cuando se integren TikTok o Google Business Profile.

### Sincronizacion manual de comentarios Facebook

- Resumen: se agrego descifrado server-side de page tokens, lectura de comentarios organicos de Facebook con `pages_read_engagement`, endpoint autenticado de sincronizacion y boton en Configuracion Meta.
- Areas tocadas: `src/lib/meta.ts`, `src/app/api/meta/sync/comments/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/meta-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health` con `supabase: configured` y `meta: configured`, `POST /api/meta/sync/comments` sin sesion devuelve `401`, `git diff --check`.
- Pendiente: agregar `pages_read_engagement` en Meta, actualizar `.env.local`, reautorizar OAuth y ejecutar sincronizacion real.

### Diagnostico de permisos para comentarios Facebook

- Resumen: se verifico contra Graph API que los page tokens tienen `pages_read_engagement`, pero `/{pageId}/posts`, `/{pageId}/published_posts` y `/{pageId}/feed` devuelven error `#10` si falta `pages_read_user_content`. Se ajusto el diagnostico de capacidades y el endpoint para exigir ambos permisos y mostrar el primer error real de Meta en la UI.
- Areas tocadas: `src/lib/meta.ts`, `src/app/api/meta/sync/comments/route.ts`, `src/app/page.tsx`, `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/user-guide.md`, `docs/meta-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, `git diff --check`.
- Pendiente: agregar `pages_read_user_content` en Meta, actualizar `.env.local`, reautorizar OAuth y reintentar `Sincronizar comentarios FB`.

### UX operativa de bandeja y seleccion masiva

- Resumen: se agregaron identificadores visibles de plataforma, cuenta y tipo de item en filas/cabecera, checkboxes por conversacion, seleccion de visibles, acciones masivas para leido/no leido/archivar/desarchivar, fecha con anio y fallback inicial de autor pendiente cuando Meta no entrega autor del comentario.
- Areas tocadas: `src/app/page.tsx`, `src/lib/types.ts`, `src/lib/meta.ts`, `src/app/api/inbox/action/route.ts`, `src/app/api/meta/sync/comments/route.ts`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, smoke desktop/mobile con navegador sin errores de consola ni overflow horizontal; en movil se elimino el scroll interno doble de la bandeja.
- Pendiente: agregar `pages_manage_engagement` para ejecutar acciones reales de moderacion en Meta y volver a probar si Meta devuelve autor de comentario con permisos ampliados.

### Feedback inmediato en acciones masivas

- Resumen: se cambio la barra masiva para aplicar cambios optimistas en la UI antes de esperar la respuesta del endpoint, limpiar la seleccion inmediatamente y mostrar estado de guardado. Esto corrige la percepcion de que `Leido` no hacia nada cuando la persistencia demoraba.
- Areas tocadas: `src/app/page.tsx`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, smoke de seleccionar una conversacion y pulsar `Leido`; el badge desaparece inmediatamente y luego se confirma guardado.

### Sincronizacion de comentarios recientes

- Resumen: se diagnostico que un comentario organico nuevo aparecia en Graph API al consultar `{post-id}/comments?order=reverse_chronological`, pero no entraba por los comentarios embebidos del listado de posts. Se cambio `fetchMetaOrganicComments` para leer publicaciones recientes y consultar comentarios por post con orden inverso cronologico.
- Areas tocadas: `src/lib/meta.ts`, `docs/architecture.md`, `docs/api.md`, `docs/programming-log.md`.
- Validacion: consulta directa a Graph encontro un comentario reciente en `Academia Expertos de la Musica`; `npm run lint`, `npm run build`.
- Pendiente: ejecutar `Sincronizar comentarios FB` desde la app y confirmar que inserta el comentario reciente.

### Auto-sincronizacion previa a webhooks

- Resumen: se agrego auto-sincronizacion de comentarios Facebook mientras la app esta abierta, con bloqueo de concurrencia y aviso cuando entran comentarios nuevos. Se documento que el mecanismo definitivo para eventos instantaneos 24/7 son Webhooks Meta sobre URL HTTPS publica y campo Page `feed`.
- Areas tocadas: `src/app/page.tsx`, `docs/architecture.md`, `docs/user-guide.md`, `docs/meta-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, log con llamada automatica a `/api/meta/sync/comments`, smoke UI sin errores de consola ni overflow horizontal.
- Pendiente: desplegar/publicar URL HTTPS y configurar Webhooks Meta reales.

### Polling corto para comentarios nuevos

- Resumen: se comprobo que el comentario `crack` de `Academia Expertos de la Musica` existe en Graph API pero no estaba en Supabase. Se bajo la auto-sincronizacion a 15 segundos y se optimizo la lectura para consultar solo posts con comentarios, usando `comments.summary(true).limit(0)` y luego `/comments?order=reverse_chronological`.
- Areas tocadas: `src/lib/meta.ts`, `src/app/page.tsx`, `src/app/api/meta/sync/comments/route.ts`, `docs/architecture.md`, `docs/user-guide.md`, `docs/api.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`.
- Diagnostico: despues de reiniciar, no se observo POST automatico nuevo si la UI no esta recargada/logueada; esto confirma que polling desde cliente no reemplaza Webhooks Meta.
- Pendiente: implementar webhooks reales para eliminar dependencia de polling.

### Redisenio operativo de tres columnas

- Resumen: se rehizo el layout desktop en tres paneles operativos: cuentas oscuras con nombres completos, ojo global/individual, menu de tres puntos y boton `Anadir cuenta`; bandeja con scroll propio; conversacion con contenido superior scrolleable y footer fijo para composer, respuestas rapidas y acciones.
- Areas tocadas: `src/app/page.tsx`, `src/app/api/meta/sync/comments/route.ts`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, smoke desktop y movil con navegador integrado sin errores de consola ni overflow horizontal.
- Pendiente: seguir refinando densidad y comportamiento movil antes de pasar a Vercel/Webhooks.

### Compactacion visual del panel de cuentas

- Resumen: se redujo la escala visual del panel izquierdo para que las cuentas funcionen como lista operativa y no como cards grandes: menos padding, avatares mas pequenos, botones compactos, textos `text-sm/text-xs` y boton `Anadir cuenta` mas bajo.
- Areas tocadas: `src/app/page.tsx`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, smoke desktop/movil con navegador integrado. Cards de cuenta a 78px de alto, titulos a 14px, boton `Anadir cuenta` a 40px, sin overflow horizontal ni errores de consola.
- Pendiente: seguir con refinamiento global de UI/UX antes de publicar en Vercel y configurar Webhooks Meta.

### Reorganizacion del panel de conversacion

- Resumen: se movio bloqueo de usuario a la cabecera del autor, se quitaron controles sin funcionalidad de la esquina superior derecha, se agrego menu para abrir publicacion original, se dejaron reacciones/ocultar junto al comentario recibido y el footer del composer quedo con responder, respuestas rapidas, enviar y archivar.
- Areas tocadas: `src/app/page.tsx`, `src/lib/types.ts`, `src/lib/demo-data.ts`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, smoke desktop con menu `Abrir publicacion original`, sin `Sin asignar` ni iconos muertos, sin overflow horizontal; smoke movil sin overflow.
- Pendiente: persistir permalink exacto de Meta en Supabase y ampliar `/api/inbox/action` si se quieren reacciones diferenciadas reales mas alla de `like/unlike`.

### Correccion de desbloqueo y texto completo de publicacion

- Resumen: se agrego accion `unblock` para que el icono de bloqueo funcione como toggle real; tambien se cambio la sincronizacion Facebook para consultar cada post individual y obtener `message` completo antes de guardar el contexto, porque `published_posts` podia devolver textos truncados de 105 caracteres en algunos reels/videos.
- Areas tocadas: `src/app/page.tsx`, `src/lib/types.ts`, `src/lib/meta.ts`, `src/app/api/inbox/action/route.ts`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`; enriquecimiento puntual en Supabase dejo posts recientes de Academia Expertos de la Musica en 461 y 1113 caracteres.
- Pendiente: persistir `permalink_url` exacto en una columna dedicada para no derivar URL desde `provider_post_id`.

### Selector de canal de respuesta para comentarios

- Resumen: se agrego selector visible en el composer de comentarios para elegir `Responder sobre comentario` o `Responder por mensaje interno`; la decision viaja al backend como `replyMode`, junto con `recipientExternalId` cuando el handle permite inferirlo.
- Areas tocadas: `src/app/page.tsx`, `src/lib/types.ts`, `src/lib/meta.ts`, `src/app/api/inbox/action/route.ts`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`.
- Pendiente: cablear respuesta publica con etiquetado real del autor y respuesta privada Messenger/Instagram DM cuando esten listos los permisos Meta correspondientes.

### Mobile inbox y vista Respondidos

- Resumen: se ajusto mobile para comprimir cuentas/configuracion arriba, expandible bajo demanda; la lista de conversaciones queda como pantalla principal y al tocar un item se abre el panel de respuesta con boton `Volver a bandeja`. Se agrego vista `Respondidos`, y `Bandeja` ahora excluye respondidos/archivados y solo muestra contador de no leidos.
- Areas tocadas: `src/app/page.tsx`, `src/app/api/inbox/action/route.ts`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, smoke mobile lista/detalle/volver sin overflow, smoke desktop tres columnas con `Bandeja`, `Respondidos` y `Archivados`.
- Pendiente: probar con datos reales despues de desplegar Webhooks Meta para confirmar transicion automatica a `Respondidos` con acciones de respuesta reales.

### Preparacion Vercel y procesamiento inicial de Webhooks Meta

- Resumen: se factoriza la persistencia de comentarios en `src/lib/inbox-persistence.ts`, la sincronizacion manual reutiliza ese persistidor y `POST /api/meta/webhook` ahora procesa cambios `Page/feed` de comentarios `add|edited` para normalizarlos a inbox despues de guardar el evento crudo.
- Areas tocadas: `src/app/api/meta/webhook/route.ts`, `src/app/api/meta/sync/comments/route.ts`, `src/lib/meta.ts`, `src/lib/inbox-persistence.ts`, `README.md`, `docs/api.md`, `docs/architecture.md`, `docs/vercel-deploy.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, challenge webhook devuelve `hub.challenge`, firma invalida devuelve `403`, firma valida devuelve `200` con `processed: 0` cuando la pagina de prueba no esta conectada.
- Pendiente: desplegar en Vercel, configurar variables, OAuth callback, Webhooks Page `feed` y probar evento real entrante.

### Suscripcion automatica de paginas a Webhooks Meta

- Resumen: se diagnostico que el endpoint publico de Vercel recibia challenge y POST firmado correctamente, pero Meta no enviaba eventos reales porque las paginas no tenian la app en `/{page-id}/subscribed_apps`. Se suscribieron las 4 paginas reales al campo `feed` y se agrego suscripcion automatica durante el callback OAuth cuando Meta devuelve page token.
- Areas tocadas: `src/lib/meta.ts`, `src/app/api/meta/oauth/callback/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/vercel-deploy.md`, `docs/programming-log.md`.
- Validacion: consulta Graph `/{page-id}/subscribed_apps` antes/despues; Meta devolvio `success: true` y luego cada pagina mostro `Social Inbox MVP` con `feed`.
- Pendiente: probar un comentario real nuevo despues de la suscripcion y verificar entrada en `webhook_events`, `inbox_items` e `inbox_messages`.

### Sincronizacion tolerante a posts inaccesibles

- Resumen: se verifico que Graph podia leer el comentario real `son increibles` en `Academia Expertos de la Musica`, pero Meta no lo entrego por webhook. Durante la sincronizacion algunos posts de otras paginas devolvian error `#100` al leer `/comments` y eso podia abortar la cuenta completa. Se cambio la lectura para saltar posts inaccesibles y continuar con comentarios legibles.
- Areas tocadas: `src/lib/meta.ts`, `docs/programming-log.md`.
- Validacion: consulta Graph directa encontro el comentario real de `Mauro Hernan Moras`; se persistio en `inbox_items` como `post_comment`, estado `new`, cuenta visible y `unread_count = 1`.
- Pendiente: redesplegar y confirmar que el polling de la app publica importa comentarios nuevos aunque algun post aislado devuelva error de permisos.

### Refresco casi en tiempo real del inbox

- Resumen: se agrego suscripcion Supabase Realtime sobre `inbox_items` para recargar la bandeja cuando se inserta o actualiza una conversacion, y se bajo el polling de respaldo de comentarios Facebook a 5 segundos mientras la app esta abierta.
- Areas tocadas: `src/app/page.tsx`, `supabase/schema.sql`, `docs/architecture.md`, `docs/supabase-setup.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: ejecutar el bloque Realtime del schema en Supabase, redesplegar Vercel y probar comentario real nuevo con la app publica abierta.
- Nota: para diferencias de 1-2 segundos 24/7 el canal correcto sigue siendo Meta Webhooks; Vercel Hobby no sirve para cron frecuente porque sus cron jobs solo pueden correr una vez por dia.

### Polling rapido para comentarios organicos

- Resumen: un comentario organico `son geniales!` entro por polling en unos 32 segundos porque la sincronizacion automatica hacia una pasada profunda. Se agrego `mode = fast` para la auto-sincronizacion: cuentas en paralelo y limites reducidos de posts/comentarios; el boton manual conserva `mode = full`.
- Areas tocadas: `src/lib/meta.ts`, `src/app/api/meta/sync/comments/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/programming-log.md`.
- Validacion pendiente: desplegar y medir nuevo comentario organico con app abierta. Webhooks Meta siguen sin entregar eventos reales, por lo que el polling rapido es respaldo, no reemplazo definitivo.

### Trazabilidad de origen de ingestion

- Resumen: se agrego `inbox_items.ingest_source` y badges de UI para distinguir `webhook`, `polling_fast`, `polling_full` y `unknown`. El persistidor compartido marca el origen al guardar comentarios y mantiene fallback si la columna todavia no existe en Supabase.
- Areas tocadas: `supabase/schema.sql`, `src/lib/types.ts`, `src/lib/inbox-persistence.ts`, `src/app/api/meta/webhook/route.ts`, `src/app/api/meta/sync/comments/route.ts`, `src/app/page.tsx`, `docs/architecture.md`, `docs/supabase-setup.md`, `docs/programming-log.md`.
- Validacion pendiente: ejecutar SQL de schema en Supabase para activar la columna y verificar que nuevos comentarios muestren `Polling rapido` o `Webhook` en la UI.

### Diagnostico operativo de Webhooks Meta

- Resumen: se agrego endpoint autenticado `/api/meta/webhook/diagnostics` y boton en Configuracion Meta para consultar el estado real de `Page/feed` en la app, suscripcion `feed` por pagina y ultimos eventos recibidos.
- Areas tocadas: `src/lib/meta.ts`, `src/app/api/meta/webhook/diagnostics/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/programming-log.md`.
- Validacion pendiente: ejecutar diagnostico desde la app publica y comparar con comentarios organicos nuevos que sigan entrando por `Polling rapido`.

### Base para diagnostico de comentarios de Ads

- Resumen: se agrego `ads_read` como scope objetivo, tabla `meta_connections` para guardar user token largo cifrado, guardado del token en OAuth callback, endpoint `/api/meta/ads/diagnostics` y boton `Diagnosticar Ads` en Configuracion Meta.
- Areas tocadas: `supabase/schema.sql`, `src/lib/meta.ts`, `src/app/api/meta/oauth/callback/route.ts`, `src/app/api/meta/ads/diagnostics/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/supabase-setup.md`, `docs/meta-setup.md`, `docs/programming-log.md`.
- Validacion pendiente: ejecutar SQL de `meta_connections`, agregar `ads_read` en Vercel/Meta Login config, reautorizar OAuth y confirmar cuentas publicitarias via diagnostico.

### Sincronizacion manual de comentarios de Ads

- Resumen: se agrego `/api/meta/sync/ad-comments` para descubrir anuncios recientes por Marketing API, resolver el post/story asociado desde `effective_object_story_id` u `object_story_id`, leer comentarios con page token y persistirlos como `source = ad_comment`, `ingest_source = ads_manual` y `provider_ad_id`. La UI suma boton `Sincronizar comentarios Ads`.
- Areas tocadas: `src/lib/meta.ts`, `src/lib/types.ts`, `src/lib/inbox-persistence.ts`, `src/app/api/meta/sync/ad-comments/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y probar con comentario real en anuncio.
- Pendiente: ampliar campos de creative si algun formato de anuncio no expone story/post asociado.

### Ventana operativa de 72 horas para comentarios

- Resumen: se fijo una regla de producto para no importar historicos: las sincronizaciones de comentarios organicos Facebook y comentarios de Ads solo persisten comentarios con `created_time` dentro de las ultimas 72 horas. Tambien se envia `since` a Meta cuando se lee el edge `/comments`.
- Areas tocadas: `src/lib/meta.ts`, `src/app/api/meta/sync/comments/route.ts`, `src/app/api/meta/sync/ad-comments/route.ts`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y verificar que `Sincronizar comentarios Ads` deje de importar comentarios viejos.
- Pendiente: implementar ingest automatico de Ads, Instagram comments, Messenger y DM con sus permisos reales.

### Sincronizacion Ads acotada para evitar bloqueo de UI

- Resumen: se corrigio la sincronizacion manual de Ads para no paginar todo el historico de anuncios por cuenta. Ahora lee solo la primera pagina limitada de anuncios por cuenta, deduplica por post/story, limita posts y comentarios por llamada, y el cliente cancela visualmente la espera si tarda mas de 25 segundos.
- Areas tocadas: `src/lib/meta.ts`, `src/app/api/meta/sync/ad-comments/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y probar que el boton `Sincronizar comentarios Ads` no quede tildado.
- Pendiente: convertir Ads en ingest automatico incremental para no depender de una pasada manual.

### Acciones reales sobre comentarios Facebook

- Resumen: `/api/inbox/action` ahora recibe el bearer token Supabase desde la UI, valida que el item pertenezca al usuario, descifra el page token server-side y ejecuta acciones reales contra Meta para comentarios Facebook: respuesta publica, private reply, like/unlike y ocultar/mostrar. Las acciones internas siguen sin llamar a Meta.
- Areas tocadas: `src/app/page.tsx`, `src/app/api/inbox/action/route.ts`, `src/lib/meta.ts`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y probar con comentario real.
- Pendiente: bloqueo/desbloqueo real de usuarios de Page, reacciones diferenciadas, Messenger/DM e Instagram comments.

### Mencion del autor y restriccion de reacciones Facebook

- Resumen: se intento inicialmente prefijar la respuesta publica Facebook con `@[provider-user-id]` cuando existe `recipientExternalId`, para intentar mencionar/notificar al autor del comentario. Tambien se ocultaron `Me encanta` y `Me divierte` para Facebook porque el endpoint real cableado y validado solo aplica `like/unlike`; mostrar reacciones que no cambian en Meta era una falla de UX.
- Areas tocadas: `src/lib/meta.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y probar respuesta publica sobre comentario real.
- Pendiente: investigar si Meta ofrece escritura soportada de reacciones diferenciadas para comentarios de Page en la version actual de Graph API.

### Intento de mencion formal con `message_tags`

- Resumen: se reemplazo el prefijo textual `@[provider-user-id]` por envio de `message_tags` en respuestas publicas Facebook. El backend obtiene `contacts.display_name`, construye el texto con el nombre al inicio y manda el rango `{ id, name, offset, length }` para que Meta intente convertirlo en mencion real.
- Areas tocadas: `src/app/api/inbox/action/route.ts`, `src/lib/meta.ts`, `docs/api.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y probar con comentario real si Meta acepta `message_tags` al crear replies de Page.
- Pendiente: si Meta rechaza `message_tags`, registrar el error exacto y decidir entre fallback visible o private reply.

### Retiro de falsa mencion textual en Facebook replies

- Resumen: se verifico en Graph el reply creado por Meta y la respuesta no incluyo `message_tags`; Meta acepto el POST pero guardo el nombre como texto plano. Se retiro el envio de `message_tags` y el prefijo de nombre para no simular una mencion que no es real.
- Areas tocadas: `src/app/api/inbox/action/route.ts`, `src/lib/meta.ts`, `docs/api.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`.
- Pendiente: usar private reply/Messenger para notificacion directa cuando el usuario elija respuesta privada, y mantener respuesta publica sin falsa mencion.

### Copia privada y eliminacion de respuestas agente

- Resumen: cuando una respuesta Facebook se envia como `public_comment`, el backend publica el comentario y luego intenta enviar copia por `private_replies`. Tambien se guarda el ID del reply publico en `inbox_messages.provider_message_id` y la UI muestra boton para eliminar respuestas agente; si existe ID externo, `/api/inbox/action` intenta borrarlo en Meta antes de borrar el mensaje local.
- Areas tocadas: `src/lib/types.ts`, `src/lib/meta.ts`, `src/app/api/inbox/action/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, probar respuesta publica real y luego eliminarla.
- Pendiente: confirmar si Meta permite borrar private replies/Messenger messages; por ahora el ID persistido principal es el reply publico.

### Ajuste de private reply Facebook via Send API

- Resumen: Meta rechazo `/{comment-id}/private_replies` con `GraphMethodException` subcode 33. Se cambio el envio privado Facebook a Messenger Send API `me/messages`, usando `recipient.comment_id` y `message.text` con el page token.
- Areas tocadas: `src/lib/meta.ts`, `docs/api.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, probar respuesta publica con copia privada.
- Pendiente: registrar si Meta devuelve errores de ventana/politica de Messenger para comentarios especificos.

### Correccion de borrado real de respuestas agente

- Resumen: `delete_message` no estaba incluido en el conjunto de acciones que resuelven page token Meta, por lo que caia en modo demo aunque el mensaje tuviera `provider_message_id`. Se agrego la accion al cableado real y la UI recarga Supabase despues de responder/eliminar para usar IDs persistidos.
- Areas tocadas: `src/app/api/inbox/action/route.ts`, `src/app/page.tsx`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, probar eliminacion de un reply creado despues del despliegue.
- Pendiente: los replies antiguos sin `provider_message_id` no se pueden eliminar desde la app porque no hay ID externo para borrar en Meta.

### Eliminacion estricta en Meta

- Resumen: se retiro el fallback de borrado local para respuestas agente. `delete_message` ahora exige `provider_message_id` y page token real; si no existen, devuelve error y no borra Supabase. La UI deshabilita el boton en respuestas sin ID externo para evitar prometer un borrado que no puede aplicarse en Meta.
- Areas tocadas: `src/app/api/inbox/action/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, probar eliminacion de un reply nuevo con `provider_message_id`.
- Pendiente: investigar si Meta permite borrar copias privadas enviadas por Messenger; por ahora se elimina el reply publico creado en el comentario.

### Mensaje claro para private reply ya enviada

- Resumen: al volver a responder el mismo comentario, Meta devolvio `(#10900) Activity already replied to`; el endpoint correcto `me/messages` seguia funcionando, pero Meta no permite otra copia privada para esa actividad. Se cambio el mensaje de UI para explicar esa regla en vez de mostrarlo como fallo generico.
- Areas tocadas: `src/lib/meta.ts`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`.
- Pendiente: considerar guardar en DB un flag de private reply enviada para no intentar repetirla en el mismo comentario.

### Mensaje claro para private reply no elegible

- Resumen: Meta devolvio `Invalid parameter` con code `100`, subcode `1893060` y `error_user_title = Identificador de comentario de respuesta privada no valido` para un comentario cuyo ID tampoco se pudo leer directamente por Graph. Se mapeo ese caso a un mensaje especifico: Meta no acepta ese comentario como private reply.
- Areas tocadas: `src/lib/meta.ts`, `docs/api.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`.
- Pendiente: evaluar si vale la pena marcar estos comentarios como no elegibles para private reply en DB.

### Messenger entrante por webhook `messages`

- Resumen: se agrego procesamiento de `entry.messaging[]` en `POST /api/meta/webhook`, persistencia de mensajes entrantes de Messenger como `inbox_items.source = messenger` y respuesta real a hilos Messenger usando Send API `me/messages` con `recipient.id`. La suscripcion automatica de paginas ahora pide `feed,messages` y el diagnostico muestra si ambos campos estan activos en app y paginas.
- Areas tocadas: `src/app/api/meta/webhook/route.ts`, `src/lib/inbox-persistence.ts`, `src/lib/meta.ts`, `src/app/api/inbox/action/route.ts`, `src/app/api/meta/webhook/diagnostics/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/meta-setup.md`, `docs/user-guide.md`, `docs/vercel-deploy.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar en Vercel y probar una respuesta real por Messenger.
- Pendiente: si el diagnostico marca `messages` como no activo, activar el campo Page `messages` en Meta Developers o reautorizar para que el callback suscriba de nuevo cada pagina.

### Re-suscripcion operativa de webhooks Page

- Resumen: se agrego `/api/meta/webhook/subscribe` y boton `Re-suscribir paginas` en Configuracion Meta para volver a pedir `feed,messages` con los page tokens guardados, sin obligar a repetir OAuth. El endpoint tambien avisa si `messages` no esta activo en la configuracion de Webhooks de la app Meta.
- Areas tocadas: `src/app/api/meta/webhook/subscribe/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y pulsar el boton despues de activar `messages` en Meta Developers.
- Pendiente: probar recepcion de un mensaje Messenger real luego de que el diagnostico muestre `feed + messages` y `4/4`.

### Auto-sync Ads y apartado de bloqueados

- Resumen: `/api/meta/sync/ad-comments` ahora acepta `mode = fast|full`; la UI ejecuta auto-sync Ads cada 30 segundos en modo rapido cuando hay permisos suficientes, y distingue `ads_auto` de `ads_manual` en los badges. Tambien se agrego apartado `Autores bloqueados` en la columna de cuentas y el boton visible `Bloquear autor` / `Desbloquear` en la cabecera de conversacion.
- Areas tocadas: `src/app/api/meta/sync/ad-comments/route.ts`, `src/app/page.tsx`, `src/lib/types.ts`, `src/lib/inbox-persistence.ts`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y probar auto-sync Ads con un comentario nuevo de anuncio y bloqueo/desbloqueo de autor.
- Pendiente: bloqueo real externo en Meta e ingest automatico/webhook para Instagram comentarios y DM.

### Mensaje correcto para bloqueo interno

- Resumen: `block/unblock` se clasificaron como acciones internas en `executeMetaAction` para evitar el mensaje incorrecto `modo demo`. El bloqueo sigue persistiendo en `contacts.is_blocked` y ahora responde `Autor bloqueado en la app` / `Autor desbloqueado en la app`.
- Areas tocadas: `src/lib/meta.ts`, `docs/api.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y probar bloqueo/desbloqueo desde la UI.
- Pendiente: bloqueo real externo en Meta.

### Bloqueo real Facebook Page

- Resumen: `block/unblock` dejaron de ser accion interna para Facebook. El backend ahora resuelve page token, Page ID y Page Scoped ID del autor, ejecuta `/{page_id}/blocked` en Meta con `psid`, y solo persiste `contacts.is_blocked` si Meta confirma.
- Areas tocadas: `src/app/api/inbox/action/route.ts`, `src/lib/meta.ts`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y probar bloqueo/desbloqueo con autor real de Facebook/Messenger.
- Pendiente: validar endpoint equivalente para Instagram.

### Mensaje de bloqueo no aplicable

- Resumen: se verifico que el token de Ecuakaraoke Internacional puede leer `/{page_id}/blocked`, que las paginas devuelven tarea `MODERATE` y que el fallo real fue `(#200) Permissions error` al intentar bloquear al autor `Mauro Hernan Moras`. Se ajusto el mensaje para explicar que Meta puede rechazar autores no bloqueables, por ejemplo personas con rol sobre la Page.
- Areas tocadas: `src/lib/meta.ts`, `docs/api.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, probar con un autor que no administre/modere la pagina.
- Pendiente: confirmar bloqueo real con una cuenta externa sin rol sobre la Page.

### Barrido Ads activo ampliado

- Resumen: el comentario `excelente` en el Ad de Academia Expertos no entraba porque el anuncio `Garantia` estaba en Marketing API como activo, pero en posicion 13 dentro de la cuenta `CP COLD Expertos de la Musica`; el sync solo revisaba 8 anuncios por cuenta. Se amplio `mode = fast` a 25 anuncios activos por cuenta y `mode = full` a 100 anuncios activos/pausados por cuenta.
- Areas tocadas: `src/app/api/meta/sync/ad-comments/route.ts`, `src/lib/meta.ts`, `docs/api.md`, `docs/architecture.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, ejecutar sync Ads y verificar ingreso del comentario `excelente`.
- Pendiente: si otros formatos de anuncio no exponen `effective_object_story_id`, ampliar lectura de creative.

### Ads automatico sin dependencia del boton

- Resumen: el auto-sync de Ads dejo de usar el modo reducido. Ahora la UI llama `/api/meta/sync/ad-comments` con `mode = full` y `trigger = auto`; el endpoint usa limites de pagina maximos habituales de Graph (`100`) para anuncios y comentarios, y conserva `ads_auto` para trazabilidad. El boton manual queda como respaldo de diagnostico, no como requisito operativo.
- Areas tocadas: `src/app/api/meta/sync/ad-comments/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y verificar que el comentario `excelente` entre sin tocar boton.
- Pendiente: migrar esta consulta a job server-side programado para que funcione aun con la app cerrada.

### Eliminacion real de comentarios recibidos

- Resumen: se agrego accion `delete_comment` para comentarios organicos y de Ads. La UI muestra el icono de eliminar junto a like/ocultar, el backend ejecuta `DELETE /{comment_id}` en Meta y solo elimina la conversacion local si Meta confirma.
- Areas tocadas: `src/lib/types.ts`, `src/lib/meta.ts`, `src/app/api/inbox/action/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y probar con un comentario real.
- Pendiente: confirmar comportamiento de Meta si se elimina un comentario que ya tenia respuestas agente.

### Instagram comentarios y base DM

- Resumen: se agrego `/api/meta/sync/instagram-comments` para leer media/comentarios de cuentas Instagram conectadas, filtrar ultimas 72h y persistir como `network = instagram` + `source = post_comment`. La UI ejecuta auto-sync IG cada 10 segundos con permisos listos y ofrece boton manual de diagnostico. `/api/inbox/action` ahora resuelve acciones de comentario Facebook/Instagram y usa endpoints IG para responder, ocultar/mostrar y eliminar. El webhook Meta queda preparado para `object = instagram`, persistiendo cambios `comments` y eventos `entry.messaging[]` como `instagram_dm`.
- Areas tocadas: `src/lib/meta.ts`, `src/lib/inbox-persistence.ts`, `src/app/api/meta/sync/instagram-comments/route.ts`, `src/app/api/meta/webhook/route.ts`, `src/app/api/inbox/action/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `git diff --check`, `POST /api/meta/sync/instagram-comments` sin sesion devuelve `401`.
- Pendiente: agregar en Meta Login Configuration `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages` e `instagram_manage_engagement`, reautorizar OAuth y probar comentario/DM real en produccion.

### Ajustes acciones Instagram reales

- Resumen: la prueba real en `expertos.delamusica` confirmo ingreso de comentario IG, respuesta publica y borrado de comentario/respuesta. Se corrigio `like/unlike` para Instagram usando `/{ig-user-id}/likes` con `comment_id`, se desactivo la copia privada automatica despues de respuesta publica Instagram y se agrego mensaje especifico para el error `(#3)` de Instagram Messaging sin capacidad habilitada.
- Areas tocadas: `src/lib/meta.ts`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y probar like/unlike con un comentario IG nuevo.

### Diagnostico Instagram Messaging

- Resumen: el diagnostico de Webhooks ahora separa `Page feed/messages` de `Instagram comments/messages`. El backend revisa `/{app-id}/subscriptions` para objeto `instagram`, informa si `comments` y `messages` estan activos y muestra cuentas IG con token. La UI muestra un bloque `Instagram Webhooks / DM` con la accion concreta: activar Webhooks > Instagram > messages y revisar acceso avanzado/capacidad de Instagram Messaging si Meta devuelve `(#3)`.
- Areas tocadas: `src/app/api/meta/webhook/diagnostics/route.ts`, `src/app/page.tsx`, `docs/api.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, desplegar y usar `Diagnosticar webhooks` en produccion.

### Emojis y autor real en Instagram DM

- Resumen: el footer del composer suma un boton de emojis junto a archivar/desarchivar. El webhook Instagram DM ahora llama User Profile API con el IGSID para guardar `name` y `username` en `contacts`, corrigiendo contactos tipo `Instagram 265524`. Para comentarios Facebook Ads se verifico con Graph directo que algunos `comment_id` devuelven `from = null`; esos casos quedan como identidad pendiente.
- Areas tocadas: `src/app/page.tsx`, `src/app/api/meta/webhook/route.ts`, `src/lib/meta.ts`, `src/lib/inbox-persistence.ts`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion pendiente: `npm run lint`, `npm run build`, `git diff --check`, actualizar contactos existentes y probar nuevo DM Instagram.

### Picker completo de emojis y autor pendiente Ads

- Resumen: se reemplazo la lista corta de emojis por `emoji-picker-react`, con buscador y catalogo completo. Para comentarios Facebook Ads, la sincronizacion ya no pisa contactos reales cuando una lectura viene sin `from`; si falta identidad, intenta una consulta directa por `comment_id` y solo deja `Autor pendiente` cuando Graph tampoco devuelve autor.
- Areas tocadas: `package.json`, `package-lock.json`, `src/app/page.tsx`, `src/app/api/meta/sync/ad-comments/route.ts`, `src/lib/inbox-persistence.ts`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `git diff --check`. Se actualizaron contactos antiguos de Supabase con fallback previo a `Autor pendiente`.
- Pendiente: desplegar en Vercel y probar un comentario Ads nuevo para confirmar si Meta entrega `from` en ese caso concreto.

### Diagnostico autor Ads oculto por Graph

- Resumen: se audito el comentario Ads `Info por fa` en Academia Expertos de la Musica. Supabase lo guardo como `source = ad_comment`, `ingest_source = ads_auto`, sin webhook crudo asociado. Las consultas `/{comment_id}`, `/POST_ID/comments` con `reverse_chronological`, `chronological`, `filter=stream`, Page token guardado, Page token fresco y Graph v18-v25 devolvieron el comentario sin `from`. El post publicitario muestra respuestas de la Page con `from`, pero comentarios de usuarios sin autor. La Page tiene tarea `MODERATE`, asi que no es falta de rol sobre la Page.
- Cambio: `persistFacebookComment` y `persistInstagramComment` ahora actualizan `contact_id` en items existentes para que una resincronizacion posterior pueda reemplazar `Autor pendiente` por el contacto real si Meta empieza a devolver identidad.
- Areas tocadas: `src/lib/inbox-persistence.ts`, `docs/architecture.md`, `docs/programming-log.md`.
- Pendiente: llevar la app Meta a Live/Full Access o confirmar con Meta App Review que `pages_read_user_content` permite exponer `from` para comentarios de Ads de usuarios reales.

### Preservar autor real al reclasificar organico a Ads

- Resumen: se corrigio un caso donde un comentario de Ad entraba primero por lectura organica con autor real y segundos despues `ads_auto` lo reclasificaba como `ad_comment` con una lectura sin `from`, reemplazando el contacto real por `Autor pendiente`. Ahora, si el item ya existe con contacto real y la nueva lectura no trae `from`, se conserva `contact_id` y solo se actualiza `source`, `provider_ad_id` y metadatos.
- Dato corregido: el comentario `Cuanto sale el curso?` de Academia Expertos de la Musica quedo como `ad_comment` y se reasigno al contacto real `Alejandro Hernandez Yanez`.
- Areas tocadas: `src/lib/inbox-persistence.ts`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `git diff --check`.
