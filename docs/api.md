# API de la app

## Estado

La API esta preparada para operar en modo demo y para conectarse despues con Supabase y Meta. Los endpoints server-side son la unica via para ejecutar acciones contra Meta.

La autenticacion interna de usuario usa Supabase Auth desde el cliente con email OTP. No agrega endpoints propios por ahora.

## Endpoints

### `GET /api/health`

Devuelve estado basico de configuracion.

Respuesta:

```json
{
  "ok": true,
  "services": {
    "supabase": "demo",
    "meta": "demo"
  }
}
```

### `POST /api/inbox/action`

Registra o ejecuta una accion del agente sobre un item del inbox.

Payload:

```json
{
  "itemId": "item-1001",
  "externalId": "item-1001",
  "action": "reply",
  "message": "Texto de respuesta"
}
```

Acciones soportadas:

- `reply`
- `like`
- `unlike`
- `hide`
- `unhide`
- `block`

Respuesta demo:

```json
{
  "mode": "demo",
  "ok": true,
  "message": "Accion reply registrada en modo demo."
}
```

Si Supabase esta configurado, registra la accion en `action_log`.

### `GET /api/meta/webhook`

Endpoint de verificacion de webhook Meta.

Usa:

- `hub.mode`
- `hub.verify_token`
- `hub.challenge`

Responde el challenge si `hub.verify_token` coincide con `META_WEBHOOK_VERIFY_TOKEN`.

### `POST /api/meta/webhook`

Recibe eventos de Meta.

Validacion:

- `x-hub-signature-256`
- `META_APP_SECRET`

Si Supabase esta configurado, guarda el evento crudo en `webhook_events`.

## Reglas

- Las credenciales Supabase anon pueden estar en el cliente; la service role nunca debe exponerse.
- No llamar a Meta desde componentes cliente.
- No enviar tokens de Meta al navegador.
- No asumir que un evento webhook ya esta normalizado.
- Guardar eventos crudos antes de procesarlos para poder depurar.
