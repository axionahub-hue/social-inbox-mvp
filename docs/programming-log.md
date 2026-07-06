# Bitacora de programacion

## 2026-07-06

### Base inicial del MVP

- Resumen: se creo una app Next.js con inbox unificado demo, acciones de respuesta/moderacion, cliente Meta inicial, cliente Supabase y esquema SQL.
- Areas tocadas: `src/app/page.tsx`, `src/lib/*`, `src/app/api/*`, `supabase/schema.sql`, `README.md`, `docs/architecture.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, `POST /api/inbox/action`, revision responsive desktop/mobile.
- Pendiente: conectar OAuth Meta, Supabase real y normalizacion de webhooks.

### Puerto local 3100

- Resumen: se fijo el puerto local en `3100` porque `3000` esta ocupado por otro proyecto.
- Areas tocadas: `package.json`, `.env.example`, `README.md`.
- Validacion: `npm run lint`, `npm run build`, busqueda de referencias al puerto anterior.
- Pendiente: mantener este puerto sincronizado si cambia la configuracion de desarrollo.

### Plan de filtros por cuentas conectadas

- Resumen: se documento el plan para permitir mostrar/ocultar cuentas conectadas individuales ademas del filtro Facebook/Instagram.
- Areas tocadas: `docs/account-filter-plan.md`, `docs/work-directive.md`, `README.md`.
- Validacion: `npm run lint`, `npm run build`.
- Pendiente: completado en la entrada `Filtros por cuentas conectadas`.

### Directiva de documentacion viva

- Resumen: se agrego una directiva para mantener documentacion profesional aunque el alcance sea pequeno.
- Areas tocadas: `docs/documentation-directive.md`, `docs/api.md`, `docs/user-guide.md`, `docs/programming-log.md`, `docs/work-directive.md`, `README.md`.
- Validacion: `npm run lint`, `npm run build`, `git diff --check`.
- Pendiente: actualizar la bitacora en cada cambio relevante.

### Filtros por cuentas conectadas

- Resumen: se agrego `accountId` a los items de inbox, filtros por cuentas visibles/ocultas, estado vacio y persistencia local en `localStorage`.
- Areas tocadas: `src/lib/types.ts`, `src/lib/demo-data.ts`, `src/app/page.tsx`, `README.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/account-filter-plan.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, revision desktop/mobile en `http://localhost:3100`, prueba de ocultar/mostrar cuenta conectada.
- Pendiente: persistir preferencias por usuario/workspace cuando exista autenticacion y Supabase real.

### CRUD local de respuestas rapidas

- Resumen: se agrego administracion local de respuestas rapidas con crear, editar, eliminar, insertar en composer y persistencia en `localStorage`.
- Areas tocadas: `src/app/page.tsx`, `README.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, revision desktop en `http://localhost:3100`, prueba de crear respuesta rapida e insertarla en el composer.
- Pendiente: mover persistencia a Supabase con autenticacion y validar mobile con automatizacion estable o prueba manual.

### Supabase Auth y persistencia preparada

- Resumen: se agrego login Supabase por email OTP, fallback demo local, carga/guardado de respuestas rapidas en Supabase cuando hay sesion, preferencias por usuario/workspace y RLS inicial en el esquema.
- Areas tocadas: `src/app/page.tsx`, `supabase/schema.sql`, `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/user-guide.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `GET /api/health`, revision desktop en `http://localhost:3100` sin credenciales Supabase.
- Pendiente: crear proyecto Supabase real, aplicar esquema, configurar Auth email OTP y probar flujo autenticado con credenciales reales.

### Verificacion operativa de Supabase

- Resumen: se agrego `npm run check:supabase` para validar `.env.local`, variables publicas/server y alcance REST/Auth del proyecto Supabase antes de probar login real.
- Areas tocadas: `scripts/check-supabase-config.mjs`, `package.json`, `README.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/supabase-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run check:supabase` confirma que faltan credenciales locales, `npm run lint`, `npm run build`, `git diff --check`.
- Pendiente: cargar credenciales Supabase reales, aplicar `supabase/schema.sql` y probar email OTP.

### Ajuste de validacion Supabase real

- Resumen: se ajusto `npm run check:supabase` para probar la tabla `workspaces` del schema aplicado y se ignoran archivos locales con passwords para evitar commits accidentales.
- Areas tocadas: `scripts/check-supabase-config.mjs`, `.gitignore`, `docs/supabase-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run check:supabase`, `npm run lint`, `npm run build`, `GET /api/health` con `supabase: configured`.
- Pendiente: probar login email OTP desde la UI.

### Bootstrap idempotente de workspace

- Resumen: se detecto login real Supabase activo y se corrigio una carrera de desarrollo que podia crear dos workspaces personales para el mismo usuario. Se agrego indice unico por `owner_user_id` y SQL de limpieza para entornos ya afectados.
- Areas tocadas: `src/app/page.tsx`, `supabase/schema.sql`, `supabase/fixes/2026-07-06-dedupe-personal-workspaces.sql`, `docs/architecture.md`, `docs/supabase-setup.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`, `npm run check:supabase`; se limpio un workspace duplicado sin datos asociados en el proyecto Supabase real.
- Pendiente: ejecutar `supabase/fixes/2026-07-06-dedupe-personal-workspaces.sql` en SQL Editor para crear el indice unico en la base real y confirmar siembra de respuestas rapidas luego de recargar sesion.

### Inbox Supabase con seed demo

- Resumen: se agrego carga autenticada de `connected_accounts`, `contacts`, `inbox_items` e `inbox_messages` desde Supabase, seed demo por workspace vacio, fallback local sin sesion y etiqueta visual de origen `Inbox: Supabase`/`Inbox: demo local`.
- Areas tocadas: `src/app/page.tsx`, `README.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/account-filter-plan.md`, `docs/programming-log.md`.
- Validacion: `npm run lint`, `npm run build`; conteo Supabase real con `connected_accounts: 2`, `contacts: 4`, `inbox_items: 4`, `inbox_messages: 9`, `quick_replies: 1`.
- Pendiente: persistir acciones de respuesta, like, ocultar/mostrar y bloquear sobre las tablas Supabase.
