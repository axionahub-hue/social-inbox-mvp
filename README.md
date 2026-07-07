# Social Inbox MVP

App web responsive para administrar en una bandeja unica mensajes, DMs y comentarios de Facebook e Instagram.

## Estado

- Next.js App Router con TypeScript.
- UI operativa en modo demo y modo Supabase autenticado.
- Contratos de dominio para inbox, comentarios, mensajes, cuentas y respuestas rapidas.
- Filtros combinados por busqueda, red social y cuentas conectadas visibles/ocultas.
- Inbox autenticado lee `connected_accounts`, `contacts`, `inbox_items` e `inbox_messages` desde Supabase, con seed demo por workspace.
- Respuestas rapidas con crear, editar, eliminar, insertar y persistencia local/Supabase.
- Auth interna validada con Supabase email OTP y fallback demo local.
- RLS inicial por workspace/usuario en el esquema de Supabase.
- Endpoint de acciones preparado para responder, like/unlike, ocultar/mostrar, bloquear, archivar y desarchivar.
- Endpoint para desconectar cuentas Meta no deseadas del workspace.
- Endpoint de webhook Meta con verificacion de challenge y firma `x-hub-signature-256`.
- Callback OAuth Meta intercambia `code`, cifra tokens server-side y guarda cuentas detectadas.
- Sincronizacion manual de comentarios organicos de Facebook cuando `pages_read_engagement` esta concedido.
- Esquema inicial de Supabase en `supabase/schema.sql`.

## Documentacion operativa

- `docs/architecture.md`: arquitectura y reglas de infraestructura.
- `docs/api.md`: API propia de la app y contratos de endpoints.
- `docs/user-guide.md`: guia de uso de la app.
- `docs/programming-log.md`: bitacora de programacion y verificaciones.
- `docs/account-filter-plan.md`: plan para filtrar por cuentas conectadas visibles/ocultas.
- `docs/supabase-setup.md`: guia operativa para conectar Supabase real.
- `docs/meta-setup.md`: guia operativa para preparar OAuth Meta.
- `docs/work-directive.md`: pautas para no trabajar de memoria.
- `docs/documentation-directive.md`: directiva para mantener documentacion viva.

## Ejecutar local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3100`.

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar cuando existan credenciales:

```bash
cp .env.example .env.local
```

Sin credenciales, la app corre en modo demo. Con Supabase configurado, la UI autenticada carga inbox, respuestas rapidas y preferencias desde el workspace personal.
Los endpoints tambien pueden registrar eventos y acciones cuando Supabase esta configurado.

Validar configuracion Supabase:

```bash
npm run check:supabase
```

## Supabase

1. Crear proyecto Supabase.
2. Ejecutar `supabase/schema.sql` en SQL Editor.
3. Configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.
4. En Supabase Auth, configurar la URL del sitio local como `http://localhost:3100` y luego la URL de Vercel cuando exista deploy.
5. En produccion, cifrar tokens de Meta antes de guardarlos en `connected_accounts.access_token_encrypted`.

Detalle operativo: `docs/supabase-setup.md`.

## Meta

La app esta preparada para conectar:

- Facebook Page Messenger.
- Instagram Messaging.
- Comentarios organicos.
- Comentarios de ads.

El OAuth local pide `pages_show_list` por defecto para validar el flujo sin bloquearse por permisos avanzados. La lista se puede ampliar con `META_OAUTH_SCOPES` cuando Meta habilite los permisos necesarios para la app. Si se configura `META_LOGIN_CONFIG_ID`, el login usa una configuracion de Facebook Login for Business.

El callback intercambia el `code` por token, intenta extenderlo, lee paginas disponibles e Instagram profesional conectado, y guarda cuentas en `connected_accounts`. Si el token incluye `business_management`, tambien intenta descubrir paginas desde Business Manager. Los page tokens se guardan cifrados con `META_TOKEN_ENCRYPTION_KEY` o, en desarrollo, con `META_APP_SECRET` como fallback server-side.

Permisos objetivo para la primera integracion real:

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_engagement`
- `pages_messaging`
- `pages_manage_metadata`
- `business_management`
- `instagram_basic`
- `instagram_manage_comments`
- `instagram_manage_messages`

Webhook callback:

```text
https://TU-DOMINIO/api/meta/webhook
```

OAuth callback:

```text
https://TU-DOMINIO/api/meta/oauth/callback
```

## Vercel

Este proyecto puede desplegarse en Vercel Hobby para uso personal y validacion. Para uso comercial, revisar terminos y limites del plan antes de pasar a produccion.

## Proximos pasos tecnicos

1. Agregar `pages_read_engagement`, reautorizar OAuth y probar sincronizacion real de comentarios.
2. Ampliar permisos para responder/moderar con `pages_manage_engagement`.
3. Suscribir webhooks reales de Page/Instagram.
4. Agregar tests de acciones Meta y parsing de webhooks.
