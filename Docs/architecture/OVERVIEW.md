# Ravage — Architecture Overview

> **Scope of this document.** This is the top-level map of the codebase. It explains what the app is,
> how the Electron process model is wired, what `main.js` does on startup, and gives a directory-by-directory
> tour of the repository. Deep dives into specific subsystems live in the linked documents below — this
> file intentionally does not duplicate their detail.

> **Note on the root `README.md`.** The root README describes an older design (bcrypt-only hashing,
> RSA-2048 key wrapping, no local SQLite cache, no worker threads, no security scanners). The current
> source code has moved past that description. This document — and the ones it links to — were verified
> directly against the code in `backend/`, `frontend/`, `preload/`, `main.js` and `package.json` as of this
> writing. Notable discrepancies are called out inline.

---

## 1. What Ravage is

Ravage is a self-hosted, end-to-end encrypted desktop messaging application built on Electron and Node.js.
Per the product framing in the root README, it is aimed at small/medium private groups who want to run
their own messaging infrastructure (own MongoDB instance, own server) rather than depend on a third-party
service — it is explicitly not trying to compete with WhatsApp/Telegram/Signal in scale or feature set
(no calls, no massive concurrency target).

Functionally, the app provides:

- End-to-end encrypted text messaging between users, using a Sender-Key-Ratchet-style protocol.
- Encrypted, streamed file transfer (chunked, not buffered fully in memory) stored in MongoDB GridFS.
- Multi-factor login (password + emailed verification code) with device trust/blocking.
- A local, encrypted, multi-level cache (in-memory + `better-sqlite3` on disk) with fixed size/TTL limits,
  to keep the UI responsive without re-fetching everything from MongoDB.
- Real-time push notifications via MongoDB Change Streams + Socket.IO.
- Content security scanners for message text (URL/homoglyph/zalgo/XSS checks) before it reaches the UI.

## 2. Verified vs. outdated claims (README vs. current code)

| Topic | Root README claims | Current code (verified) |
|---|---|---|
| Password hashing | bcrypt, 14 rounds | **Argon2id** (`argon2` package) — see `backend/services/cryptoService.js`, `Docs/Services/seguridad/HASHING_CONTRASENAS.md` |
| Key exchange for E2EE | RSA-2048 with OAEP | **X25519** ECDH + HKDF, see `generarLlavesX25519`, `cifrarConX25519`, `descifrarConX25519` in `backend/services/cryptoService.js` |
| Local structured cache | In-memory Map + minified JSON files on disk | Same idea plus a **`better-sqlite3`** persistent cache database (`backend/STORAGE/CACHE/database.js`, `cache.db`) for downloaded-file history and search history |
| CPU-heavy work | Not mentioned | Dedicated **worker-thread pools** for crypto (`cryptoWorker.js`) and content scanning (`escanerWorker.js`), managed by `backend/utils/workers/workerPool.js` |
| Rate limiting | Not mentioned | Both an **Express** global rate limiter (`express-rate-limit`) on the local/Railway servers and an **in-memory IPC rate limiter** (`backend/utils/rateLimiter.js`) guarding auth-sensitive IPC calls |
| Security scanners | Not mentioned | `backend/services/seguridad/escanerMensaje.js` — URL reputation (Google Safe Browsing), homoglyph/zalgo detection, XSS sanitization (DOMPurify). There is **no** file-content scanner: the former empty `escanerArchivos.js` stub has been deleted |
| Env var handling | Plain `.env` in project root | **Encrypted OS-native vault** (`backend/utils/env_vault.js`, Electron `safeStorage`) — see `Docs/architecture/BUILD_AND_ENVIRONMENT.md` |
| Chat membership model | Not detailed | Dedicated `MembresiaChat` model/repository tracking per-user join/leave points in a chat, used to filter which messages a user can see |

The layered E2EE/at-rest/local-storage encryption *concepts* described in the README (multiple encryption
layers, `EncryptedData` Mongoose sub-schema, ratchet-based per-message key derivation, key rotation after N
iterations) are still directionally accurate, but with X25519 replacing RSA for key wrapping and Argon2id
replacing bcrypt for hashing. Full verified detail belongs in `Docs/backend/CRYPTO_SECURITY.md`.

---

## 3. Process model

Ravage is a standard two-process Electron app:

```
┌────────────────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS (Node.js)                         │
│  main.js — app lifecycle, window, tray, server, DB, IPC handlers       │
│  backend/ — services, repositories, models, IPC, servers, cache, utils │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │ contextBridge (preload.bundle.cjs)
                                 │ ipcMain.handle / ipcRenderer.invoke
┌───────────────────────────────▼──────────────────────────────────────┐
│                       RENDERER PROCESS (Chromium)                      │
│  frontend/ — HTML/CSS/vanilla JS ES modules, no Node access            │
└────────────────────────────────────────────────────────────────────────┘
```

The renderer's `webPreferences` (set in `main.js`, function `createMainWindowHome`) are locked down:

```js
webPreferences: {
    preload: path.join(__dirname, 'preload.bundle.cjs'),
    nodeIntegration: false,      // renderer has no Node.js require/process/fs access
    contextIsolation: true,      // preload's JS context is isolated from the page's
    sandbox: true,               // OS-level renderer sandboxing
    additionalArguments: [`--js-flags=--max-old-space-size=${HEAP_LIMIT_MB}`],
    spellcheck: false,
    v8CacheOptions: 'bypassHeatCheck',
    backgroundThrottling: false
}
```

Because `sandbox: true` disables Node's `require()` resolution inside the preload script, the preload code
cannot be loaded as raw CommonJS with relative `require('./preload/auth.cjs')` calls — it must be bundled
into a single self-contained file first. That is the reason `preload.bundle.cjs` exists (built by esbuild);
see `Docs/architecture/BUILD_AND_ENVIRONMENT.md` and `Docs/PRELOAD.md` for the full explanation.

With `contextIsolation: true` and `nodeIntegration: false`, the only way the renderer can reach backend
functionality is through the objects the preload script explicitly attaches via
`contextBridge.exposeInMainWorld(...)` — e.g. `window.sesion_usuario`, `window.chats`,
`window.cache_persistente`, etc. (see `preload.cjs`). Each of those objects wraps `ipcRenderer.invoke(...)`
calls; there is no direct access to `fs`, `crypto`, `net`, etc. from the page's JS context.

---

## 4. `main.js` startup sequence

`main.js` is the Electron entry point (`"main": "main.js"` in `package.json`). Before `app.whenReady()` it
also applies a batch of Chromium/V8 performance flags (GPU rasterization, zero-copy texture uploads, a
512 MB V8 heap cap, background networking/renderer throttling tweaks, disabling of unused Chromium
features like Autofill/Translate/MediaRouter).

Startup sequence, gated behind Electron's **single-instance lock**:

```js
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();                       // a second launch just exits...
} else {
    app.on('second-instance', () => { if (mainWindow) mostrarVentana(); }); // ...and focuses the first window
    app.whenReady().then(async () => {
        await inicializarVault();                         // 1. decrypt/migrate env vars from the OS vault
        const [{ startServer }, { connectDB }] =
            await Promise.all([import('.../serverLocalHost.js'), import('.../mongo.js')]);
        socket = await startServer();                      // 2. start Express + Socket.IO on localhost
        await connectDB();                                 // 3. connect to MongoDB (Mongoose, TLS)
        const AutoLogin = await autoLoginUsuario();         // 4. try silent login from encrypted session file
        await createMainWindowHome(AutoLogin?.success ?? false); // 5. create BrowserWindow, register IPC handlers
        setMainWindow(mainWindow);
        // 6. apply the user's saved worker-thread count preference, if any
    });
}
```

Key points:

1. **Env vault first.** `inicializarVault()` (`backend/utils/env_vault.js`) runs before anything else so
   that `process.env` is populated (from the encrypted vault, or by migrating plaintext `.env` files into
   it) before the server or DB connection code reads any secrets. The `env/` directory it migrates from is
   located through `backend/utils/rutas_recursos.js` (`resolverDirEnv()`), so it works both in development
   and inside a packaged (asar) build.
2. **Server before DB, both before the window.** The local Express/Socket.IO server
   (`backend/servidores/serverLocalHost.js`) is started, then MongoDB is connected
   (`backend/db/mongo.js`), then an auto-login attempt is made by reading the encrypted local session file
   (`backend/services/sesionUsuario.js` → `autoLoginUsuario()`), and only then is the `BrowserWindow`
   created — loading either `frontend/home/home.html` (if auto-login succeeded) or
   `frontend/sesion-log/sesion.html` (login/register screen) otherwise.
   `connectDB()` propagates connection errors instead of swallowing them: `main.js` catches them and shows
   a "Sin conexión al servidor" dialog with Retry/Quit buttons; if the user quits, no window is created and
   no auto-login is attempted.
3. **IPC handlers are registered before `loadFile()`** inside `createMainWindowHome`, specifically to avoid
   a race where the renderer's first `ipcRenderer.invoke` calls fire before `ipcMain.handle` listeners
   exist. Handler registration dynamically imports each `backend/ipc/*.js` module in parallel
   (`Promise.allSettled`) so that a failure in one domain (e.g. social) doesn't prevent the rest from
   registering — failures are written to a `ipc-debug.log` file in `userData` as well as the console.
4. **Background/tray behavior.** Closing the window does not quit the app by default — it hides the window,
   shows a system tray icon, and runs `limpiarRecursosSegundoPlano()` to free RAM (terminate worker pools,
   clear in-memory caches, force GC) unless the user has set `DESACTIVAR_SEGUNDO_PLANO` in app settings.
5. **Graceful shutdown.** `before-quit` terminates worker pools, stops the MongoDB Change Stream
   (`detenerBuzon()`), and closes the MongoDB connection (`closeDB()`) before calling `app.exit(0)`.

---

## 5. Layered architecture

```
┌────────────┐   contextBridge    ┌──────────────┐   ipcMain.handle   ┌──────────────┐
│  Renderer  │ ──────────────────▶│   Preload    │ ──────────────────▶│ IPC Handlers │
│ (frontend/)│                    │ (preload/*)  │                    │ (backend/ipc)│
└────────────┘                    └──────────────┘                    └──────┬───────┘
                                                                               │
                                    ┌──────────────────────────────────────────┘
                                    ▼
                            ┌───────────────┐        ┌────────────────┐
                            │   Services    │───────▶│  Repositories  │
                            │(backend/      │        │(backend/       │
                            │ services/)    │        │ repositories/) │
                            └───────┬───────┘        └────────┬───────┘
                                    │                          │
                                    ▼                          ▼
                          ┌──────────────────┐        ┌────────────────┐
                          │ In-memory + local │        │ Mongoose Models│
                          │ SQLite cache      │        │(backend/models)│
                          │(backend/STORAGE/) │        └────────┬───────┘
                          └──────────────────┘                  ▼
                                                          ┌─────────────┐
                                                          │   MongoDB   │
                                                          │(Atlas/local)│
                                                          └─────────────┘
```

| Layer | Responsibility | Location |
|---|---|---|
| **Renderer** | UI rendering, DOM event handling. No Node.js access. | `frontend/` |
| **Preload bridge** | Whitelisted API surface exposed to `window.*` via `contextBridge`. | `preload.cjs`, `preload/*.cjs` — see `Docs/frontend/PRELOAD.md` |
| **IPC Handlers** | Receive `ipcRenderer.invoke` calls, apply IPC-level rate limiting, delegate to services/repositories. | `backend/ipc/*.js` — see `Docs/backend/IPC_AND_SERVERS.md` |
| **Servers** | Express + Socket.IO instances (local dev and Railway production). | `backend/servidores/*.js` — see `Docs/backend/IPC_AND_SERVERS.md` |
| **Services** | Business logic: crypto/ratchet, session/auth, file handling, mail, security scanning, notifications. | `backend/services/**` — see `Docs/backend/CRYPTO_SECURITY.md`, `Docs/backend/SESSION_AUTH.md`, `Docs/backend/MESSAGING.md` |
| **Repositories** | Data-access layer wrapping Mongoose queries; also handle decryption of fetched documents. | `backend/repositories/*.js` — see `Docs/backend/DATA_LAYER.md` |
| **Models** | Mongoose schemas, including the reusable `EncryptedData` sub-schema for at-rest encryption. | `backend/models/*.js` — see `Docs/backend/DATA_LAYER.md` |
| **Local cache** | In-memory maps + `better-sqlite3` persistent DB (`cache.db`) for chats, users, downloads, search history. | `backend/STORAGE/**` — see `Docs/backend/CACHE_SYSTEM.md` |
| **MongoDB** | Source of truth: users, chats, messages, mailbox, security records, GridFS file storage. | External (Atlas or self-hosted) |

---

## 6. Directory-by-directory map

### Root

| Path | Purpose |
|---|---|
| `main.js` | Electron main-process entry point (see §4). |
| `preload.cjs` | Root preload script; imports and exposes all `preload/*.cjs` modules via `contextBridge`. |
| `package.json` | Scripts, dependencies, `electron-builder` config — see `Docs/architecture/BUILD_AND_ENVIRONMENT.md`. |
| `LICENSE` | ISC license, copyright Mateo González Lourido. |
| `CONTRIBUTING.md` | Contribution guidelines. |
| `README.md` | Product-facing overview (outdated on several technical points — see §2). |

### `backend/db/`

| File | Purpose |
|---|---|
| `mongo.js` | Mongoose connection setup/teardown (`connectDB`, `closeDB`) with TLS. |

### `backend/models/` — Mongoose schemas

| File | Purpose |
|---|---|
| `User.js` | User document: credentials, contacts, chat memberships, encrypted profile fields. |
| `Chat.js` | Chat document: participants, ratchet key material. |
| `MembresiaChat.js` | Tracks each user's join/leave boundaries within a chat (which messages they're allowed to see). |
| `Message.js` | Message document: encrypted content blocks, attached file metadata. |
| `Buzon.js` | Mailbox document used to fan out real-time notification entries per user. |
| `Security.js` | Verification codes, JWT/device tokens, blocked-device records. |

### `backend/repositories/`

| File | Purpose |
|---|---|
| `UserRepository.js` | User CRUD, login, registration, block-list toggles, auto-decryption of fetched fields. |
| `ChatRepository.js` | Chat CRUD, ratchet key state, chat cache priming. |
| `membresiaRepository.js` | Records chat join/leave events; filters message lists per user membership. |
| `MessageRepository.js` | Sending messages, paginated message retrieval, GridFS file download. |
| `BuzonRepository.js` | Inserts/reads mailbox entries. |
| `SecurityRepository.js` | Verification-code and token persistence/lookup. |
| `rateLimitRepository.js` | Persistent (DB-backed) device block/infraction tracking. |

### `backend/services/`

| File | Purpose |
|---|---|
| `cryptoService.js` | Core cryptography: AES-256-GCM at-rest encryption, X25519 key generation/wrapping, HMAC ratchet derivation, hashing. |
| `messageCryptoService.js` | Decrypts lists of messages by advancing/deriving ratchet keys. |
| `sesionUsuario.js` | Login, registration, auto-login, email verification flow. |
| `controladorArchivos.js` | Encrypted read/write of local JSON files (session, identity, settings, key management IPC handlers). |
| `buzonAPI.js` | MongoDB Change Stream watcher that pushes mailbox events over Socket.IO / to the renderer. |
| `validadores.js` | Server-side input validation (email, nickname, password, IDs, filenames). |
| `CreadorTokens.js` | JWT creation/validation. |
| `Usuario.js` | User-domain helper logic (account-level operations). |
| `notificaciones_os.js` | Native OS notification dispatch for incoming messages/downloads. |
| `previsualizacion_url.js` | Link preview fetching for shared URLs. |
| `MENSAJERIA/Servicio_mensajeria_correo.js` | Sends transactional email via the Brevo API. |
| `MENSAJERIA/Estructuras_correos.js` | HTML email templates. |
| `seguridad/escanerMensaje.js` | Message-content scanning (URLs, homoglyphs, zalgo text, XSS). The only scanner in the project — file-content scanning does not exist. |

### `backend/ipc/` — one `register*Handlers()` per domain, called from `main.js`

| File | Purpose |
|---|---|
| `session_ipc.js` | Login/register/logout/auto-login handlers. |
| `chat_ipc.js` | Send/receive messages, create chats, file transfer handlers. |
| `social_ipc.js` | Contacts, search, blocking handlers. |
| `validadores_ipc.js` | Exposes server-side validators to the renderer. |
| `cache_persistent_ipc.js` | Handlers for the persistent chats/users cache (SQLite-backed). |
| `cache_archivos_descargados_ipc.js` | Handlers for the downloaded-files history cache (SQLite-backed). |
| `escaneres_app_ipc.js` | Handlers exposing the security scanners to the renderer. |

### `backend/servidores/`

| File | Purpose |
|---|---|
| `serverLocalHost.js` | Express + Socket.IO server for local/dev use, dynamic-port localhost CORS, global rate limiting. |
| `serverRailway.js` | Standalone production server (Railway), dynamic `PORT`, health-check endpoint, configurable CORS. |

### `backend/STORAGE/`

| File | Purpose |
|---|---|
| `Variables_sesion.js` | In-memory session-state getters/setters (current user, main window reference, etc.). |
| `ajustes_defecto.js` | Default app settings object. |
| `CACHE/database.js` | `better-sqlite3` connection + schema (WAL mode) backing the persistent cache tables. |
| `CACHE/_cache_chat_activo.js` | Lightweight in-memory cache for the currently-open chat. |
| `CACHE/_cache_archivos_descargados.js` | Downloaded-files history cache (SQLite-backed). |
| `CACHE/_cache_historial_busquedas_añadir_usuario.js` | Search-history cache for the "add user/chat" flow. |
| `CACHE/cache.db` | The actual SQLite database file (runtime artifact, in `userData` normally — present here as a dev artifact). |

### `backend/utils/`

| File | Purpose |
|---|---|
| `libs.js` | Central, lazily-loaded hub for Node/Electron/npm imports used across the backend. |
| `env_vault.js` | OS-native (`safeStorage`) encrypted vault for `.env` secrets — see `Docs/architecture/BUILD_AND_ENVIRONMENT.md`. |
| `rutas_recursos.js` | Dependency-free resolver for packaged resources (`dentroDeAsar()`, `resolverExtraResource()`, `resolverDirEnv()`); maps `env/` to `process.resourcesPath/env` inside an asar build and to the project tree in development. |
| `logger.js` | Pino structured logger factory (`createLogger(moduleName)`). |
| `rateLimiter.js` | In-memory IPC-layer rate limiter (sliding window per device hash). |
| `conversores.js` | Type-conversion utility helpers. |
| `workers/workerPool.js` | Manages worker-thread pools for crypto and scanning work, sized from CPU count / user override. |
| `workers/cryptoWorker.js` | Worker-thread implementation of heavy crypto operations (e.g. key generation). |
| `workers/escanerWorker.js` | Worker-thread implementation of content scanning. |

### `backend/tests/`

| File | Purpose |
|---|---|
| `cryptoService.test.js` | Vitest unit tests for AES-GCM, X25519 wrapping, ratchet derivation. |
| `chatRepository.test.js` | Tests for chat repository behavior. |
| `validadores.test.js` | Tests for input validators. |
| `test_envio.js` | Ad hoc message-sending test script. |

### `preload/` — modules imported and exposed by root `preload.cjs`

| File | Exposed as | Purpose |
|---|---|---|
| `auth.cjs` | `window.sesion_usuario` | Login, registration, verification. |
| `navigation.cjs` | `window.paginas_app` | Page/view switching. |
| `user.cjs` | `window.cuenta_usuario` | Account/profile data operations. |
| `social.cjs` | `window.social_usuario` | Contacts, blocking, search. |
| `chat.cjs` | `window.chats` | Messaging and chat/file management. |
| `storage.cjs` | `window.cache_persistente`, `window.cache_archivos_descargados` | Cache bridges. |
| `app_settings.cjs` | `window.ajustes_app` | App settings read/write. |
| `validators.cjs` | `window.validadores` | Input validation calls. |
| `mailbox.cjs` | `window.buzonAPI` | Real-time notification/mailbox bridge. |
| `security.cjs` | `window.escaneres_seguridad_app` | Security scanner bridge. |
| `utils.cjs` | `window.utilidades_app` | Misc utilities (e.g. URL preview). |
| `avisos.cjs` | `window.avisos_ui` | UI notice/alert bridge. |
| `opciones_dev.cjs` | `window.opciones_dev` | Developer options bridge. |

Full detail: `Docs/frontend/PRELOAD.md`.

### `frontend/`

| Path | Purpose |
|---|---|
| `sesion-log/` | Login/registration screen (`sesion.html`, `log.js`, `style.css`). |
| `home/home.html` + `home/renderer.js` | Main application shell and its renderer bootstrap. |
| `home/ui/*.js` | Feature modules: chat rendering, settings, contact/chat management, file downloads UI, security UI, extension icons, etc. |
| `home/styles/*.css` | Stylesheets for the main UI. |
| `global/optimizar_ventana.js` | Window/perf-related renderer-side tweaks. |
| `notificaciones/` | In-app notification UI (`notificaciones.js`, `notificaciones.css`). |
| `libs/marked.umd.js`, `libs/purify.min.js` | Vendored Markdown rendering (marked) and HTML sanitization (DOMPurify) libraries. |
| `recursos/` | Static assets — icons, images, file-extension SVGs/PNGs. |

Full detail: `Docs/frontend/FRONTEND.md`.

### `Docs/`

Existing partial documentation (Spanish). Useful for cross-checking history/intent, but not authoritative
over the current source:

- `Docs/Services/*.md` — servers, notifications, system keys.
- `Docs/Services/seguridad/*.md` — password hashing (Argon2id), device security, message scanners,
  login/session, Socket.IO auth.
- `Docs/env_doc/*.md` — env var and vault documentation (see `Docs/architecture/BUILD_AND_ENVIRONMENT.md`
  for the English translation/summary).
- `Docs/PRELOAD.md` — preload bundling rationale (see `Docs/architecture/BUILD_AND_ENVIRONMENT.md` and
  `Docs/frontend/PRELOAD.md`).

---

## 7. Where to go next

| Topic | Document |
|---|---|
| Mongoose models, repositories, `EncryptedData` at-rest scheme | `Docs/backend/DATA_LAYER.md` |
| X25519 key exchange, ratchet derivation, AES-256-GCM, Argon2id hashing | `Docs/backend/CRYPTO_SECURITY.md` |
| Login, registration, auto-login, JWT/device tokens, env vault-backed session | `Docs/backend/SESSION_AUTH.md` |
| Message send/receive flow, GridFS streaming file transfer | `Docs/backend/MESSAGING.md` |
| IPC handler registration, rate limiting, Express/Socket.IO servers | `Docs/backend/IPC_AND_SERVERS.md` |
| In-memory + `better-sqlite3` cache system, eviction policy | `Docs/backend/CACHE_SYSTEM.md` |
| Renderer UI structure, `frontend/` module breakdown | `Docs/frontend/FRONTEND.md` |
| Preload bridge API surface, per-module contract | `Docs/frontend/PRELOAD.md` |
| Build/dev workflow, env vars, packaging | `Docs/architecture/BUILD_AND_ENVIRONMENT.md` (this pair) |
