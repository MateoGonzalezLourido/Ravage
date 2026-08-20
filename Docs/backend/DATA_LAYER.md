# Data Layer

Ravage's backend persists data in two separate stores:

1. **MongoDB Atlas** (via Mongoose) — the remote, multi-device source of truth: users, chats, messages, mailbox ("buzón"), security/session records, chat membership windows, and file blobs (GridFS).
2. **A local SQLite database** (`better-sqlite3`) — a small on-disk cache scoped to the current device, unrelated to MongoDB and separate from the in-memory JS caches documented in `Docs/backend/CACHE_SYSTEM.md`.

This document covers `backend/db/mongo.js`, every model in `backend/models/`, every repository in `backend/repositories/`, and `backend/STORAGE/CACHE/database.js`.

---

## 1. MongoDB connection — `backend/db/mongo.js`

Sets up the single Mongoose connection used by the whole backend.

```js
await mongoose.connect(process.env.URI_MONGODB, {
    tls: true,
    tlsInsecure: false,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 1,
    connectTimeoutMS: 5000
});
```

| Function | Behavior |
|---|---|
| `connectDB()` | No-op if `mongoose.connection.readyState === 1` (already connected). Otherwise connects to `process.env.URI_MONGODB` with TLS forced on (`tls: true`, `tlsInsecure: false` — rejects invalid/self-signed certs), a 5s server-selection/connect timeout, 45s socket timeout, and a pool sized 1–10 connections. Logs success/failure via the `db` logger. |
| `closeDB()` | No-op if already disconnected (`readyState === 0`). Otherwise calls `mongoose.disconnect()`. |
| `disconnected` event listener | Logs a warning whenever the connection drops; falls back to `console.warn` if the logger itself fails (e.g. during app shutdown). |

Exports `connectDB`, `closeDB`, and the shared `mongoose` instance (re-exported from `backend/utils/libs.js`). There is no manual retry/backoff logic — Mongoose's own driver-level retries apply.

---

## 2. The `EncryptedData` sub-schema pattern

Every model that stores sensitive data uses the same embedded sub-schema (duplicated verbatim in `User.js`, `Chat.js`, `Message.js`, `Buzon.js`, `Security.js`):

```js
const EncryptedDataSchema = new mongoose.Schema({
    data: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    compressed: { type: Boolean, default: false }
}, { _id: false });
```

This is an AES-GCM envelope: `data` is ciphertext, `iv` is the initialization vector, `tag` is the auth tag, and `compressed` flags whether the plaintext was gzip-compressed before encryption. Any field typed as `EncryptedDataSchema` is **encrypted at rest** using the app's system-wide key, via `encriptarDatosSistema()` / `desencriptarDatosSistema()` in `backend/services/cryptoService.js`. Fields that need to be queried (e.g. `correo_hash`, `idamigo_hash`) are stored as a plain SHA-256-style hash (`hashDatosSistema()`) alongside the encrypted value, since the ciphertext itself can't be indexed/searched.

Chat message bodies use a *different* envelope (Signal-style ratchet encryption, see §3.3) rather than the system key.

---

## 3. Models (`backend/models/`)

### 3.1 `User.js` → collection `usuarios`

| Field | Type | Encrypted? | Notes |
|---|---|---|---|
| `apodo` | `EncryptedDataSchema` | Yes | Display name/nickname. |
| `correo` | `EncryptedDataSchema` | Yes | Email. |
| `correo_hash` | `String` | — | SHA-hash of email, `unique`, indexed. Used for lookups since `correo` is ciphertext. |
| `contrasena` | `String` | Hashed (bcrypt-style, via `compare()`) | Not `EncryptedDataSchema` — a password hash, not reversible ciphertext. `minlength: 8`. |
| `exp_bloq_apodo` / `exp_bloq_correo` / `exp_bloq_contrasena` | `Date` | — | Cooldown timestamps before the user may change nickname/email/password again (1h / 72h / 24h defaults). |
| `users_bloq` | `[ObjectId]` | — | Users this user has blocked. |
| `users_silence` | `[ObjectId]` | — | Users this user has muted. |
| `contactos` | `[ContactoUsuarioSchema]` | apodo sub-field yes | Contact list: `{ id, apodo(enc), chat_id }`. |
| `chats_contactos_hist` | `[HistChatContactoSchema]` | No (plain `apodo` string) | Permanent history of `{ u: userId, c: chatId, apodo }` — survives contact deletion so a dedicated 1:1 chat can be re-linked later (see `VINCULAR_CHAT_CONTACTO`). |
| `chats` | `[ChatUsuarioSchema]` | `ultimomensaje`, `nombre_bloqueo` yes | Per-user view of each chat: pin/mute/block flags, `ultimoCambio`, encrypted preview of the last message, and a "freeze" snapshot (`mensaje_bloqueo_id`, `nombre_bloqueo`, `participantes_bloqueo`) taken at expulsion/block time so a removed/blocked user still sees the chat as it was. |
| `visible`, `mostrarCorreo`, `bloqueada`, `bloquearChatsNuevos`, `invisible` | `Boolean` | — | Visibility/privacy toggles. `invisible` prevents the user from starting/being added to new chats. |
| `idamigo` | `EncryptedDataSchema` | Yes | "Friend ID" — a shareable random handle used to find the user without exposing the email. |
| `idamigo_hash` | `String` | — | Hash of `idamigo`, `unique`, indexed. |
| `secretKey` | `EncryptedDataSchema` | Yes | Random 32-byte key, purpose internal to the app's key material (rotated via `ActualizarSecretKeyUsuario`). |
| `publicKey` | `String` | No (public by design) | X25519 public key PEM, used to wrap chat ratchet keys for this user. |
| `createdAt` | `Date` | — | |

Indexes: `correo_hash` (unique), `idamigo_hash` (unique). No TTL indexes on `User`.

### 3.2 `Chat.js` → collection `chats`, model `ChatsRavage`

| Field | Type | Encrypted? | Notes |
|---|---|---|---|
| `nombre` | `EncryptedDataSchema` | Yes (nullable) | Chat name; `null` for un-named 1:1 chats (name resolved client-side from contacts). |
| `usuarios` | `[ObjectId]` | — | Chat members. |
| `admins` | `[ObjectId]` | — | Chat admins (only relevant for groups >2 members; for 2-person chats both members are admins). |
| `ratchet_keys` | array of `{ emisor_id, receptor_id, clave_envuelta: {ephPub, iv, data, tag}, counter }` | `clave_envuelta` yes (X25519-wrapped) | Per-(sender,receiver) wrapped Sender Chain Key for the Signal-style ratchet (see §5). Not exposed to the renderer — pruned in `ChatRepository.obtener_datos_chat_unico`. |
| `escaneres_seguridad` | `Object` | No | Per-chat toggles for content scanners (steganography, URL, XSS, terminal commands, crypto wallets, IP addresses, homoglyphs, zalgo, malicious URL, code). |
| `descripcion` | `EncryptedDataSchema` | Yes (nullable) | Group description. |
| `fecha_creacion` | `Date` | — | |
| `msfijado` | `ObjectId` | — | ID of the currently pinned message, if any. |

No explicit indexes or TTL defined in this model.

### 3.3 `Message.js` → collections `messages` (`MessagesRavage`) and `archivos` (`ArchivosRavage`)

`MessageSchema`:

| Field | Type | Encrypted? | Notes |
|---|---|---|---|
| `id_chat` | `ObjectId` | — | |
| `emisor` | `ObjectId` | — | Sender. |
| `contenido` | `[{ asunto: EncryptedDataSchema, archivos: [ArchivoSchema] }]` | `asunto` yes (system key) | Kept as a plaintext-shaped fallback/echo of the subject encrypted with the system key — separate from the ratchet-encrypted blob below. Always an array but only ever holds one element in practice. |
| `encriptado` | `{ iv, tag, data }` (not the shared `EncryptedDataSchema` — inline, no `compressed` flag) | Yes | The actual message payload (`{asunto, archivos, emisor, data}` JSON), encrypted with the **ratchet-derived message key**, not the system key. Produced by `cifrarContenido()` / consumed by `descifrarListaMensajes()` in `messageCryptoService.js`. |
| `data` | `Date` | — | Message timestamp. |
| `especial` | `Mixed` | — | Special/system message payload: join/leave/add-request notices (`tipo` 0–2), deletion marker (`{borrado: true}`), etc. |
| `ratchet_info` | `{ iteration, chain_id }` | — | Which ratchet step produced this message's key, needed to re-derive the key on read. |

`ArchivoSchema` (embedded in `contenido[].archivos`): `nombre` (`EncryptedDataSchema`), `id` (GridFS file id), `iv`, `tag` (plain strings — the file's own AES-GCM parameters), `key_enc` (`EncryptedDataSchema` — the ratchet message key wrapped with the system key, used as a fallback if the ratchet has since rotated past the message's iteration).

Indexes on `MessagesRavage`:
- `{ id_chat: 1, data: -1 }` — chat timeline queries.
- `{ data: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }` — **TTL index**: messages auto-expire 365 days after their `data` timestamp.

`ArchivoSchemaGridfs` (separate model `ArchivosRavage`, collection `archivos`): `filename` (`EncryptedDataSchema`), `gridfsId`, `size`, `mimetype`, `uploadedAt`. Index on `filename`. Note: this model appears to overlap with GridFS's own `fs.files`/`fs.chunks` collections created by `GridFSBucket` (bucket name `ArchivosChats`, used directly in `MessageRepository.js`); no code in `MessageRepository.js` was found writing to `ArchivosRavage` — it looks unused/dead in the current send/download flow, which talks to `GridFSBucket` directly instead.

### 3.4 `Buzon.js` → collection `buzon`, model `BuzonUsuarios`

A per-user "mailbox" of pending notification entries (new message, added to chat, expelled, admin change, pin, etc.), delivered/drained on demand.

| Field | Type | Encrypted? | Notes |
|---|---|---|---|
| `entrada` | `[EntradaSchema]` = `[{ tipo: String, data: EncryptedDataSchema }]` | `data` yes | Queue of notification entries. Capped client-side at `MAX_ENTRADAS = 200` via `$slice` on push. |
| `updatedAt` | `Date` | — | Manually bumped on every write (not Mongoose's automatic `timestamps`). |

Index: `{ updatedAt: 1 }, { expireAfterSeconds: 60*60*24*90 }` — **TTL index**, purges mailboxes untouched for 90 days (i.e. abandoned accounts). Documents are keyed by the user's own `_id` (see `Añadir_Entrada_Buzon_Usuario`, which upserts by `_id: id` where `id` is the recipient's user id) — there's no explicit `_id` field in the schema because it reuses Mongoose's default `_id`.

### 3.5 `Security.js` → several models in database `dbo` (default), all sharing the `EncryptedDataSchema`

| Model / collection | Purpose | TTL |
|---|---|---|
| `ValidationCode` (`validationcodes`) | Short-lived verification codes (e.g. email verification codes) tied to `correo` + `id_dp` (device). `code` is a SHA-256 hex hash. | `expira` TTL, 10 min |
| `CuentaValidationCode` (`cuentavalidationcode`) | Same shape as `ValidationCode`, reused for account-related validation flows. | `expira` TTL, 10 min (shares the same schema/index definition as `ValidationCodeSchema`) |
| `DatosCuentaVC` (`datoscuentavc`) | Validation codes tagged with a `tipo` (lowercased) for account-data changes. | `expira` TTL, 10 min |
| `TokenSession` (`tksession`) | Active login/session tokens per device (`token` hash, `os`, `nombre` encrypted). | `expira` TTL, 90 min |
| `TokenVC` (`tokenvcv`) | Verification-flow tokens (same `TokenSchema` shape as `TokenSession`, different collection/model). | `expira` TTL, 90 min |
| `TokenDPC` (`tokendpc`) | "Trusted device" tokens — no `expira` field at all (`TokenDPCSchema` omits it), so these persist until explicitly revoked. | none |
| `DispositivosBloqueados` (`dpbloqueado`) | Devices blocked for a given account (`correo_hash` + `id_dp_hash`), with `fecha_bloqueo`. | none |
| `RateLimitAudit` (`ratelimitaudit`) | Daily infraction counter per device (`id_dp_hash` + `fecha`), unique on the pair. | none (accumulates; not TTL'd) |
| `AppBlockedDevices` (`appblockeddevices`) | Devices permanently blocked app-wide after 5 daily infractions, `id_dp_hash` unique. | none — permanent |

All `correo`/`id_dp`/`os`/`nombre` values are stored both encrypted (for display) and hashed (`_hash` suffix, indexed) for querying.

### 3.6 `MembresiaChat.js` → collection `membresias_chat`

Tracks, per `(usuario_id, chat_id)` pair, the time windows during which a user was actually a member of a chat — used to hide messages sent while the user wasn't present (e.g. after being expelled and re-added, or after leaving/rejoining, or blocking/unblocking).

| Field | Type | Notes |
|---|---|---|
| `usuario_id` | `ObjectId` | |
| `chat_id` | `ObjectId` | |
| `bloques` | `[{ entro: ObjectId\|null, salio: ObjectId\|null }]` | Each block is a membership window bounded by message IDs (ObjectIds are chronologically sortable): `entro` = id of the first message visible after joining (`null` = from the start of the chat), `salio` = id of the last message visible before leaving (`null` = still active / no exit recorded yet). |

Index: `{ usuario_id: 1, chat_id: 1 }, { unique: true }` — one document per user/chat pair; multiple membership windows live inside the `bloques` array of that single document.

No document at all means "original member with no restrictions" (messages sent before the membership system existed) — this is the fallback path in `filtrar_mensajes_membresia`.

---

## 4. Local SQLite database — `backend/STORAGE/CACHE/database.js`

A **local, on-disk** SQLite database via `better-sqlite3`, distinct from both MongoDB and the in-memory/persisted-to-JSON JS caches described in `Docs/backend/CACHE_SYSTEM.md`.

```js
const DB_PATH = path.join(app.getPath('userData'), 'cache.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
```

- Location: Electron's per-user `userData` directory (or `<cwd>/.test_data` outside Electron, e.g. tests). File: `cache.db`.
- Pragmas: WAL journal mode (better concurrent read/write) and `synchronous = NORMAL` (durability traded for speed — acceptable since this is a disposable cache, not the source of truth).
- Schema (created with `IF NOT EXISTS`, so it's idempotent across app restarts):

| Table | Columns | Indexes |
|---|---|---|
| `archivos_descargados` | `id TEXT PRIMARY KEY`, `data TEXT NOT NULL`, `timestamp INTEGER NOT NULL` | `idx_archivos_timestamp(timestamp)` |
| `historial_busquedas` | `datoUsadoBuscar TEXT PRIMARY KEY`, `_id TEXT NOT NULL`, `veces_buscado INTEGER DEFAULT 1`, `ultima_vez INTEGER NOT NULL` | `idx_historial_ultima_vez(ultima_vez)` |

The module just opens/initializes the connection and exports the raw `db` handle (`export default db`) — no query helpers live here. It backs two consumers under `backend/STORAGE/CACHE/`:
- `_cache_archivos_descargados.js` — tracks downloaded-file metadata (`archivos_descargados`), keyed by file id, timestamped for cleanup.
- `_cache_historial_busquedas_añadir_usuario.js` — tracks "add user" search history, counting how many times a search term (`datoUsadoBuscar`) was used and resolving it to a target `_id`.

**How this differs from the other layers:**
- vs. **MongoDB**: this is per-device, unencrypted, and disposable — it never syncs across devices and holds no message/chat content, only local UX bookkeeping (download history, search frequency).
- vs. the **in-memory JS caches** (`_cache_chat_activo.js`, the `session_cache_usuarios` `Map` in `UserRepository.js`, etc., covered in `Docs/backend/CACHE_SYSTEM.md`): those live in RAM and vanish on process exit (unless separately persisted to JSON); `cache.db` survives app restarts by design since it's an actual SQLite file on disk.

---

## 5. Repositories (`backend/repositories/`)

Repositories are the only layer that talks to Mongoose models directly on the write/read path from IPC handlers. They also own the encrypt-on-write / decrypt-on-read boundary: callers above them (IPC handlers, renderer) only ever see plaintext; callers below them (Mongoose models) only ever store ciphertext.

### 5.1 `UserRepository.js`

Central place for account data, session login, contacts, blocking/muting, and a **session-scoped in-memory cache** (`session_cache_usuarios`, a plain `Map`) with its own TTL/size eviction (`REVISAR_LIMPIEZA_CACHE_SESION`: 15 min TTL, 50 MB cap) — this cache is part of the family documented in `CACHE_SYSTEM.md`, only described here as context for how repository reads short-circuit DB access.

Key exports:

| Function | Purpose |
|---|---|
| `procesarUsuario(usuario)` | Central decrypt-on-read step: turns a raw Mongo user doc into a plain object with `apodo`, `correo`, `idamigo` decrypted, `chats[].ultimomensaje` and `contactos[].apodo` decrypted, ObjectIds stringified. |
| `LoginUsuarioDB({correo, contrasena, token, id_dp, bloqueada})` | Two paths: token-based (validates a JWT via `validateToken`, cross-checks a hashed `TokenSession` record) or password-based (`bcrypt`-style `compare()` against `contrasena`). Returns `{success, data: procesarUsuario(...)}`. |
| `InsertarUsuario({apodo, contrasena, correo, secretKey, idamigo, publicKey})` | Encrypts `apodo`/`correo`/`secretKey`/`idamigo` with `encriptarDatosSistema`, hashes `correo`/`idamigo` with `hashDatosSistema`, `User.create(...)`. |
| `añadirUsuariosBloqueados` / `eliminarUsuariosBloqueados` | Wrap `_toggleArrayUsuario` for `users_bloq`; blocking also pulls the target from `contactos`. |
| `añadirUsuariosSilenciados` / `eliminarUsuariosSilenciados` | Wrap `_toggleArrayUsuario` for `users_silence`, plus syncing the corresponding dedicated chat's `silenciado` flag. |
| `cambiarContraseñaUsuario` / `cambiarCorreoUsuario` / `cambiarApodoUsuario` | Update password/email/nickname with cooldown timestamps (`exp_bloq_*`), re-encrypting where relevant. |
| `ActualizarSecretKeyUsuario(actualizar)` | Generates a fresh 32-byte key; if `actualizar`, persists it encrypted and updates the cache. |
| `obtener_datos_usuario(id, datos_usar)` / `obtener_varios_usuarios(ids, datos_usar)` | Main read paths, cache-first (checks `session_cache_usuarios`, falls back to `User.findById`/`find` with a lean projection), decrypt via `procesarUsuario`, then strip `correo` if the target has `mostrarCorreo: false` and isn't the caller. |
| `encontrar_usuario(texto, correo)` | Look up a user by hashed email or hashed "friend ID" (`idamigo_hash`), excluding blocked/invisible/non-discoverable accounts. |
| `VINCULAR_CHAT_CONTACTO`, `AÑADIR_CONTACTO`, `ELIMINAR_CONTACTO`, `OBTENER_HIST_CHATS_CONTACTOS` | Contact list management, using `chats_contactos_hist` to remember/restore the dedicated 1:1 chat id across contact deletion/re-addition. |
| `toggleInvisibleUsuario`, `toggleMostrarCorreoUsuario` | Generic boolean-flag togglers backed by `_toggleBoolean`. |
| `obtenerChatsUsuarioDB()` | Fetches just the `chats` array for the current user, decrypted, for DB-authoritative resync. |

### 5.2 `ChatRepository.js`

Owns chat lifecycle (create/expand/expel/admin roles), the E2EE ratchet key material at rest, and chat-name resolution for the renderer.

| Function | Purpose |
|---|---|
| `obtener_datos_chats({data, grupales, mensajes})` | Bulk-loads chats by id list, optionally attaching the last 30 messages per chat (decrypted via `descifrarListaMensajes`), then resolves display names. |
| `obtener_datos_chat_unico(id_chat, datos_buscar)` | Single-chat read with dynamic field projection; supports a virtual `nmensajes` field (a separate `countDocuments`); applies the block/expulsion "frozen snapshot" from the caller's `User.chats` entry; filters messages via `filtrar_mensajes_membresia`; strips `ratchet_keys` before returning. |
| `CREAR_CHAT_NUEVO(ids, nombre, id_chat, solicitudAceptada)` | Two modes: **add to existing chat** (may generate a pending-request special message for 2-person chats instead of adding directly, unless `solicitudAceptada`) or **create new chat** (builds the full `ratchet_keys` matrix — one Sender Key per member, wrapped per-recipient with `cifrarConX25519`), pushes the chat into each member's `User.chats`, registers initial membership via `registrar_entrada_chat`, and notifies via `Añadir_Entrada_Buzon_Usuario`. |
| `expulsar_usuario_chat` | Removes a user from `chat.usuarios` (admin-only), freezes their view (`nombre_bloqueo`, `participantes_bloqueo`, `expulsado: true` on their `User.chats` entry), closes their membership window via `registrar_salida_chat`. |
| `RESPONDER_SOLICITUD_AÑADIR` | Accept/reject a pending add-request special message; on accept, calls `CREAR_CHAT_NUEVO` with `solicitudAceptada: true`. |
| `resolverNombresChats` / `resolverNombresYBloqueos` | Decrypts `chat.nombre`/`chat.descripcion`; for unnamed 1:1 chats, resolves a display name from the caller's `contactos` or the target's own `apodo` (prefixed `~`). |
| `HACER_ADMIN_CHAT` / `QUITAR_ADMIN_CHAT` | Admin-only add/remove entries in `chat.admins`. |
| `rotarClavesChat(id_chat, id_emisor)` | Generates a new Sender Chain Key for one emisor, rewraps it per-recipient, replacing only that emisor's `ratchet_keys` entries. Called both on-demand (message-send failure recovery) and automatically past a rotation threshold. |
| `SILENCIAR_CHAT_USUARIO` / `BLOQUEAR_CHAT_USUARIO` | Toggle per-chat mute/block on the caller's `User.chats` entry; blocking snapshots the chat (name/participants) and closes/reopens a `MembresiaChat` window so messages sent while blocked stay hidden. |
| `LIMPIAR_MENSAJES_CHAT` / `GESTIONAR_ELIMINAR_CHAT` | Wipe all messages in a chat, or fully delete the chat for the caller (falls back to "just clear messages" if the other party is a saved contact, to avoid destroying a contact's shared chat). |
| `ACTUALIZAR_DATOS_CHAT` | Admin-only update of `nombre`/`descripcion` (encrypted) and `escaneres_seguridad`. |
| `setChatEnCacheRaw` | Currently a **no-op** — comment says "cache_chats has been removed" — retained only so callers don't need to change; effectively dead code. |

### 5.3 `MessageRepository.js`

Owns message send/receive, the ratchet message-key derivation, and encrypted file storage in GridFS.

| Function | Purpose |
|---|---|
| `ENVIAR_MENSAJE({asunto, archivos, id_chat, id_emisor})` | Full send pipeline (see §5.4 flow below): loads chat+sender, checks the sender hasn't blocked the chat, decrypts the sender's own ratchet chain key (with rotation/identity-regeneration fallback on failure), derives a per-message key via `ratchetChainKey`, encrypts attached files through GridFS (`crearCipherStream`), encrypts the message payload (`cifrarContenido`), persists the `Message` doc and advances the ratchet counter, then fires notifications via `Añadir_Entrada_Buzon_Usuario`. |
| `obtener_datos_mensaje(id_chat, id_mensaje)` | Single-message read + decrypt via `descifrarListaMensajes`. |
| `obtener_mensajes_paginados(id_chat, limit, cursor_id, direction)` | Cursor-based pagination using `_id` comparisons (`$lt`/`$gt`), decrypts the page. |
| `DESCARGAR_ARCHIVO` / `OBTENER_PREVIEW_IMAGEN` / `OBTENER_AUDIO_MENSAJE` | Stream a file out of GridFS (`GridFSBucket`, bucket `ArchivosChats`), deriving the file's decryption key via `getMessageKey()` (re-derives from the ratchet at the message's recorded iteration) with a fallback to the per-file `key_enc` stored on the message if the ratchet has since rotated past that point. |
| `ELIMINAR_MENSAJE` | Sender-or-admin-only; deletes any attached GridFS files, replaces `contenido`/`encriptado` with a "deleted" placeholder, unpins the message if it was pinned. |
| `FIJAR_MENSAJE` / `DESFIJAR_MENSAJE` | Admin-only pin/unpin, stored on `Chat.msfijado`; notifies via buzón. |

### 5.4 `BuzonRepository.js`

| Function | Purpose |
|---|---|
| `Añadir_Entrada_Buzon_Usuario({ids, tipo, data})` | Fan-out notification writer. Filters out recipients who have blocked/muted the sender or the chat, or are `invisible`; excludes the sender itself; encrypts `data` once with `encriptarDatosSistema`; bulk-upserts a push into each recipient's `entrada` array (capped at `MAX_ENTRADAS` via `$slice`), bumping `updatedAt`. |
| `Revisar_Buzon_Usuario()` | Atomically drains the caller's mailbox (`findByIdAndUpdate` setting `entrada: []`, `new: false` to return the pre-clear doc), decrypts each entry's `data`. |

### 5.5 `SecurityRepository.js`

Thin CRUD wrappers around the `Security.js` models for: email/account verification codes (`InsertarVC`/`InsertarCuentaVC`/`InsertarDatosCuentaVC`, `Buscar*`, `Borrar*`), session/trusted-device JWT tokens (`AñadirJWTUsuario`, `AñadirJWTUsuarioVC`, `AñadirJWTDPConfianza`, `ObtenerSesionesPorCorreo`, `ObtenerDPConfianzasPorCorreo`, `RevocarSesionPorDispositivo`, `RevocarDPConfianzaPorDispositivo`, `LimpiarJWT*`), and device blocking (`BloquearDispositivo`, `DesbloquearDispositivo`, `ObtenerDPsBloqueadosPorCorreo`). Every write encrypts `correo`/`id_dp`/`os`/`nombre` and computes their `_hash` counterparts; every targeted read is by `_hash` field, and decrypts the encrypted fields before returning (`_descifrarInfoDispositivo` helper for the device-info fields).

### 5.6 `rateLimitRepository.js`

| Function | Purpose |
|---|---|
| `estaDispositivoBloqueadoApp(id_dp_hash)` | Checks `AppBlockedDevices` for a permanent block. |
| `registrarInfraccionPersistent(id_dp_hash)` | Upserts/increments today's `RateLimitAudit.intentos` for a device; at 5 infractions in one day, upserts an `AppBlockedDevices` record (permanent block) and returns `bloqueadoAhora: true`. |

This is the persistent backstop for an in-memory rate limiter elsewhere in the app (not covered here — see `CACHE_SYSTEM.md`/security docs for the in-memory side).

### 5.7 `membresiaRepository.js`

| Function | Purpose |
|---|---|
| `registrar_entrada_chat(usuario_id, chat_id, primer_msg_id)` | Pushes a new open block `{entro: primer_msg_id\|null, salio: null}` onto the user's `MembresiaChat.bloques` (upsert). |
| `registrar_salida_chat(usuario_id, chat_id, ultimo_msg_id)` | Closes the currently-open block (`bloques.salio === null`) by setting `salio`; if no open block exists (original member, no prior record), retroactively pushes `{entro: null, salio: ultimo_msg_id}`. |
| `filtrar_mensajes_membresia(usuario_id, chat_id, mensajes)` | Given a message list, drops any message whose id falls outside every recorded `[entro, salio]` window (ObjectId string comparison exploits their chronological ordering); no `MembresiaChat` doc at all means unrestricted. |

Called from `ChatRepository` (on join/expel/block/unblock) and consumed in `obtener_datos_chats`/`obtener_datos_chat_unico` to hide messages sent outside a user's membership window.

---

## 6. Request flow: IPC handler → Repository → Model → MongoDB

Example trace for sending a message (`enviar-mensaje` IPC channel, registered in `backend/ipc/chat_ipc.js`):

```
Renderer (preload bridge)
   │  ipcRenderer.invoke("enviar-mensaje", {asunto, archivos, id_chat, id_emisor})
   ▼
backend/ipc/chat_ipc.js
   │  ipcMain.handle("enviar-mensaje", (_, payload) => ENVIAR_MENSAJE(payload))
   ▼
backend/repositories/MessageRepository.js :: ENVIAR_MENSAJE()
   │  1. ChatsRavage.findById() + User.findById()      ──▶ Mongo (chats / usuarios)
   │  2. getIdentity() + descifrarConX25519()          ──▶ decrypt own ratchet chain key
   │  3. ratchetChainKey()                             ──▶ derive per-message key (local, no I/O)
   │  4. crearCipherStream() → GridFSBucket upload      ──▶ Mongo GridFS (ArchivosChats.files/.chunks)
   │  5. cifrarContenido(payload, chatKey)              ──▶ encrypt message body (local)
   │  6. MessagesRavage.create(mensaje)                 ──▶ Mongo (messages)
   │     ChatsRavage.updateOne(ratchet counter++)        ──▶ Mongo (chats)
   │  7. User.updateMany(ultimomensaje, ultimoCambio)    ──▶ Mongo (usuarios) [fire-and-forget]
   │  8. Añadir_Entrada_Buzon_Usuario()                  ──▶ BuzonRepository → Mongo (buzon) [fire-and-forget]
   ▼
Mongoose models (Message.js / Chat.js / User.js / Buzon.js)
   ▼
MongoDB Atlas (TLS connection opened once via backend/db/mongo.js)
```

Reads follow the mirror path with a decrypt step instead of encrypt:

```
IPC handler → Repository.find/get() → Model.find().lean() → MongoDB
                                            │
                                            ▼
                              procesarUsuario() / descifrarListaMensajes()
                              (desencriptarDatosSistema per EncryptedData field)
                                            │
                                            ▼
                              plaintext object returned to IPC handler → renderer
```

**Encrypt-on-write / decrypt-on-read pattern**: repositories are the only layer allowed to call `encriptarDatosSistema`/`desencriptarDatosSistema`/`hashDatosSistema` (system-key fields) or `cifrarContenido`/`descifrarConX25519`/`ratchetChainKey` (ratchet-encrypted message fields, in `cryptoService.js` and `messageCryptoService.js`). Models never see plaintext going in, and callers above repositories never see ciphertext coming out — `.lean()` query results always get passed through a decrypt helper (`procesarUsuario`, `descifrarListaMensajes`, or inline `desencriptarDatosSistema` calls) before being returned up the stack. Some repository reads short-circuit against the in-memory `session_cache_usuarios` cache (already-decrypted) before hitting Mongo at all — see §5.1.

---

## 7. Summary: what lives where

| Data | Store | Encrypted at rest? | Cross-device? |
|---|---|---|---|
| User profile (nickname, email, friend-id, secret key) | MongoDB `usuarios` | Yes (system key) | Yes |
| Chat metadata, ratchet keys | MongoDB `chats` | Name/description + ratchet key material yes | Yes |
| Messages | MongoDB `messages` | Yes (ratchet-derived key) + system-key subject echo | Yes |
| Message attachments | MongoDB GridFS (`ArchivosChats` bucket) | Yes (ratchet-derived key, stream cipher) | Yes |
| Mailbox / notifications | MongoDB `buzon` | Yes (system key), 90-day TTL | Yes |
| Sessions, verification codes, device blocks | MongoDB (various `Security.js` collections) | Yes (system key), several with short TTLs | Yes |
| Chat membership windows | MongoDB `membresias_chat` | No (only ObjectIds) | Yes |
| Download history / add-user search history | Local SQLite `cache.db` | No | No (per-device) |
| Session user cache, active-chat cache, etc. | In-process JS `Map`/objects | N/A (already-decrypted, RAM-only unless separately persisted) | No (per-process) |
