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

Los filtros se combinan. Por ejemplo, se puede ver solo Instagram y ademas ocultar una cuenta de Instagram especifica cuando haya varias conectadas.

## Acciones actuales

En una conversacion seleccionada se puede:

- responder;
- usar una respuesta rapida;
- crear, editar y eliminar respuestas rapidas;
- dar o quitar like;
- ocultar o mostrar;
- bloquear usuario;
- archivar;
- desarchivar desde la vista `Archivados`.

En modo demo, las acciones se registran contra `/api/inbox/action` y actualizan la interfaz local. En modo Supabase, responder, like/unlike, ocultar/mostrar, bloquear, archivar y desarchivar tambien actualizan las tablas del workspace.

Las conversaciones archivadas salen de la bandeja principal y quedan reunidas en `Archivados`. Desde esa vista se pueden desarchivar.

## Respuestas rapidas

El boton con icono de destellos junto al composer abre el panel `Respuestas rapidas`. Permite:

- insertar una respuesta guardada en el composer;
- crear una respuesta con titulo, categoria, texto y tags;
- editar respuestas existentes;
- eliminar respuestas que ya no sirven.

En modo demo, las respuestas quedan guardadas en el navegador. Con sesion Supabase, se guardan en `quick_replies`.

## Cuentas conectadas

La app muestra cuentas conectadas en el panel izquierdo. En modo demo salen del fixture local; con sesion activa salen de `connected_accounts` en Supabase. Cada cuenta tiene un toggle para decidir si sus conversaciones aparecen en el inbox.

La preferencia queda guardada en el navegador sin sesion y en `user_preferences` con sesion Supabase.

## Configuracion Meta

El boton `Conectar cuenta Meta` abre el panel de configuracion. Ahi se ve:

- callback URL para configurar en Meta Developers;
- permisos esperados;
- boton `Iniciar OAuth Meta`.

El OAuth queda preparado, pero la app todavia no guarda tokens reales hasta implementar cifrado server-side.

## Limitaciones actuales

- OAuth Meta esta preparado hasta recepcion de `code`, pero todavia no guarda tokens ni cuentas reales.
- Los datos del inbox autenticado todavia son seed demo en Supabase hasta conectar Meta real.
- Las acciones se guardan en Supabase, pero todavia no se envian a Meta real sin OAuth/tokens.
- Las respuestas rapidas y preferencias se guardan en el navegador si no hay sesion Supabase.
- Supabase registra acciones y webhooks solo cuando se configuran las variables de entorno.
