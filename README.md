# Social Inbox MVP

App web responsive para administrar en una bandeja unica mensajes, DMs y comentarios de Facebook e Instagram.

## Estado

- Next.js App Router con TypeScript.
- UI operativa en modo demo.
- Contratos de dominio para inbox, comentarios, mensajes, cuentas y respuestas rapidas.
- Filtros combinados por busqueda, red social y cuentas conectadas visibles/ocultas.
- Respuestas rapidas con crear, editar, eliminar, insertar y persistencia local.
- Auth interna preparada con Supabase email OTP y fallback demo local.
- RLS inicial por workspace/usuario en el esquema de Supabase.
- Endpoint de acciones preparado para responder, like/unlike, ocultar/mostrar y bloquear.
- Endpoint de webhook Meta con verificacion de challenge y firma `x-hub-signature-256`.
- Esquema inicial de Supabase en `supabase/schema.sql`.

## Documentacion operativa

- `docs/architecture.md`: arquitectura y reglas de infraestructura.
- `docs/api.md`: API propia de la app y contratos de endpoints.
- `docs/user-guide.md`: guia de uso de la app.
- `docs/programming-log.md`: bitacora de programacion y verificaciones.
- `docs/account-filter-plan.md`: plan para filtrar por cuentas conectadas visibles/ocultas.
- `docs/supabase-setup.md`: guia operativa para conectar Supabase real.
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

Sin credenciales, la app corre en modo demo. Con Supabase configurado, los endpoints empiezan a registrar eventos y acciones.
Con Supabase configurado, el panel `Sesion` permite enviar un enlace de acceso por email y guardar respuestas rapidas/preferencias en la cuenta.

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

Permisos esperados para la primera integracion real:

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_engagement`
- `pages_messaging`
- `pages_manage_metadata`
- `instagram_basic`
- `instagram_manage_comments`
- `instagram_manage_messages`

Webhook callback:

```text
https://TU-DOMINIO/api/meta/webhook
```

## Vercel

Este proyecto puede desplegarse en Vercel Hobby para uso personal y validacion. Para uso comercial, revisar terminos y limites del plan antes de pasar a produccion.

## Proximos pasos tecnicos

1. Crear el proyecto Supabase real, aplicar `supabase/schema.sql` y probar login email OTP con credenciales.
2. Migrar inbox demo a lectura real desde Supabase.
3. Implementar OAuth Meta real.
4. Mapear eventos webhook a `inbox_items` e `inbox_messages`.
5. Crear pantalla de configuracion de cuentas conectadas.
6. Agregar tests de acciones Meta y parsing de webhooks.
