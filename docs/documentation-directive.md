# Directiva de documentacion viva

## Principio

Este proyecto es pequeno, pero profesional. Pequeno significa alcance controlado, no informalidad, improvisacion ni documentacion descartable.

La documentacion debe avanzar junto con el codigo. Si una decision cambia arquitectura, API, flujo de uso, infraestructura, modelo de datos o reglas de trabajo, la documentacion afectada se actualiza en el mismo commit.

## Documentos base

- `README.md`: entrada principal del proyecto, estado actual, ejecucion local, links a documentacion y proximos pasos.
- `docs/architecture.md`: arquitectura de la app, componentes, flujo de datos, limites y reglas de infraestructura.
- `docs/api.md`: API propia de la app, endpoints internos, contratos, payloads y respuestas esperadas.
- `docs/user-guide.md`: guia de uso de la app desde la perspectiva del usuario.
- `docs/programming-log.md`: bitacora de programacion con cambios relevantes, decisiones y verificaciones.
- `docs/work-directive.md`: pautas operativas para trabajar sin memoria falsa.
- `docs/account-filter-plan.md`: plan especifico para filtros por cuentas conectadas.

## Regla de actualizacion

- Si se agrega o cambia un endpoint, actualizar `docs/api.md`.
- Si se cambia estructura, datos, servicios, integraciones o seguridad, actualizar `docs/architecture.md`.
- Si cambia como se usa la app, actualizar `docs/user-guide.md`.
- Si se completa una tarea relevante, agregar entrada en `docs/programming-log.md`.
- Si cambia una regla de trabajo, actualizar `docs/work-directive.md`.
- Si un plan deja de estar vigente, marcarlo como completado, reemplazado o desactualizado; no dejar instrucciones ambiguas.

## Checklist antes de cerrar un cambio

- [ ] `README.md` sigue describiendo el estado real.
- [ ] `docs/architecture.md` refleja la arquitectura actual.
- [ ] `docs/api.md` refleja los endpoints actuales.
- [ ] `docs/user-guide.md` permite usar la app sin leer codigo.
- [ ] `docs/programming-log.md` tiene una entrada del cambio si corresponde.
- [ ] Los planes especificos siguen alineados con el codigo.
- [ ] No hay contradicciones entre docs y comportamiento real.

## Formato de bitacora

Cada entrada de `docs/programming-log.md` debe incluir:

- fecha;
- resumen del cambio;
- archivos o areas tocadas;
- validacion ejecutada;
- pendiente o proximo paso si aplica.

## Nivel esperado

La documentacion debe ser suficientemente clara para que otra sesion de Codex o un desarrollador pueda continuar sin reconstruir contexto desde el historial del chat.
