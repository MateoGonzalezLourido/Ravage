# IPC Channels and Servers

This document covers two things: the IPC channel surface registered under `backend/ipc/`, and the two Express + Socket.IO server templates under `backend/servidores/`.

All IPC handler-registration functions are wired up from `main.js` (around lines 195-230), each behind its own `try/catch` so one failing module does not prevent the others from registering.

---

## 1. IPC channel reference

### 1.1 `session_ipc.js` — `registerSessionHandlers(mainWindow)`

Full flow detail (login, registration, device trust, security PIN, rate limiting) is documented in `Docs/backend/SESSION_AUTH.md`. This is only a channel index.

| Channel | Type | Purpose |
|---|---|---|
| `cambiar-pagina-log` | `on` | Relaunches the app (used to bounce back to the login screen) |
| `login-usuario` | `handle` | Login with email/password, subject to device-lock + rate-limit checks |
| `registrar-usuario` | `handle` | Registers a new account |
| `validar-code-registrar-usuario` | `handle` | Validates the 6-digit email code for registration |
| `validar-code-login-usuario` | `handle` | Validates the 6-digit email code for login (2FA) |
| `borrar-code-registrar-usuario` | `handle` | Deletes a pending registration verification code |
| `borrar-code-login-usuario` | `handle` | Deletes a pending login verification code |
| `cerrar-sesion-usuario` | `handle` | Logs out and relaunches the app |
| `obtener-apodo-sesion` / `obtener-correo-usuario` / `obtener-id-mongodb-usuario` / `obtener-idamigo-usuario` | `handle` | Read in-memory session values (see `Variables_sesion.js`) |
| `comprobar-contraseña-cuenta` | `handle` | Verifies the current account password (e.g. before a sensitive change) |
| `permitir-cambio-datos-cuenta` | `handle` | Starts a cooldown-gated change flow for `contraseña`/`correo`/`apodo`. Signature: `(data, tipo, contraseña_actual = null)` — the fourth argument was added when password changes started requiring re-authentication: for `tipo === "contraseña"` it is forwarded to `permitirCambioContraseñaUsuario(data, contraseña_actual)`, which compares it against the stored hash and **rejects the change if it is missing or wrong**. It is ignored for `correo`/`apodo`. |
| `cambiar-datos-usuario` | `handle` | Confirms a profile-data change with its verification code |
| `obtener-fecha-creacion-cuenta` / `obtener-fecha-bloqueo-apodo` / `obtener-fecha-bloqueo-correo` / `obtener-fecha-bloqueo-contraseña` | `handle` | Read account-age / cooldown-remaining values |
| `obtener-invisible-usuario` / `obtener-mostrar-correo-usuario` | `handle` | Read privacy toggles |
| `configurar-pin-seguridad` / `verificar-pin-seguridad` / `tiene-pin-seguridad` | `handle` | Local app-lock PIN: set/change (Argon2-hashed via `hash()`/`compare()` from `libs.js`), verify, and existence check |
| `marcar-dispositivo-confianza` / `revocar-dispositivo-confianza` / `estado-dispositivo-confianza` | `handle` | Trusted-device management for the current device |
| `obtener-gestion-dispositivos` | `handle` | Lists known devices for the account |
| `revocar-sesion-dispositivo` / `revocar-confianza-dispositivo` / `bloquear-dispositivo` / `desbloquear-dispositivo` | `handle` | Remote device management, all args validated against `/^[a-f0-9]{64}$/` |

### 1.2 `chat_ipc.js` — `registerChatHandlers(mainWindow, socket)`

| Channel | Args | Purpose | Returns |
|---|---|---|---|
| `obtener-chats-usuario` | — | Loads the user's chat list from DB, caches it into `Variables_sesion.setListaChats` | `Chat[]` |
| `obtener-datos-chats-grupales-usuario` | `{data, grupales, mensajes}` | Bulk-fetches chat details/messages | array of chat data |
| `obtener-datos-chat-unico-usuario` | `id, datos_buscar` | Fetches one chat's data | chat object |
| `crear-chat-nuevo` | `ids, nombre, id_chat, solicitudAceptada` | Creates a chat (1:1 or group); validates `nombre` via `comprobar_nombre_archivo` | result of `CREAR_CHAT_NUEVO` |
| `responder-solicitud-añadir` | `id_chat, id_mensaje, aceptar` | Accepts/rejects a group-join request | — |
| `seleccionar-archivos` | — | Opens a native multi-file picker; every returned path is added to an in-memory `authorizedPaths` allowlist (a `Set` bounded by `MAX_AUTHORIZED_PATHS = 500`, oldest entry dropped first) | `string[]` (file paths) |
| `enviar-mensaje` | `{asunto, archivos, id_chat, id_emisor}` | Sends a message; rejects any attached file path not present in `authorizedPaths` (prevents arbitrary filesystem reads from a compromised renderer); validates `asunto` via `comprobar_mensaje`. Authorizations are **single-use**: paths are removed from the allowlist after a successful send, and kept on failure so the user can retry | result of `ENVIAR_MENSAJE` |
| `descargar-archivo` | `id, nombre, iv, tag, id_chat, ratchet_info, emisor_id` | Downloads + decrypts an attachment; on success shows a renderer toast and fires an OS notification via `procesarNotificacionOSDescarga` | boolean/result |
| `obtener-preview-imagen` | same as above | Fetches an image preview | preview data |
| `obtener-audio-mensaje` | same as above | Fetches an audio attachment | audio data |
| `revisar-buzon` | — | Manually re-checks the mailbox (`Buzon` collection) for this user | mailbox entries |
| `iniciar-buzon` | `on` | Runs an initial mailbox check, then starts the live Change Stream listener (`iniciarBuzon`) — see `Docs/Services/NOTIFICACIONES.md` | — |
| `obtener-datos-mensaje` | `id_chat, id_mensaje` | Fetches one message | message object |
| `obtener-mensajes-chat-paginados` | `id_chat, limit, cursor_date, direction` | Cursor-paginated message history | `Message[]` |
| `expulsar-usuario-chat` | `id_usuario, id_chat` | Kicks a user from a group | — |
| `hacer-admin-chat` / `quitar-admin-chat` | `id_chat, id_usuario` | Grants/revokes group admin | — |
| `silenciar-chat` / `bloquear-chat` | `id_chat` | Mutes/blocks a chat for the current user | — |
| `guardar-cache-chat-activo` | `data` | Writes into the "active chat" in-memory cache (see `_cache_chat_activo.js`) | — |
| `obtener-cache-chat-activo` | `id, bloque` | Reads from the active-chat cache | cached data or `null` |
| `eliminar-mensaje` | `id_chat, id_mensaje` | Deletes a message | — |
| `fijar-mensaje` / `desfijar-mensaje` | `id_chat, id_mensaje` | Pins/unpins a message | — |
| `limpiar-mensajes-chat` | `id_chat` | Clears all messages in a chat | — |
| `gestionar-eliminar-chat` | `id_chat` | Deletes/leaves a chat | — |
| `actualizar-datos-chat` | `id_chat, datos` | Updates chat name/description/per-scanner security settings; validates `nombre`, `descripcion` (≤100 chars), and every `escaneres_seguridad` key against a fixed whitelist of 9 scanner names with values restricted to `{0,1,3}` | result of `ACTUALIZAR_DATOS_CHAT` |

### 1.3 `social_ipc.js` — `registerSocialHandlers()`

| Channel | Args | Purpose |
|---|---|---|
| `encontrar-usuario-externo` | `texto, correo` | Searches for a user by nickname or (if `correo`) email |
| `obtener-datos-usuario-externo` | `id, datos` | Fetches another user's public profile fields |
| `obtener-varios-usuarios-externos` | `ids, datos` | Bulk profile fetch |
| `obtener-contactos-usuario` | — | Returns the in-memory contact list (`Variables_sesion.getListaContactos`) |
| `obtener-usuarios-bloqueados` / `obtener-usuarios-silenciados` | — | Returns in-memory blocked/muted lists |
| `añadir-usuarios-bloqueados` / `eliminar-usuarios-bloqueados` | `id[, apodo]` | Block/unblock a user |
| `añadir-usuarios-silenciados` / `eliminar-usuarios-silenciados` | `id[, apodo]` | Mute/unmute a user |
| `añadir-contacto` / `eliminar-contacto` | `id[, nombre]` | Add/remove a contact |
| `obtener-hist-chats-contactos` | — | History linking contacts to shared chats |
| `vincular-chat-contacto` | `contacto_id, chat_id` | Links a chat to a contact entry |
| `toggle-invisible-usuario` / `toggle-mostrar-correo-usuario` | — | Flips the "invisible" / "show email" privacy toggles |
| `guardar-varios-usuarios-externos` | `usuarios[]` | Pushes a batch of user objects the renderer evicted from its own cache back into the backend's session cache (`GUARDAR_USUARIOS_EN_PERSISTENTE` in `UserRepository.js` — see `Docs/backend/CACHE_SYSTEM.md`) |

### 1.4 `validadores_ipc.js` — `registerValidadoresHandlers()`

Thin wrappers exposing server-side validators from `services/validadores.js` to the renderer so inputs can be checked before submission. Every handler returns a plain `boolean` (`.success` of the underlying validator result).

| Channel | Validates |
|---|---|
| `validar-correo` | Email format |
| `validar-apodo` | Nickname |
| `validar-contraseña` | Password strength rules |
| `validar-idamigo` | "Friend ID" format |
| `validar-codigo` | 6-digit verification code |
| `validar-mensaje` | Message body |
| `validar-nombre-archivo` | Filename (path-injection safe) |

### 1.5 `escaneres_app_ipc.js` — `registerEscaneresAppHandlers()`

Bridges the renderer to the message-security scanners. Detection/removal work (steganography, malicious URLs, XSS, code blocks, Zalgo text, terminal commands, crypto wallet addresses, IP addresses, homoglyphs) is offloaded to a worker pool (`getEscanerPool()` from `utils/workers/workerPool.js`) rather than run on the main process.

| Channel | Purpose |
|---|---|
| `escaneres-seguridad-app-mensaje` | Returns which scanners are enabled for a given chat (`escaneres_seguridad_mensaje_activados`) |
| `escaneres-seguridad-app-detectar-escenografia` / `-eliminar-escenografia` | Steganography detection / stripping |
| `escaneres-seguridad-app-detectar-url` / `-eliminar-url` | Generic URL detection / stripping |
| `escaneres-seguridad-app-detectar-url-maliciosa` | Google Safe Browsing–style malicious URL check (swallows errors, returns `{esMaliciosa: false, urlsPeligrosas: []}` on failure) |
| `utilidades-app-previsualizar-url` | Link preview (`obtenerPrevisualizacionUrl`) — not a scanner, but grouped here |
| `escaneres-seguridad-app-detectar-xss` | XSS payload detection |
| `escaneres-seguridad-app-detectar-codigo` | Code-block detection |
| `escaneres-seguridad-app-detectar-zalgo` / `-eliminar-zalgo` | Zalgo/combining-character detection / stripping |
| `escaneres-seguridad-app-detectar-comandos-terminal` | Shell-command detection |
| `escaneres-seguridad-app-detectar-crypto-billeteras` | Cryptocurrency wallet address detection |
| `escaneres-seguridad-app-detectar-direcciones-ip` | IP address detection |
| `escaneres-seguridad-app-detectar-homoglifos` | Homoglyph (lookalike character) detection |
| `escaneres-seguridad-app-detectar-lote` | Runs `ESCANER_BATCH_MULTI_ASYNC` over a batch of `{id_mensaje, ...}` items in parallel; on error returns one `{id_mensaje, detecciones: null}` per input item so the frontend can degrade gracefully |

### 1.6 `cache_persistent_ipc.js` — `registerCachePersistentHandlers()`

| Channel | Backing store | Purpose |
|---|---|---|
| `get-usuario-cache` | `UserRepository.js` in-memory session cache | Reads a user from the RAM session cache — see `Docs/backend/CACHE_SYSTEM.md` |
| `obtener-historial-busquedas` | SQLite `historial_busquedas` table (`_cache_historial_busquedas_añadir_usuario.js`) | Full search-history list plus `fecha_actualizado_global` and count |
| `anadir-historial-busquedas` | same | Records/increments a search-history entry |
| `borrar-historial-busquedas` | same | Deletes one entry by id or search term |
| `limpiar-historial-completo` | same | Clears the whole table |
| `limpiar-variable-cache-historial` / `cancelar-limpieza-variable-cache-historial` | same | No-ops kept for backward API compatibility — the in-memory debounce this used to control was removed when the history cache moved to SQLite |

### 1.7 `cache_archivos_descargados_ipc.js` — `registerCacheArchivosDescargadosHandlers()`

| Channel | Purpose |
|---|---|
| `get-cache-archivos-descargados` | Returns the full downloaded-files history (gzip-decompressed from SQLite) |
| `set-cache-archivos-descargados` | Inserts/updates one entry, or clears the table if called with the literal string `"c"` |
| `clear-cache-archivos-descargados` | Clears the table |
| `set-limite-cache-archivos-descargados` | Sets the max entry count, persisted into `ajustes_app.json` under `LIMITE_CACHE_ARCHIVOS_DESCARGADOS` |

See `Docs/backend/CACHE_SYSTEM.md` for the full eviction logic (entry-count limit + 256 MB estimated-size limit).

---

## 2. Servers (`backend/servidores/`)

Ravage ships two server templates. Both mount Express + Socket.IO over plain HTTP; only one runs at a time depending on environment.

| File | Environment | Port | Started from |
|---|---|---|---|
| `serverLocalHost.js` | Development / embedded in Electron | Dynamic — OS picks a free port (`listen(0)`) | `main.js`, at app startup |
| `serverRailway.js` | Production (Railway) | `process.env.PORT` (falls back to `8080`) | Directly by the Railway process (`node backend/servidores/serverRailway.js`), or any process invocation where `process.argv[1]` includes `serverRailway.js` |

> The root `README.md` currently describes the local server as listening on a **fixed** port `3000` with a fixed CORS allowlist (`localhost:3000`, `localhost:8080`, `file://`). That is stale — see below, the current code uses a **dynamic** OS-assigned port and a regex-based localhost origin check. `Docs/Services/SERVIDORES.md` (Spanish) already reflects the current behavior; this section is its English translation, re-verified line by line against the source.

### 2.1 Local server — `serverLocalHost.js`

Runs embedded inside the Electron main process.

```js
socket = await startServer();   // returns the server's Socket.IO `io` instance
```

The returned `io` is passed to `registerChatHandlers(window, io)` and from there to `iniciarBuzon(io, mainWindow)`, which uses `io.to(userId).emit(...)` to push mailbox notifications.

**Middleware stack, in execution order:**

```
Incoming request
   │
   ├─ express.json()            — parses JSON body
   ├─ express-rate-limit        — 300 req / 15 min per IP
   ├─ CORS middleware           — see below
   ├─ GET /                     — health check
   └─ Socket.IO (WS upgrade)    — auth middleware → connection handler
```

**Port:** the server calls `server.listen(0, ...)`, so the OS assigns the first free port; the actual port is read back from `appServer.address().port` and logged.

**CORS:** since the port is dynamic, origins are validated with a regex instead of a fixed list:

```js
const ALLOWED_ORIGINS_LOCAL = /^http:\/\/localhost(:\d+)?$/;
```

This allows any `localhost` port. Behavior:
- `Access-Control-Allow-Origin` is only set when the request's `Origin` header matches the regex — the server never sends `*`.
- `Vary: Origin` is always added alongside it, so caches/proxies don't serve one origin's CORS response to another.
- `OPTIONS` preflights get `204 No Content` before reaching any route.
- Requests without an `Origin` header (CLI tools, server-to-server) get no CORS header at all — none is needed.

The same regex is passed as `cors.origin` to the Socket.IO server constructor, so both layers agree.

**Socket.IO auth:** on startup the server generates an ephemeral random token:

```js
_socketSecret = randomBytes(32).toString('hex');   // 64 hex chars
```

Any Socket.IO connection whose `socket.handshake.auth.token` doesn't match this exact value is rejected in the `io.use(...)` middleware. `_socketSecret` is module-private: the former `getSocketSecret()` export had no consumers and has been removed, so the file now exports only `startServer`, `stopServer` and `io`. Full detail in `Docs/Services/seguridad/SOCKETIO_AUTH.md`.

**HTTPS:** the file contains a commented-out template for serving over HTTPS with local certificates (`https.createServer(httpsOptions, app)`, reading `key.pem`/`cert.pem` from `backend/certs/`). It is inactive by default — the live code path uses `http.createServer(app)`.

### 2.2 Railway server — `serverRailway.js`

Meant to be deployed as a standalone service on Railway (or any similar PaaS). Same middleware shape as the local server, tuned for production.

| Aspect | Local | Railway |
|---|---|---|
| Port | Dynamic (`listen(0)`) | `process.env.PORT` (defaults to `8080` if unset) |
| Host | implicit `localhost` | `0.0.0.0` (all interfaces) |
| `trust proxy` | not set | `1` (to read the real client IP behind Railway's proxy) |
| Rate limit | 300 req / 15 min | 100 req / 15 min |
| CORS origins | regex, any localhost port | fixed list read from `CLIENT_URL` env var |
| Socket.IO token | random, generated at startup | `SOCKET_SECRET` env var |
| Socket.IO `transports` | default (both) | explicitly `['websocket', 'polling']` |
| Standalone start | no | yes — detects `process.argv[1]?.includes('serverRailway.js')` and self-starts, calling `connectDB()` first |

**CORS:** `CLIENT_URL` may be a single URL or a comma-separated list:

```
CLIENT_URL=https://my-app.com
CLIENT_URL=https://my-app.com,https://admin.my-app.com
```

**Fail-closed:** if `CLIENT_URL` is undefined, `ALLOWED_ORIGINS` is an empty array and no request receives a CORS header — cross-origin requests are blocked by the browser. A `fatal`-level log line is emitted at startup in this case. Socket.IO shares the same list: if it's empty, `cors.origin` is set to `false`, disabling CORS for Socket.IO too.

**Socket.IO auth:** requires `SOCKET_SECRET` from the environment. If unset, a `fatal` log is emitted and the `io.use(...)` middleware rejects every connection (`socketSecret` is falsy, so the `&&` check always fails).

**Health check:** `GET /` returns `200` with a plain-text body — used by Railway's orchestrator to confirm the service is alive.

### 2.3 CORS behavior — quick reference

| Case | Local | Railway |
|---|---|---|
| `Origin` in allowlist | `ACAO: <origin>` + `Vary: Origin` | `ACAO: <origin>` + `Vary: Origin` |
| `Origin` not allowed | no ACAO header (blocked by browser) | no ACAO header (blocked by browser) |
| No `Origin` header (CLI, server-to-server) | no ACAO header (not needed) | no ACAO header (not needed) |
| Preflight `OPTIONS` | `204 No Content` | `204 No Content` |
| `CLIENT_URL` undefined (Railway only) | — | ACAO never sent (fail-closed) |

`ACAO` = `Access-Control-Allow-Origin`.

### 2.4 Both servers register the same Socket.IO connection handler

```js
socket.on("identificar", (userId) => { socket.join(userId); socket.userId = userId; });
socket.on("disconnect", () => { /* log */ });
```

Clients join a Socket.IO room named after their own user id; the mailbox service (`buzonAPI.js`) later emits to that room via `io.to(userId).emit(...)`.
