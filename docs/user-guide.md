# Guia de uso

## Ejecutar la app

```bash
npm install
npm run dev
```

Abrir `http://localhost:3100`.

## Inbox

La pantalla principal muestra una bandeja unificada con:

- mensajes de Facebook Messenger;
- DMs de Instagram;
- comentarios de publicaciones;
- comentarios de anuncios.

## Sesion

Si Supabase no esta configurado, el panel `Sesion` indica modo demo y la app guarda datos en el navegador.

Si Supabase esta configurado, se puede ingresar un email y pedir un enlace de acceso. Al abrir ese enlace, la app guarda respuestas rapidas y preferencias en el workspace personal de la cuenta.

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
- archivar visualmente.

En modo demo, las acciones se registran contra `/api/inbox/action` y actualizan la interfaz local.

## Respuestas rapidas

El bloque `Respuestas rapidas` aparece sobre el composer. Permite:

- insertar una respuesta guardada en el composer;
- crear una respuesta con titulo, categoria, texto y tags;
- editar respuestas existentes;
- eliminar respuestas que ya no sirven.

En modo demo, las respuestas quedan guardadas en el navegador. Con sesion Supabase, se guardan en `quick_replies`.

## Cuentas conectadas

La app muestra cuentas conectadas demo en el panel izquierdo. Cada cuenta tiene un toggle para decidir si sus conversaciones aparecen en el inbox. La preferencia queda guardada en el navegador.

## Limitaciones actuales

- No hay OAuth real de Meta todavia.
- Los datos del inbox son demo.
- El login Supabase necesita credenciales y configuracion Auth real para operar fuera del modo demo.
- Las respuestas rapidas y preferencias se guardan en el navegador si no hay sesion Supabase.
- Supabase registra acciones y webhooks solo cuando se configuran las variables de entorno.
