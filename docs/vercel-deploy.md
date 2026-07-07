# Despliegue en Vercel

## Objetivo

Publicar la app en una URL HTTPS estable para:

- usar OAuth Meta fuera de `localhost`;
- configurar Webhooks Meta reales;
- configurar Supabase Auth con una URL publica;
- validar el flujo mobile/desktop con datos reales.

## Precondiciones

- Repo GitHub actualizado.
- Proyecto Supabase creado y con `supabase/schema.sql` ejecutado.
- App Meta creada.
- Variables locales validadas en `.env.local`.

## Crear proyecto Vercel

1. Entrar a Vercel.
2. Importar el repo `social-inbox-mvp` desde GitHub.
3. Framework preset: `Next.js`.
4. Build command: `npm run build`.
5. Output: default de Next.js.
6. Deploy.

## Variables de entorno en Vercel

Configurar en Project Settings > Environment Variables:

```env
NEXT_PUBLIC_APP_URL=https://TU-DOMINIO-VERCEL
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
META_APP_ID=
META_APP_SECRET=
META_GRAPH_VERSION=v25.0
META_LOGIN_CONFIG_ID=
META_OAUTH_SCOPES=pages_show_list,pages_manage_metadata,business_management,pages_read_engagement,pages_read_user_content
META_TOKEN_ENCRYPTION_KEY=
META_WEBHOOK_VERIFY_TOKEN=
```

Notas:

- `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_SECRET` y `META_TOKEN_ENCRYPTION_KEY` son secretos server-side. Nunca deben quedar en cliente, screenshots o commits.
- `META_TOKEN_ENCRYPTION_KEY` debe ser una clave larga dedicada para produccion. No reutilizar contrasenas personales.
- `NEXT_PUBLIC_APP_URL` debe coincidir con la URL publica que se usara en Meta y Supabase.

## URLs resultantes

Con `NEXT_PUBLIC_APP_URL=https://TU-DOMINIO-VERCEL`, las URLs son:

```text
OAuth callback:
https://TU-DOMINIO-VERCEL/api/meta/oauth/callback

Webhook callback:
https://TU-DOMINIO-VERCEL/api/meta/webhook
```

## Configurar Supabase Auth

En Supabase:

1. Authentication > URL Configuration.
2. Site URL:

```text
https://TU-DOMINIO-VERCEL
```

3. Redirect URLs:

```text
https://TU-DOMINIO-VERCEL/**
http://localhost:3100/**
```

Mantener localhost permite seguir probando localmente.

## Configurar Meta OAuth

En Meta Developers:

1. Abrir la app.
2. Ir a Facebook Login for Business o configuracion OAuth web.
3. Agregar URI de redireccion valida:

```text
https://TU-DOMINIO-VERCEL/api/meta/oauth/callback
```

4. Verificar que `META_LOGIN_CONFIG_ID` en Vercel sea el mismo Configuration ID usado para permisos avanzados.
5. Reautorizar desde la app desplegada.

## Configurar Meta Webhooks

En Meta Developers:

1. Ir a Webhooks.
2. Seleccionar objeto `Page`.
3. Callback URL:

```text
https://TU-DOMINIO-VERCEL/api/meta/webhook
```

4. Verify token:

```text
META_WEBHOOK_VERIFY_TOKEN
```

5. Suscribirse al campo `feed` para comentarios de pagina.
6. Reautorizar OAuth desde la app desplegada. El callback intenta suscribir automaticamente cada pagina con page token a `/{page-id}/subscribed_apps`.
7. Si no entran eventos, comprobar en Graph que cada pagina tenga la app suscrita al campo `feed`.

## Validaciones despues del deploy

1. Abrir:

```text
https://TU-DOMINIO-VERCEL/api/health
```

Debe responder:

```json
{
  "ok": true,
  "services": {
    "supabase": "configured",
    "meta": "configured"
  }
}
```

2. Iniciar sesion por email OTP.
3. Abrir Configuracion Meta.
4. Ejecutar OAuth desde la URL de Vercel.
5. Confirmar que las cuentas reales aparecen como `Real` y que el mensaje OAuth reporte `Webhooks feed suscritos`.
6. En Meta, enviar un evento de prueba o comentar una publicacion real.
7. Verificar que el evento aparezca en `webhook_events`.
8. Verificar que un comentario nuevo se normalice a `inbox_items` e `inbox_messages`.

## Estado actual del procesamiento webhook

- `GET /api/meta/webhook` valida challenge con `META_WEBHOOK_VERIFY_TOKEN`.
- `POST /api/meta/webhook` valida firma `x-hub-signature-256`.
- Guarda el evento crudo en `webhook_events`.
- Procesa cambios `Page/feed` con `item = comment` y `verb = add|edited`.
- Busca la pagina en `connected_accounts` por `provider_account_id`.
- Usa el page token cifrado para enriquecer comentario y publicacion.
- Persiste el comentario en la misma estructura de inbox usada por la sincronizacion manual.

## Pendientes despues de Vercel

- Probar evento real entrante desde Meta.
- Cablear respuestas reales con `pages_manage_engagement`.
- Cablear private replies/Messenger/Instagram DM segun permisos.
- Agregar almacenamiento de `permalink_url` exacto si se decide ampliar schema.
