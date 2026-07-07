# Setup Meta

## Objetivo

Preparar la conexion OAuth de Facebook/Instagram sin guardar tokens sin cifrar. El flujo inicia OAuth, valida callback, intercambia `code`, cifra page tokens y guarda cuentas detectadas en Supabase.

## Estado actual

- La UI tiene un panel `Configuracion Meta`.
- El panel muestra la callback URL que debe cargarse en Meta Developers.
- `POST /api/meta/oauth/start` valida sesion Supabase y construye la URL OAuth.
- `GET /api/meta/oauth/callback` valida `state`, intercambia token, lee paginas e Instagram vinculado y guarda cuentas.
- Los tokens se cifran server-side antes de persistirse.

## Variables de entorno

```env
META_APP_ID=
META_APP_SECRET=
META_GRAPH_VERSION=v25.0
META_LOGIN_CONFIG_ID=
META_OAUTH_SCOPES=pages_show_list
META_TOKEN_ENCRYPTION_KEY=
META_WEBHOOK_VERIFY_TOKEN=
```

`META_TOKEN_ENCRYPTION_KEY` debe usarse como clave dedicada en Vercel/produccion. En desarrollo local, si falta, la app usa `META_APP_SECRET` como fallback server-side para no guardar tokens en texto plano.

`META_LOGIN_CONFIG_ID` es opcional. Cuando exista, la app lo envia como `config_id` en OAuth para usar Facebook Login for Business.

## Callback local

```text
http://localhost:3100/api/meta/oauth/callback
```

En Vercel se debe reemplazar por:

```text
https://TU-DOMINIO/api/meta/oauth/callback
```

## Permisos OAuth de prueba

Por defecto, la app pide solo:

- `pages_show_list`

Esto evita que Meta bloquee el inicio OAuth local por permisos avanzados que todavia no esten habilitados en la app.

Para ampliar permisos sin tocar codigo, configurar `META_OAUTH_SCOPES` con valores separados por coma o espacio.

## Facebook Login for Business

Para probar permisos avanzados sin que Meta los rechace como scopes invalidos:

1. Ir a Meta Developers.
2. Abrir la app.
3. Entrar a `Inicio de sesion con Facebook para empresas`.
4. Crear o editar una configuracion.
5. Seleccionar los permisos que se van a probar, empezando por `pages_manage_metadata`.
6. Copiar el `Configuration ID`.
7. Guardarlo en `.env.local` como `META_LOGIN_CONFIG_ID`.

Luego se puede ampliar `META_OAUTH_SCOPES`, por ejemplo:

```env
META_OAUTH_SCOPES=pages_show_list,pages_manage_metadata
```

Si `/me/accounts` sigue devolviendo menos paginas que las seleccionadas en Meta, probar:

```env
META_OAUTH_SCOPES=pages_show_list,pages_manage_metadata,business_management
```

Con `business_management` concedido, la app tambien consulta `me/businesses` y las paginas `owned_pages`/`client_pages` de cada negocio.

Para empezar a leer comentarios organicos de Facebook, agregar despues:

```env
META_OAUTH_SCOPES=pages_show_list,pages_manage_metadata,business_management,pages_read_engagement,pages_read_user_content
```

Despues de reautorizar OAuth, el panel debe mostrar `Leer posts/comentarios Facebook` como `Listo` y se puede usar `Sincronizar comentarios FB`.

Para diagnosticar cuentas publicitarias y preparar comentarios de Ads, agregar tambien:

```env
META_OAUTH_SCOPES=pages_show_list,pages_manage_metadata,business_management,pages_read_engagement,pages_read_user_content,ads_read
```

Despues de cambiar scopes hay que reautorizar OAuth para que `meta_connections` guarde el user token largo con `ads_read`.

## Permisos objetivo

- `pages_show_list`
- `ads_read`
- `pages_read_engagement`
- `pages_read_user_content`
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
5. Mantener `META_OAUTH_SCOPES=pages_show_list` para la primera prueba OAuth local.
6. Validar `GET /api/health`: `meta` debe pasar de `demo` a `configured`.
7. Iniciar sesion Supabase en la app.
8. Abrir `Configuracion Meta`.
9. Tocar `Iniciar OAuth Meta`.

## Resultado esperado despues de OAuth

Al volver a la app, `Configuracion Meta` debe indicar:

- cantidad de paginas Facebook detectadas;
- nombres de hasta 10 paginas devueltas por Meta;
- cantidad de cuentas Instagram profesionales detectadas;
- scopes concedidos;
- si `business_management` permite descubrir paginas por Business Manager;
- si alguna pagina no devolvio page token.
- cuentas reales vs demo guardadas en Supabase;
- capacidades listas o pendientes segun scopes.

Con solo `pages_show_list`, es normal detectar paginas sin poder leer comentarios, ads o DMs todavia.
Si en Meta se seleccionaron varias paginas pero la app muestra menos, significa que Graph devolvio menos paginas en `/me/accounts`. Para listar y operar paginas de forma completa, Meta documenta permisos adicionales como `pages_manage_metadata` junto con `pages_show_list`; esos permisos deben habilitarse en el flujo/app antes de ampliar `META_OAUTH_SCOPES`.
La app consulta `/me/accounts` con `limit=100` y sigue la paginacion de Meta, asi que el conteo mostrado corresponde al total devuelto por Graph, no solo a la primera pagina de resultados.

## Siguiente bloque tecnico

- Ampliar `META_OAUTH_SCOPES` gradualmente segun permisos habilitados por Meta.
- Suscribir webhooks reales para Page `feed` y, luego, Instagram comments/messaging.
- Normalizar eventos webhook a inbox.
- Ejecutar acciones reales contra Meta usando page tokens cifrados.

## Webhooks y notificaciones reales

La auto-sincronizacion local sirve para desarrollo mientras la app esta abierta. Para eventos instantaneos reales, Meta necesita una URL publica HTTPS para:

```text
https://TU-DOMINIO/api/meta/webhook
```

En Meta Developers se debe configurar Webhooks para el objeto Page y suscribirse a los campos `feed` y `messages`. `feed` entrega actividad de pagina como comentarios; `messages` entrega conversaciones de Messenger. Despues tambien hay que suscribir cada Page/app con permisos suficientes; `localhost` no sirve como destino de webhook de Meta.

## Referencias oficiales

- Manual OAuth/Login flow: https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow
- Access tokens: https://developers.facebook.com/documentation/facebook-login/guides/access-tokens
- Long-lived tokens: https://developers.facebook.com/documentation/facebook-login/guides/access-tokens/get-long-lived
- Webhooks for Pages: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages/
- Webhooks Page reference: https://developers.facebook.com/docs/graph-api/webhooks/reference/page/
