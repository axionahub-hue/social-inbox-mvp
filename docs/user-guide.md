# Guia de uso

## Ejecutar la app

```bash
npm install
npm run dev
```

Abrir `http://localhost:3100`.

Si ya se cargaron credenciales Supabase en `.env.local`, se puede validar la conexion antes de abrir la app:

```bash
npm run check:supabase
```

## Inbox

La pantalla principal muestra una bandeja unificada con:

- mensajes de Facebook Messenger;
- DMs de Instagram;
- comentarios de publicaciones;
- comentarios de anuncios.

## Sesion

Si Supabase no esta configurado, el panel `Sesion` indica modo demo y la app guarda datos en el navegador.

Si Supabase esta configurado, se puede ingresar un email y pedir un enlace de acceso. Al abrir ese enlace, la app carga inbox, respuestas rapidas y preferencias desde el workspace personal de la cuenta.

## Filtros actuales

- `Todo`: muestra todos los items demo.
- `Facebook`: muestra items de Facebook.
- `Instagram`: muestra items de Instagram.
- Busqueda: filtra por contacto, usuario, titulo o texto visible.
- `Cuentas visibles`: permite mostrar u ocultar cuentas conectadas individuales.
- `Mostrar todas`: vuelve a activar todas las cuentas ocultas.
- Cada fila del inbox muestra plataforma, cuenta conectada y tipo de origen: comentario organico, comentario de anuncio, Messenger o Instagram DM.
- Los checkboxes permiten seleccionar conversaciones individuales o todas las visibles.
- `Bandeja`: muestra conversaciones pendientes/no respondidas; solo aqui se muestra cantidad, basada en no leidos.
- `Respondidos`: muestra conversaciones ya contestadas.
- `Archivados`: muestra conversaciones archivadas.

Los filtros se combinan. Por ejemplo, se puede ver solo Instagram y ademas ocultar una cuenta de Instagram especifica cuando haya varias conectadas.

## Acciones actuales

En una conversacion seleccionada se puede:

- responder;
- en comentarios, elegir si la respuesta sale sobre el comentario o por mensaje interno;
- usar una respuesta rapida;
- crear, editar y eliminar respuestas rapidas;
- abrir las opciones de la publicacion/contexto y, cuando haya URL disponible, abrir la publicacion original en otra pestana;
- reaccionar sobre el comentario/mensaje recibido desde iconos pequenos junto al mensaje;
- ocultar o mostrar el comentario desde el mensaje recibido;
- bloquear o desbloquear usuario desde la cabecera del autor;
- eliminar respuestas enviadas desde la app;
- archivar;
- desarchivar desde la vista `Archivados`.
- marcar leido/no leido desde la barra de seleccion.

En modo demo, las acciones se registran contra `/api/inbox/action` y actualizan la interfaz local. En modo Supabase, responder, like/unlike, ocultar/mostrar, bloquear/desbloquear, archivar, desarchivar y marcar leido/no leido tambien actualizan las tablas del workspace. Para comentarios Facebook reales, responder sobre comentario, responder por mensaje interno, like/unlike y ocultar/mostrar ya intentan ejecutarse contra Meta usando el page token server-side. Bloquear/desbloquear usuario sigue siendo estado interno hasta cablear el endpoint Meta correspondiente. Las reacciones visuales multiples usan por ahora la persistencia `like/unlike`; para enviar reacciones diferenciadas a Meta hace falta ampliar la accion server-side.

Cuando el item es comentario, el selector del composer muestra:

- `Responder sobre comentario`: prepara respuesta publica en el hilo del comentario. En Facebook, la app tambien intenta enviar una copia del mismo texto por mensaje interno para notificacion directa.
- `Responder por mensaje interno`: prepara respuesta privada por Messenger en Facebook o DM en Instagram.

Al responder una conversacion, sale de `Bandeja` y pasa a `Respondidos`. Las conversaciones archivadas salen de la bandeja principal y quedan reunidas en `Archivados`. Desde esa vista se pueden desarchivar.

## Mensajes con emojis y adjuntos

- Los emojis escritos dentro de comentarios, Messenger o Instagram DM se muestran como texto normal.
- Si Messenger o Instagram DM envian un adjunto sin texto, la app muestra una etiqueta legible: `Audio recibido`, `Imagen recibida`, `GIF recibido`, `Video recibido`, `Archivo recibido` o `Sticker recibido`.
- Si Meta envia un contenido no soportado sin tipo de adjunto, se muestra `Mensaje no compatible recibido` para que no parezca que no llego nada.

## Uso en celular

En mobile, el bloque de cuentas/configuracion aparece comprimido arriba. Se puede expandir con el icono de flecha cuando hace falta cambiar cuentas, conectar Meta o revisar configuracion.

La pantalla principal del celular muestra la bandeja. Al tocar una conversacion, la app abre la vista de respuesta a pantalla completa y muestra `Volver a bandeja` para regresar a la lista.

## Respuestas rapidas

El boton con icono de destellos junto al composer abre el panel `Respuestas rapidas`. Permite:

- insertar una respuesta guardada en el composer;
- crear una respuesta con titulo, categoria, texto y tags;
- editar respuestas existentes;
- eliminar respuestas que ya no sirven.

En modo demo, las respuestas quedan guardadas en el navegador. Con sesion Supabase, se guardan en `quick_replies`.

El boton con cara junto a `Archivar` abre una paleta breve de emojis e inserta el emoji elegido al final del texto del composer.

## Cuentas conectadas

La app muestra cuentas conectadas en el panel izquierdo. En modo demo salen del fixture local; con sesion activa salen de `connected_accounts` en Supabase. Cada cuenta tiene un ojo para decidir si sus conversaciones aparecen en el inbox.
Cada cuenta muestra una etiqueta de plataforma, por ejemplo `Facebook` o `Instagram`, para distinguir cuentas con nombres parecidos.
El ojo de la cabecera permite mostrar u ocultar todas las cuentas. El menu de tres puntos de cada cuenta permite abrir configuracion o eliminar la cuenta. El boton `Anadir cuenta` abre la configuracion Meta/OAuth.

La preferencia queda guardada en el navegador sin sesion y en `user_preferences` con sesion Supabase.

Las cuentas pueden aparecer como:

- `Real`: Meta devolvio page token y la app lo guardo cifrado.
- `Pendiente`: Meta devolvio la pagina, pero no devolvio page token.
- `Demo`: fixture local usado para probar la experiencia.

Desde el panel de cuentas se puede desconectar una cuenta no deseada con el icono de eliminar. Esto la quita del workspace y de la bandeja.

El mismo panel muestra `Autores bloqueados`. Desde ahi se puede ver cada autor bloqueado por cuenta y desbloquearlo sin buscar la conversacion original. En Facebook, la app intenta bloquear/desbloquear primero en Meta y solo actualiza el estado local si Meta confirma la accion.

## Configuracion Meta

El boton `Conectar cuenta Meta` abre el panel de configuracion. Ahi se ve:

- callback URL para configurar en Meta Developers;
- permisos objetivo de la integracion;
- diagnostico de cuentas reales vs demo;
- diagnostico de capacidades por scopes concedidos;
- boton `Iniciar OAuth Meta`.
- boton `Sincronizar comentarios FB` para importar comentarios organicos cuando `pages_read_engagement` y `pages_read_user_content` esten concedidos.
- boton `Sincronizar comentarios IG` para diagnosticar manualmente comentarios Instagram cuando `instagram_basic` e `instagram_manage_comments` esten concedidos.
- boton `Diagnosticar Ads` para confirmar que Marketing API ve cuentas publicitarias con `ads_read`.
- boton `Sincronizar comentarios Ads` para importar comentarios de anuncios detectables por Marketing API y guardarlos como `Comentario ad`.
- Las sincronizaciones de comentarios solo traen las ultimas 72 horas; la app no importa historicos por defecto.
- actualizacion de bandeja por Supabase Realtime cuando entra o cambia una conversacion;
- auto-sincronizacion de comentarios Facebook cada 5 segundos mientras la app esta abierta y los permisos esten listos.
- auto-sincronizacion de comentarios Instagram cada 10 segundos mientras la app esta abierta y `instagram_basic` + `instagram_manage_comments` esten listos.
- auto-sincronizacion completa de comentarios Ads cada 30 segundos mientras la app esta abierta y `ads_read` este listo. El boton manual queda como respaldo de diagnostico, no como paso operativo obligatorio.

El OAuth local pide permisos minimos por defecto para validar el retorno de Meta. Al volver desde Meta, la app muestra cuantas paginas Facebook e Instagram quedaron detectadas y guarda las cuentas reales en Supabase.
Si se seleccionan varias paginas en Meta pero Graph devuelve menos, la app solo puede guardar las paginas recibidas por `/me/accounts`. Con permisos minimos puede aparecer solo un subconjunto.

La auto-sincronizacion local evita depender del boton manual durante desarrollo, pero no reemplaza los webhooks. Para recibir eventos aunque la app no este abierta, se debe publicar la app en una URL HTTPS, configurar Webhooks Meta y tener `inbox_items` habilitado en Supabase Realtime para pintar los cambios en pantalla.

Para conversaciones por mensaje interno de Facebook, Meta debe tener activo el campo webhook Page `messages`. Los comentarios organicos/ad entran por `feed`; las respuestas del usuario dentro de Messenger entran por `messages`. En el panel `Diagnosticar webhooks`, `App Page fields` debe mostrar `feed + messages`.

Para Instagram, Meta debe tener concedidos `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages` y, para reacciones, `instagram_manage_engagement`. Despues de agregarlos en Meta Login Configuration hay que repetir OAuth para que Supabase guarde esos scopes en las cuentas conectadas.
Para Instagram DM, ademas de scopes, Meta Developers debe tener Webhooks con objeto `Instagram` y campo `messages` activo. En `Diagnosticar webhooks`, el bloque `Instagram Webhooks / DM` debe mostrar `comments + messages`; si muestra `Incompleto`, entra a Meta Developers > Webhooks, selecciona `Instagram` y suscribe `messages`.
Si al responder por DM aparece `(#3) Application does not have the capability`, revisa en App Review / Permissions and Features que `instagram_manage_messages` tenga acceso avanzado y que la capacidad de Instagram Messaging este disponible para la app.

En comentarios, las acciones junto al mensaje recibido permiten dar like, ocultar/mostrar y eliminar. Eliminar comentario borra primero en Meta y solo retira la conversacion local cuando Meta confirma.
En DM Instagram, la app intenta resolver el nombre del autor con el IGSID recibido por webhook. En comentarios de Ads, si Meta no devuelve `from` en la lectura del post ni en la consulta directa del comentario, la app muestra `Autor pendiente` y mantiene el comentario accionable hasta que exista una ruta soportada para enriquecer esa identidad.
En Instagram, responder sobre comentario publica una respuesta publica. Responder por DM usa Instagram Messaging y puede requerir una capacidad adicional habilitada por Meta, aunque el scope `instagram_manage_messages` ya este concedido.

## Limitaciones actuales

- Con `pages_show_list`, Meta puede detectar paginas, pero no garantiza comentarios, ads ni DMs hasta ampliar permisos.
- Para leer comentarios organicos de Facebook hacen falta `pages_read_engagement` y `pages_read_user_content`, y luego reautorizar OAuth.
- Los datos del inbox autenticado todavia son seed demo en Supabase hasta conectar Meta real.
- Las acciones se guardan en Supabase, pero todavia no se envian a Meta real sin OAuth/tokens.
- Las respuestas rapidas y preferencias se guardan en el navegador si no hay sesion Supabase.
- Supabase registra acciones y webhooks solo cuando se configuran las variables de entorno.
