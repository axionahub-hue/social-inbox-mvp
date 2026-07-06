# Plan operativo: filtros por cuentas conectadas

## Estado

Completado en modo demo y modo Supabase autenticado. La persistencia es local en `localStorage` sin sesion y por usuario/workspace en `user_preferences` cuando hay sesion Supabase.

## Objetivo

Permitir que el usuario elija que cuentas conectadas quiere mostrar u ocultar en el inbox, ademas del filtro general por red social. El filtro debe servir igual para modo demo y para datos reales de Supabase/Meta.

## Regla de producto

El inbox no debe filtrar solamente por `facebook` o `instagram`. La unidad real de trabajo es la cuenta conectada: una pagina de Facebook, una cuenta profesional de Instagram, o cualquier activo Meta que se agregue despues.

## Checklist operativo

- [x] Confirmar el modelo actual leyendo `src/lib/types.ts`, `src/lib/demo-data.ts` y `src/app/page.tsx`.
- [x] Verificar si `InboxItem` tiene un identificador estable de cuenta conectada.
- [x] Si falta, agregar `accountId` a `InboxItem` y poblarlo en `src/lib/demo-data.ts`.
- [x] Mantener `network` como filtro rapido, pero no usarlo como unica segmentacion.
- [x] Agregar estado UI para cuentas visibles, por ejemplo `visibleAccountIds`.
- [x] Renderizar una lista de cuentas conectadas con toggle mostrar/ocultar.
- [x] Permitir combinacion de filtros: busqueda textual + red + cuentas visibles.
- [x] Evitar que el usuario deje el inbox en estado ambiguo: si no hay cuentas visibles, mostrar estado vacio claro y boton para mostrar todas.
- [x] Persistir preferencia localmente en `localStorage` para modo demo.
- [x] Persistir preferencias en Supabase por usuario/workspace cuando hay sesion.
- [x] Verificar desktop y mobile; la lista de cuentas no debe romper el ancho de pantalla.
- [x] Ejecutar `npm run lint` y `npm run build`.
- [x] Buscar referencias inconsistentes con `rg "accountId|visibleAccount|connected" src docs README.md`.
- [x] Commit y push a `main` si el cambio esta validado.

## Diseno de UI aplicado

- En el panel izquierdo, debajo de las tarjetas de cuentas conectadas, hay un bloque `Cuentas visibles`.
- Cada cuenta muestra icono de red, nombre, contador de items y toggle mostrar/ocultar.
- Los filtros `Todo`, `Facebook`, `Instagram` se mantienen como filtro rapido.
- Si no hay conversaciones visibles, la app muestra estado vacio claro y boton para mostrar todas las cuentas.

## Contrato tecnico aplicado

`ChannelConnection` sigue representando cada cuenta conectada. En modo Supabase, `ChannelConnection.id` es el ID real de `connected_accounts`.

`InboxItem` apunta a una cuenta concreta:

```ts
type InboxItem = {
  accountId: string;
  network: Network;
  accountName: string;
  // resto de campos existentes
};
```

El filtro final respeta esta logica:

```ts
const matchesAccount = visibleAccountIds.has(item.accountId);
const matchesNetwork = network === "all" || item.network === network;
const matchesQuery = text.includes(query.toLowerCase());
return matchesAccount && matchesNetwork && matchesQuery;
```

## Riesgos a evitar

- No duplicar estado de cuenta entre `accountName` y `accountId` como fuente de verdad.
- No filtrar por texto del nombre de cuenta; usar IDs.
- No mezclar cuentas demo locales con cuentas Supabase sin indicar origen de datos en UI.
- No ocultar permanentemente una cuenta desde un filtro temporal.
- No agregar permisos Meta nuevos solo por el filtro; esto es UI/datos internos.

## Criterio de aceptacion

- El usuario puede ocultar una cuenta conectada y los items de esa cuenta desaparecen del inbox.
- Puede volver a mostrarla sin perder busqueda ni estado de conversacion.
- Puede combinar el filtro de cuentas con Facebook/Instagram.
- La app compila y no quedan referencias a comportamiento anterior en docs.
