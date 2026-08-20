# Cache System

> **Read this before trusting the root `README.md`.** Its "Sistema de Caché Multinivel" section describes a RAM-`Map` + LFU-eviction + disk-minification + 10-15s debounce architecture with dedicated files `_cache_usuarios.js` and `_cache_img_extensiones.js`. None of that exists in the current codebase. The cache layer was rewritten to be backed by an embedded SQLite database (`better-sqlite3`), and the eviction policy is TTL + size-based, not LFU. This document describes the code as it exists today, verified file-by-file.

## 0. Current file inventory

```
backend/STORAGE/
├── Variables_sesion.js                              # in-memory session variables (getters/setters)
├── ajustes_defecto.js                                # default app settings object
└── CACHE/
    ├── database.js                                   # better-sqlite3 connection + schema (see Docs/backend/DATA_LAYER.md)
    ├── cache.db                                       # the SQLite file itself (gitignored data, present locally)
    ├── _cache_archivos_descargados.js                # downloaded-files history — SQLite-backed
    ├── _cache_chat_activo.js                          # active-chat cache — pure in-memory Map, 3-min TTL
    └── _cache_historial_busquedas_añadir_usuario.js   # search-history cache — SQLite-backed
```

There is **no** `_cache_usuarios.js` and **no** `_cache_img_extensiones.js` anywhere in the repo (confirmed via `ls backend/STORAGE/CACHE/`). User caching now lives directly inside `backend/repositories/UserRepository.js` as a plain in-memory `Map` (`session_cache_usuarios`) — see §3. The "icon by file extension" cache described in the README does not currently exist as a backend cache module.

`database.js` (the SQLite connection, schema, and the two SQL-backed tables) is documented in full in `Docs/backend/DATA_LAYER.md` by a different pass — this document only describes how the cache modules built on top of it behave, and cross-references it rather than duplicating its schema details.

---

## 1. `backend/STORAGE/Variables_sesion.js`

Not a cache in the eviction sense — a flat module holding the current session's state in process memory (module-level `let` variables with getter/setter exports). Reset on relaunch since it's memory-only. Key state:

| Variable | Get / Set | Notes |
|---|---|---|
| `Correo_Usuario_sesion`, `Apodo_Usuario_sesion` | `getCorreoSesion`/`setCorreoSesion`, `getApodoSesion`/`setApodoSesion` | Current user identity |
| `FechaCreacionCuenta` | `getFechaCreacionCuenta`/`setFechaCreacionCuenta` | Formatted `dd/mm/yyyy` from Mongo's account-creation date |
| `FechaBloqueoApodo`/`FechaBloqueoCorreo`/`FechaBloqueoContraseña` | matching getters/setters | Cooldown countdowns, computed as `"Xh Ym"` or `"Ym"` remaining from a target unlock `Date`; set to `""` once expired |
| `UsuariosSilenciados`, `UsuariosBloqueados` | `getUsuariosSilence`/`setUsuariosSilence`, `getUsuariosBloqueados`/`setUsuariosBloqueados` | In-memory copies of the muted/blocked lists |
| `IdDispositivo`, `IdMongodbUsuario`, `secretKey` | corresponding getters/setters | Device id, Mongo `_id` of the user, session secret key |
| `ListaChats` | `setListaChats`/`getListaChats` | Normalized to `{id, apodo, grupo, ultimoCambio}` on write — see `chat_ipc.js`'s `obtener-chats-usuario` |
| `ListaContactos` | `setListaContactos`/`getListaContactos` | Normalized to `{id, apodo, chat_id}` |
| `VisibleUsuario`, `InvisibleUsuario`, `MostrarCorreoUsuario`, `IDamigo` | getters/setters | Privacy toggles + friend-id |
| `mainWindow` | `getMainWindow`/`setMainWindow` | Reference to the Electron `BrowserWindow` |

This module holds no persistence logic of its own — it is pure runtime state, populated by the IPC handlers on login and read back by other IPC handlers.

---

## 2. `backend/STORAGE/ajustes_defecto.js`

Exports one constant, `AJUSTES_APP_DEFAULT`, the default shape of the app's settings object (persisted to disk elsewhere as `ajustes_app.json` via `controladorArchivos.js`, outside this document's scope). Defaults as they currently stand in code:

| Key | Default | Purpose |
|---|---|---|
| `MSBienvenida` | `true` | One-time welcome message flag |
| `URL_DESCARGA` | `app.getPath("downloads")` (or `cwd()/downloads` outside Electron) | Download destination |
| `PREVISUALIZACION_URL` | `true` | Enable link previews |
| `DESACTIVAR_SEGUNDO_PLANO` | `false` | Disable background/tray mode |
| `NOTI_OS_MENSAJE_INDIVIDUAL` / `NOTI_OS_MENSAJE_GRUPAL` | `true` | OS notifications for 1:1 / group messages |
| `NOTI_OS_DESCARGA_INDIVIDUAL` / `NOTI_OS_DESCARGA_GRUPAL` | `true` | OS notifications for downloads |
| `NOTI_OS_MENSAJE_FIJADO` | `true` | OS notification when a message is pinned |
| `NOTI_OS_GRUPO_PERSONAL` | `true` | OS notification for personal-group events |
| `ESCANER_ESTEGANOGRAFIA`, `ESCANER_ZALGO`, `ESCANER_URL_MALICIOSA`, `ESCANER_COMANDOS_TERMINAL`, `ESCANER_CRYPTO_BILLETERAS`, `ESCANER_HOMOGLIFOS` | `1` (warn) | Default-on security scanners |
| `ESCANER_XSS`, `ESCANER_CODIGO`, `ESCANER_DIRECCIONES_IP` | `0` (off) | Default-off security scanners |
| `NUM_WORKERS` | `0` | `0` = auto-sized from CPU count |
| `CORREO_INICIO_SESION`, `CORREO_CAMBIO_CONTRASEÑA`, `CORREO_CAMBIO_CORREO`, `CORREO_CAMBIO_APODO`, `CORREO_DISPOSITIVO_CONFIANZA`, `CORREO_SESION_CERRADA`, `CORREO_DISPOSITIVO_BLOQUEADO` | `true` | Transactional email notification toggles (verification-code emails are never gated by these) |

The scanner value semantics (`0` = disabled, `1` = warn, `3` = warn + auto-format/strip) match the whitelist enforced in `chat_ipc.js`'s `actualizar-datos-chat` handler — see `Docs/backend/IPC_AND_SERVERS.md` §1.2.

---

## 3. User cache — now inside `UserRepository.js`, not a standalone `_cache_usuarios.js`

The README's `_cache_usuarios.js` (RAM+disk, "LFU + protección temporal") does not exist. Instead, `backend/repositories/UserRepository.js` keeps a single module-level cache:

```js
let session_cache_usuarios = new Map();  // in-memory, lives for the process's lifetime
const MAX_SESSION_CACHE_MB = 50;
```

### 3.1 Shape

Each entry: `session_cache_usuarios.set(id, { data: procesado, timestamp: Date.now() })`, keyed by the user's Mongo `_id` as a string.

### 3.2 Eviction policy — TTL + size, not LFU

`REVISAR_LIMPIEZA_CACHE_SESION()` runs on relevant cache writes/reads and does two passes:

1. **TTL pass:** deletes any entry whose `timestamp` is older than **15 minutes** (`15 * 60 * 1000` ms).
2. **Size pass:** sorts remaining entries oldest-first by `timestamp`, walks them accumulating an estimated size (`JSON.stringify(entry.data).length * 2` bytes, i.e. UTF-16 code-unit approximation, converted to MB), and deletes any entry once the running total would exceed **50 MB** (`MAX_SESSION_CACHE_MB`).

There is no frequency counter anywhere in this module — access frequency (LFU) plays no role. The closest thing to "temporal protection" is that `getUsuarioDeCache()` and cache hits in `obter_datos_usuario`/`obtener_varios_usuarios` refresh `entry.timestamp = Date.now()` on read, which resets the 15-minute TTL clock (functionally similar in effect to the old doc's "protection window," but implemented as TTL-refresh-on-access rather than a fixed do-not-evict window).

### 3.3 No disk persistence for this cache

Unlike the README's claim of encrypted disk persistence with minification, this cache is **pure RAM** — there is no `saveCacheChatsFile()`/`saveCacheUsersFile()` equivalent, no minified on-disk JSON shape (`{i, n, u, f, t}`), and no debounce timer writing it to disk. It is rebuilt from MongoDB on demand as entries are queried, and is entirely lost on app restart.

### 3.4 Read/consume semantics — cache entries are one-shot on the "full profile" path

`obtener_datos_usuario(id, datos_usar)`: checks the cache first. A hit is only used if:
- called with no `datos_usar` and the cached entry isn't the caller's own profile → requires the cached entry to already include `correo` (entries stored from a lightweight search only have `{_id, apodo}` and are rejected here), **or**
- called with a specific `datos_usar` field list → requires the cache entry to be **fresher than 5 minutes** and to already contain every requested field (`_faltan_datos` check); otherwise it's a forced miss.

On a hit, the entry is **deleted from the backend cache** (`session_cache_usuarios.delete(idStr)`) before being returned — the assumption is that the renderer's own frontend-side active cache now owns it. A miss triggers a `User.findById(...).lean()` query, and the result is written back into the cache with a fresh timestamp.

`obtener_varios_usuarios(ids, datos_usar)` does the same per-id, in bulk: chunks any cache-missing ids into batches of 50 for the Mongo query (`CHUNK_SIZE = 50`), then repopulates the cache for exactly the ids that were fetched from DB.

`GUARDAR_USUARIOS_EN_PERSISTENTE(usuarios)` (exposed via the `guardar-varios-usuarios-externos` IPC channel) lets the renderer hand a batch of users back into this cache when it evicts its own active-chat UI cache — it strips the redundant string `id` field and converts `_id` back to a Mongo `ObjectId` to save RAM before storing.

`clearCacheUsuarios()` empties the whole map; `getUsuarioDeCache(id)` (used by the `get-usuario-cache` IPC channel) is a read-only lookup that also refreshes the entry's `timestamp` without deleting it.

`ChatRepository.js` also reaches into this same cache (`getUsuarioDeCache`/`setUsuarioEnCache`, dynamically imported) to resolve chat participants without a DB round-trip.

---

## 4. `_cache_chat_activo.js` — active-chat cache

A small, pure in-memory `Map` (no SQLite, no disk) that holds lightweight metadata for whichever chat(s) the renderer currently has open.

| Constant | Value |
|---|---|
| `TIEMPO_VIDA_MS` | 3 minutes — each chat entry gets its own `setTimeout` that self-evicts it |
| `MAX_CHATS` | 2 — capacity limit |

Behavior:
- `crearCacheChatActivo(datos)`: if the map is at capacity (`MAX_CHATS`) and the incoming chat id isn't already cached, evicts the **oldest** entry (`Map` iteration order = insertion order, so `.keys().next().value` is the oldest) before inserting. Only a fixed field whitelist is merged in (`nombre, seguridad, usuarios, admins, fecha_creacion, nmensajes, d_participantes`), with a special case to avoid clobbering an existing `nombre` with `null`/`undefined`. On any change, the entry is deleted and re-inserted to keep it "freshest" in iteration order (acts as an LRU-ish reordering, not LFU). Every write/read resets that chat's 3-minute expiry timer.
- `obtenerCacheChatActivo(id, bloque)`: reads an entry (optionally just its `seguridad` sub-field) and resets its expiry timer.
- `borrarCacheChatActivo(id?)`: deletes one chat's entry + timer, or (called with no id) clears everything and all timers.

This is the backing store for the `guardar-cache-chat-activo` / `obtener-cache-chat-activo` IPC channels in `chat_ipc.js`.

---

## 5. `_cache_historial_busquedas_añadir_usuario.js` — search-history cache (SQLite)

Backed entirely by the `historial_busquedas` table in `database.js` (via prepared `better-sqlite3` statements) — no in-memory layer at all despite the "variable cache" naming left over in its exported function names.

| Constant | Value |
|---|---|
| `LIMITE_HISTORIAL` | 200 rows max |
| `SEMANA_MS` | 7 days — interval between "revalidate against MongoDB" sweeps |
| `DIAS_2_MS` | 2 days — an entry must be at least this old to be considered for eviction ahead of the least-recently-used one |
| `DIAS_90_MS` | 90 days — entries past this age are prioritized for eviction over "just old" ones |

### 5.1 Weekly revalidation

`_revisar_cache_semanal()` runs on every read/write entry point (`_asegurar_inicio()`). If more than `SEMANA_MS` has passed since `_fecha_actualizado_global`, it calls `revisar_mongodb_datos()`, which re-checks every stored search term/id against MongoDB (`encontrar_usuario`) and deletes rows for users that no longer resolve (e.g. deleted accounts).

### 5.2 Eviction — smarter-than-plain-LRU, but not LFU by frequency alone

`_borrar_inteligentemente()` runs only when the row count exceeds `LIMITE_HISTORIAL` (200), and evicts **one row per call** (called in a `while` loop from `añadir_historial` until back under the limit). Candidate selection, scanning every row each call:

1. Track the single globally-oldest row (`masViejo`) as a fallback.
2. Among rows older than `DIAS_2_MS` (2 days), pick the "best candidate to evict," preferring in order:
   - rows older than `DIAS_90_MS` (90 days) over merely-2-days-old rows,
   - within the same age tier, the row with the **lowest `veces_buscado`** (search count — this is the LFU-like part),
   - ties broken by the **older `ultima_vez`** (last-searched timestamp).
3. Evict `mejorCandidato` if one was found (i.e. something is at least 2 days old); otherwise fall back to evicting the single oldest row (`masViejo`), even if it's younger than 2 days — this guarantees the cap is always enforced.

### 5.3 Writes

`añadir_historial(id, datoUsado)`: looks up by search term first, then by id; if found, increments `veces_buscado` and bumps `ultima_vez` (an `INSERT OR REPLACE`, i.e. upsert); if not found, inserts a new row with count `1` and only then checks/enforces the 200-row cap.

`limpiar_variable_cache()` / `cancelar_limpieza_variable_cache()` are exported no-ops — kept so `cache_persistent_ipc.js` doesn't need changes, but they do nothing now that there's no in-memory debounce timer to cancel (SQLite writes are synchronous and immediate via `better-sqlite3`).

---

## 6. `_cache_archivos_descargados.js` — downloaded-files history (SQLite, gzip-compressed)

Also SQLite-backed (`archivos_descargados` table), but unlike the search-history cache, values are **gzip-compressed** before being stored as the row's `data` column.

| Constant | Value |
|---|---|
| `LIMITE_RAM_MB` | 256 MB — despite the name, this bounds the **decompressed, in-memory-estimated** size of everything currently in the table, not an actual RAM cache |
| `TIEMPO_EXPIRACION` | 5 minutes — declared but not read anywhere in the current file (dead constant) |
| entry-count limit | configurable, default **20**, read from `ajustes_app.json`'s `LIMITE_CACHE_ARCHIVOS_DESCARGADOS` key (`obtenerLimiteCacheArchivosDescargados()`), falls back to `20` if unset |

### 6.1 Write path (`setCacheArchivosDescargados`)

- Called with the literal string `"c"` → clears the whole table (used by the frontend as a shorthand "clear" signal).
- Otherwise, requires a non-empty object; computes an id from `cache.id_archivo ?? cache.id ?? cache.ruta ?? Date.now()`.
- **Compression:** `gzipSync(JSON.stringify(cache))` — the row stores compressed bytes, not raw JSON. No separate minification step (no short-key remapping like the README's `{i, n, u, f, t}` example) — gzip is the only size optimization applied.
- Upserts via `INSERT OR REPLACE`.
- **Count eviction:** deletes the oldest row (by `timestamp ASC`) repeatedly while `count > limite` (the configurable per-entry-count limit above).
- **Size eviction:** re-reads and decompresses every row to estimate total size with a hand-rolled `_estimar_bytes_rapido()` (2 bytes/char for strings, 8 for numbers, 4 for booleans, recursive for objects/arrays — a UTF-16-code-unit approximation, not exact byte size), and deletes the oldest row repeatedly while the estimated total exceeds `LIMITE_RAM_MB` (256 MB).

### 6.2 Read path (`getCacheArchivosDescargados`)

Reads every row, attempts `gunzipSync` first; if that throws (e.g. a legacy uncompressed row from before this format was introduced), falls back to parsing the raw stored value as JSON directly — a backward-compatibility shim, not the primary path.

### 6.3 Other exports

`clearCacheArchivosDescargados()` — clears the table. `setLimiteCacheArchivosDescargados(limite)` — validates `limite` is a non-negative number, then persists it to `ajustes_app.json`.

---

## 7. Debounced disk persistence — does not exist as described

The README describes a `setChatEnCache() → _gestionar_persistencia_frecuentes() → setTimeout(10000ms) → saveCacheChatsFile()` debounce chain writing minified, encrypted JSON to disk every 10-15 seconds. No function named `_gestionar_persistencia_frecuentes`, `saveCacheChatsFile`, or `saveCacheUsersFile` exists anywhere in the current `backend/` tree (verified by search). All persistence in the current cache layer is either:
- immediate, synchronous SQLite writes (`better-sqlite3` is synchronous by nature) for the search-history and downloaded-files caches, or
- no persistence at all, for the user session cache and the active-chat cache (both pure in-memory `Map`s that reset on app restart).

There is no debounce timer anywhere in the current cache code.

---

## 8. RAM vs. disk strategy selection — not currently wired up

`backend/utils/systemInfo.js` still exports `getRecommendedCacheStrategy()`, which maps total system RAM to a `{type: 'ram'|'disk', sizeMB}` recommendation (thresholds unchanged: ≥31GB→4096MB RAM, ≥15GB→2048MB RAM, ≥7GB→1024MB RAM, <7GB & >50GB free disk→2048MB disk, else 256MB RAM fallback — see `Docs/backend/IPC_AND_SERVERS.md` §3 for the full table). However, as of this codebase, **no code in `backend/` calls this function** — none of the cache modules described in this document (§3-§6) consult it. The current caches use fixed limits (50 MB for the user cache, 256 MB estimated for the downloaded-files cache, fixed row counts elsewhere) regardless of the host machine's resources. The adaptive-strategy machinery exists but is currently dormant.

---

## 9. Minification before serialization — not currently implemented

The README's example of remapping long keys to single letters before writing to disk (`{_id, nombre, usuarios, _frequency, _last_used}` → `{i, n, u, f, t}`) has no equivalent in the current code. The only size-reduction technique actually applied is **gzip compression** on the downloaded-files cache (§6.1) — nothing else is minified or key-shortened before being persisted.

---

## 10. `backend/utils/conversores.js` and `backend/utils/libs.js`

Brief, since these are general utility modules rather than cache-specific:

- **`conversores.js`** exports `convertirObjectId(v)`, a recursive normalizer that turns MongoDB/Mongoose `ObjectId`s (including IPC-serialized buffer-shaped objects, which lose their prototype crossing the `contextBridge`) into plain strings, deep-walking arrays and objects, and mirroring any `_id` it converts into a sibling `id` field. Used throughout the repository layer (including the cache read paths in `UserRepository.js`, via `_getID`) to normalize ids coming back from the renderer over IPC.
- **`libs.js`** is the project's centralized, mostly-lazy import hub (see its own header comment). Relevant to the cache layer specifically: it re-exports `gzipSync`/`gunzipSync` (used by `_cache_archivos_descargados.js`, §6) and lazily loads `systeminformation` as `si` (used by `systemInfo.js`, §8) and `better-sqlite3` is imported directly by `database.js` rather than through this hub.

---

## 11. Cross-references

- SQLite schema, tables, and query layer: `Docs/backend/DATA_LAYER.md`.
- Full IPC channel list for all cache-related channels: `Docs/backend/IPC_AND_SERVERS.md` §1.6-1.7.
- `systemInfo.js` resource detection: `Docs/backend/IPC_AND_SERVERS.md` §3.
