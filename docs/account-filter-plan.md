# Plan operativo: filtros por cuentas conectadas

## Objetivo

Permitir que el usuario elija que cuentas conectadas quiere mostrar u ocultar en el inbox, ademas del filtro general por red social. El filtro debe servir igual para modo demo y para datos reales de Supabase/Meta.

## Regla de producto

El inbox no debe filtrar solamente por `facebook` o `instagram`. La unidad real de trabajo es la cuenta conectada: una pagina de Facebook, una cuenta profesional de Instagram, o cualquier activo Meta que se agregue despues.

## Checklist operativo

- [ ] Confirmar el modelo actual leyendo `src/lib/types.ts`, `src/lib/demo-data.ts` y `src/app/page.tsx`.
- [ ] Verificar si `InboxItem` tiene un identificador estable de cuenta conectada.
- [ ] Si falta, agregar `accountId` a `InboxItem` y poblarlo en `src/lib/demo-data.ts`.
- [ ] Mantener `network` como filtro rapido, pero no usarlo como unica segmentacion.
- [ ] Agregar estado UI para cuentas visibles, por ejemplo `visibleAccountIds`.
- [ ] Renderizar una lista de cuentas conectadas con toggle mostrar/ocultar.
- [ ] Permitir combinacion de filtros: busqueda textual + red + cuentas visibles.
- [ ] Evitar que el usuario deje el inbox en estado ambiguo: si no hay cuentas visibles, mostrar estado vacio claro y boton para mostrar todas.
- [ ] Persistir preferencia localmente en `localStorage` para modo demo.
- [ ] Preparar persistencia futura en Supabase por usuario/workspace, sin bloquear el MVP.
- [ ] Verificar desktop y mobile; la lista de cuentas no debe romper el ancho de pantalla.
- [ ] Ejecutar `npm run lint` y `npm run build`.
- [ ] Buscar referencias inconsistentes con `rg "accountId|visibleAccount|connected" src docs README.md`.
- [ ] Commit y push a `main` si el cambio esta validado.

## Diseño de UI propuesto

- En el panel izquierdo, debajo de las tarjetas de cuentas conectadas, agregar un bloque `Cuentas visibles`.
- Cada cuenta debe tener:
  - icono de red;
  - nombre de cuenta;
  - handle;
  - toggle mostrar/ocultar;
  - contador de items visibles si esta disponible.
- Mantener los botones `Todo`, `Facebook`, `Instagram` como filtro superior rapido.
- Agregar accion secundaria `Mostrar todas` cuando una o mas cuentas esten ocultas.

## Contrato tecnico esperado

`ChannelConnection` debe seguir representando cada cuenta conectada.

`InboxItem` debe apuntar a una cuenta concreta:

```ts
type InboxItem = {
  accountId: string;
  network: Network;
  accountName: string;
  // resto de campos existentes
};
```

El filtro final debe respetar esta logica:

```ts
const matchesAccount = visibleAccountIds.has(item.accountId);
const matchesNetwork = network === "all" || item.network === network;
const matchesQuery = text.includes(query.toLowerCase());
return matchesAccount && matchesNetwork && matchesQuery;
```

## Riesgos a evitar

- No duplicar estado de cuenta entre `accountName` y `accountId` como fuente de verdad.
- No filtrar por texto del nombre de cuenta; usar IDs.
- No mezclar cuentas demo con cuentas reales sin un campo claro de origen.
- No ocultar permanentemente una cuenta desde un filtro temporal.
- No agregar permisos Meta nuevos solo por el filtro; esto es UI/datos internos.

## Criterio de aceptacion

- El usuario puede ocultar una cuenta conectada y los items de esa cuenta desaparecen del inbox.
- Puede volver a mostrarla sin perder busqueda ni estado de conversacion.
- Puede combinar el filtro de cuentas con Facebook/Instagram.
- La app compila y no quedan referencias a comportamiento anterior en docs.
