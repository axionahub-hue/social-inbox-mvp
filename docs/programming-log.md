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
