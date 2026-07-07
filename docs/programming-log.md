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

- Resumen: se agregaron identificadores visibles de plataforma, cuenta y tipo de item en filas/cabecera, checkboxes por conversacion, seleccion de visibles, acciones masivas para leido/no leido/archivar/desarchivar, fecha con anio y fallback `Autor no disponible` cuando Meta no entrega autor del comentario.
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
