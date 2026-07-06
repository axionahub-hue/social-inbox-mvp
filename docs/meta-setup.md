# Setup Meta

## Objetivo

Preparar la conexion OAuth de Facebook/Instagram sin guardar tokens sin cifrar. Este bloque deja listo el inicio de OAuth, callback y permisos esperados; el intercambio y persistencia de tokens reales queda para el siguiente bloque con cifrado.

## Estado actual

- La UI tiene un panel `Configuracion Meta`.
- El panel muestra la callback URL que debe cargarse en Meta Developers.
- `POST /api/meta/oauth/start` valida sesion Supabase y construye la URL OAuth.
- `GET /api/meta/oauth/callback` valida `state` firmado y detecta que Meta devolvio `code`.
- No se guardan tokens Meta todavia.

## Variables de entorno

```env
META_APP_ID=
META_APP_SECRET=
META_GRAPH_VERSION=v25.0
META_WEBHOOK_VERIFY_TOKEN=
```

## Callback local

```text
http://localhost:3100/api/meta/oauth/callback
```

En Vercel se debe reemplazar por:

```text
https://TU-DOMINIO/api/meta/oauth/callback
```

## Permisos esperados

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_engagement`
- `pages_messaging`
- `pages_manage_metadata`
- `instagram_basic`
- `instagram_manage_comments`
- `instagram_manage_messages`

## Checklist operativo

1. Crear o abrir app en Meta Developers.
2. Configurar Facebook Login para web.
3. Agregar la callback URL local o de Vercel.
4. Completar `META_APP_ID` y `META_APP_SECRET` en `.env.local` o Vercel.
5. Validar `GET /api/health`: `meta` debe pasar de `demo` a `configured`.
6. Iniciar sesion Supabase en la app.
7. Abrir `Configuracion Meta`.
8. Tocar `Iniciar OAuth Meta`.

## Siguiente bloque tecnico

- Agregar cifrado de tokens server-side.
- Intercambiar `code` por access token en callback.
- Obtener paginas/cuentas disponibles.
- Guardar cuentas reales en `connected_accounts`.
- Mantener tokens fuera del cliente.

## Referencias oficiales

- Manual OAuth/Login flow: https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow
- Access tokens: https://developers.facebook.com/documentation/facebook-login/guides/access-tokens
- Long-lived tokens: https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived
