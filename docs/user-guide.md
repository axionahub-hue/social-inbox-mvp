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
- archivar;
- desarchivar desde la vista `Archivados`.
- marcar leido/no leido desde la barra de seleccion.

En modo demo, las acciones se registran contra `/api/inbox/action` y actualizan la interfaz local. En modo Supabase, responder, like/unlike, ocultar/mostrar, bloquear/desbloquear, archivar, desarchivar y marcar leido/no leido tambien actualizan las tablas del workspace. Las reacciones visuales multiples usan por ahora la persistencia `like/unlike`; para enviar reacciones diferenciadas a Meta hace falta ampliar la accion server-side.

Cuando el item es comentario, el selector del composer muestra:

- `Responder sobre comentario`: prepara respuesta publica en el hilo del comentario y deja listo el dato para etiquetar/notificar al autor cuando el cableado Meta lo permita.
- `Responder por mensaje interno`: prepara respuesta privada por Messenger en Facebook o DM en Instagram.

Las conversaciones archivadas salen de la bandeja principal y quedan reunidas en `Archivados`. Desde esa vista se pueden desarchivar.

## Respuestas rapidas

El boton con icono de destellos junto al composer abre el panel `Respuestas rapidas`. Permite:

- insertar una respuesta guardada en el composer;
- crear una respuesta con titulo, categoria, texto y tags;
- editar respuestas existentes;
- eliminar respuestas que ya no sirven.

En modo demo, las respuestas quedan guardadas en el navegador. Con sesion Supabase, se guardan en `quick_replies`.

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

## Configuracion Meta

El boton `Conectar cuenta Meta` abre el panel de configuracion. Ahi se ve:

- callback URL para configurar en Meta Developers;
- permisos objetivo de la integracion;
- diagnostico de cuentas reales vs demo;
- diagnostico de capacidades por scopes concedidos;
- boton `Iniciar OAuth Meta`.
- boton `Sincronizar comentarios FB` para importar comentarios organicos cuando `pages_read_engagement` y `pages_read_user_content` esten concedidos.
- auto-sincronizacion de comentarios Facebook cada 15 segundos mientras la app esta abierta y los permisos esten listos.

El OAuth local pide permisos minimos por defecto para validar el retorno de Meta. Al volver desde Meta, la app muestra cuantas paginas Facebook e Instagram quedaron detectadas y guarda las cuentas reales en Supabase.
Si se seleccionan varias paginas en Meta pero Graph devuelve menos, la app solo puede guardar las paginas recibidas por `/me/accounts`. Con permisos minimos puede aparecer solo un subconjunto.

La auto-sincronizacion local evita depender del boton manual durante desarrollo, pero no reemplaza los webhooks. Para recibir eventos aunque la app no este abierta, se debe publicar la app en una URL HTTPS y configurar Webhooks Meta.

## Limitaciones actuales

- Con `pages_show_list`, Meta puede detectar paginas, pero no garantiza comentarios, ads ni DMs hasta ampliar permisos.
- Para leer comentarios organicos de Facebook hacen falta `pages_read_engagement` y `pages_read_user_content`, y luego reautorizar OAuth.
- Los datos del inbox autenticado todavia son seed demo en Supabase hasta conectar Meta real.
- Las acciones se guardan en Supabase, pero todavia no se envian a Meta real sin OAuth/tokens.
- Las respuestas rapidas y preferencias se guardan en el navegador si no hay sesion Supabase.
- Supabase registra acciones y webhooks solo cuando se configuran las variables de entorno.
