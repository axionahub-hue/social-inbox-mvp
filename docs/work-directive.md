# Directiva de trabajo

## Proposito

Evitar trabajar de memoria. Cada cambio debe partir del estado real del repositorio, de la app ejecutable y de las restricciones actuales del producto.

## Regla principal

Antes de cambiar codigo, leer el estado actual. No asumir que el ultimo comentario, una respuesta anterior o una idea del plan siguen siendo verdad.

## Inicio obligatorio de una sesion

- [ ] Ejecutar `git status -sb`.
- [ ] Leer `README.md`.
- [ ] Leer `docs/architecture.md`.
- [ ] Leer `docs/documentation-directive.md`.
- [ ] Leer `docs/api.md` si el cambio toca endpoints, acciones, webhooks o integraciones.
- [ ] Leer `docs/user-guide.md` si el cambio toca flujos de uso o UI.
- [ ] Si el cambio toca filtros por cuenta, leer `docs/account-filter-plan.md`.
- [ ] Buscar el area afectada con `rg` antes de editar.
- [ ] Abrir los archivos reales que se van a modificar.
- [ ] Confirmar scripts disponibles en `package.json`.

## Pautas de implementacion

- Mantener el MVP simple, pero sin atajos que creen deuda estructural.
- Separar demo, Supabase y Meta mediante contratos claros.
- Las acciones contra Meta deben seguir pasando por API server-side.
- No exponer tokens ni secretos en el cliente.
- No usar nombres visibles como fuente de verdad cuando exista un ID.
- No introducir librerias nuevas si el problema se resuelve bien con el stack actual.
- No cambiar puertos sin actualizar `package.json`, `.env.example` y `README.md`.
- No cerrar cambios con documentacion desactualizada.
- Tratar la documentacion como parte del producto, no como apunte externo.
- No tocar archivos ajenos al alcance del cambio.

## Verificacion obligatoria

- [ ] Ejecutar `npm run lint`.
- [ ] Ejecutar `npm run build`.
- [ ] Si se cambia UI, abrir la app en `http://localhost:3100`.
- [ ] Revisar mobile o al menos validar que no haya overflow horizontal.
- [ ] Si se cambian endpoints, probarlos por HTTP.
- [ ] Buscar textos o referencias viejas con `rg`.
- [ ] Revisar `git diff --check`.
- [ ] Actualizar `docs/programming-log.md` cuando el cambio sea relevante.
- [ ] Confirmar si `docs/architecture.md`, `docs/api.md` o `docs/user-guide.md` necesitan cambios.

## GitHub

- Todo cambio aceptado debe quedar comiteado y pusheado.
- No hacer commits con secretos.
- Usar mensajes de commit concretos y cortos.
- Confirmar el estado final con `git status -sb`.

## Definicion de hecho

Un cambio esta hecho solo cuando:

- el codigo esta implementado;
- las docs afectadas estan actualizadas;
- la bitacora registra cambios relevantes;
- lint y build pasan;
- el comportamiento principal fue verificado;
- el commit esta en GitHub;
- el resumen final dice exactamente que se cambio y que se valido.
