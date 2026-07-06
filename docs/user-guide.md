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

## Filtros actuales

- `Todo`: muestra todos los items demo.
- `Facebook`: muestra items de Facebook.
- `Instagram`: muestra items de Instagram.
- Busqueda: filtra por contacto, usuario, titulo o texto visible.

## Acciones actuales

En una conversacion seleccionada se puede:

- responder;
- usar una respuesta rapida;
- dar o quitar like;
- ocultar o mostrar;
- bloquear usuario;
- archivar visualmente.

En modo demo, las acciones se registran contra `/api/inbox/action` y actualizan la interfaz local.

## Cuentas conectadas

La app ya muestra cuentas conectadas demo en el panel izquierdo. El proximo paso funcional es permitir que cada cuenta pueda mostrarse u ocultarse del inbox con toggles individuales.

## Limitaciones actuales

- No hay OAuth real de Meta todavia.
- No hay login interno todavia.
- Los datos del inbox son demo.
- Supabase registra acciones y webhooks solo cuando se configuran las variables de entorno.
