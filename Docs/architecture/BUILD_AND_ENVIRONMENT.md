# Build, Environment & Tooling

> See `Docs/architecture/OVERVIEW.md` for the overall architecture. This document covers how to run the
> project in development, how the preload script is bundled, what every environment variable does, how
> distributables are built, and how tests are run. All facts here were verified against `package.json`,
> `main.js`, `backend/utils/env_vault.js`, and the existing (Spanish) docs under `Docs/env_doc/` and
> `Docs/PRELOAD.md`, which have been translated/folded in.

---

## 1. Requirements

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 18+ | Needed for native `fetch` and ESM (`"type": "module"` in `package.json`). |
| **npm** | 9+ | Package manager used by all scripts. |
| **Electron** | ^41.1.1 | Declared as a devDependency; downloads Chromium binaries on `npm install`. |
| **MongoDB** | Atlas (cloud) or self-hosted, TLS-enabled | Source of truth for all persisted data. |
| **License** | ISC | See `LICENSE`. |
| **Author** | Mateo González Lourido | `package.json` `author` field; copyright holder in `LICENSE`. |

---

## 2. `package.json` reference

### 2.1 Scripts

| Script | Command | Purpose |
|---|---|---|
| `start` | `npm run build-preload && electron .` | Development entry point: rebuilds the bundled preload, then launches Electron. |
| `build-preload` | `esbuild preload.cjs --bundle --platform=node --external:electron --outfile=preload.bundle.cjs` | Bundles the preload script and all `preload/*.cjs` dependencies into a single CommonJS file (see §3). |
| `debug` | `electron --trace-warnings --trace-deprecation --inspect=5858 .` | Launches Electron with Node inspector attached on port 5858 and verbose deprecation/warning traces. Does **not** rebuild the preload bundle first — run `build-preload` manually if preload code changed. |
| `start-railway` | `node backend/servidores/serverRailway.js` | Runs only the backend HTTP/Socket.IO server (no Electron), intended for the Railway production deployment. |
| `test` | `vitest run` | Runs the Vitest test suite once (non-watch mode). |
| `postinstall` | `electron-rebuild` | Runs automatically after `npm install`; rebuilds native modules (e.g. `better-sqlite3`) against Electron's Node/ABI version via `@electron/rebuild`. |
| `dist-windows` | `npm run build-preload && electron-builder install-app-deps --platform win32 --arch x64 && electron-builder --win --x64` | Builds a generic Windows x64 NSIS installer. |
| `dist-win10` | same, with `--config.win.artifactName="${productName}-Win10-Setup.${ext}"` and `--config.directories.output=dist/win10` | Windows build with a Win10-labeled artifact name and output directory. |
| `dist-win11` | same pattern, `dist/win11`, `-Win11-Setup` | Windows build with a Win11-labeled artifact name and output directory. |
| `dist-linux` | `npm run build-preload && electron-builder --linux --x64` | Builds a Linux x64 distributable. |

### 2.2 Dependencies (runtime)

| Package | Role |
|---|---|
| `@getbrevo/brevo`, `brevo` | Brevo transactional email API client, used for sending verification-code emails (`backend/services/MENSAJERIA/`). |
| `argon2` | Argon2id password/PIN/code hashing (replaces the bcrypt scheme described in the outdated README — see `Docs/Services/seguridad/HASHING_CONTRASENAS.md`). |
| `better-sqlite3` | Synchronous, embedded SQLite driver backing the persistent local cache (`backend/STORAGE/CACHE/database.js`). Native module — rebuilt for Electron via `electron-rebuild`. |
| `dompurify` | HTML sanitization, used both by the message scanner and vendored into the frontend (`frontend/libs/purify.min.js`). |
| `express`, `express-rate-limit` | HTTP server framework and global rate-limiting middleware for `backend/servidores/*.js`. |
| `jsonwebtoken` | JWT creation/validation for sessions and device/account tokens (`backend/services/CreadorTokens.js`). |
| `mongodb`, `mongoose` | MongoDB driver and ODM used throughout `backend/db/`, `backend/models/`, `backend/repositories/`. |
| `node-machine-id` | Generates a stable per-device hardware ID, used for device trust/blocking and rate-limit keys. |
| `pino`, `pino-pretty` | Structured JSON logging (`backend/utils/logger.js`); `pino-pretty` formats it for readable console output. |
| `socket.io`, `socket.io-client` | Real-time transport for mailbox/notification push. |
| `systeminformation` | Collects device information (used by `backend/services/sesionUsuario.js` for device identification/trust). Lazily loaded as `si` in `backend/utils/libs.js`. The old adaptive cache-strategy selector that also used it (`backend/utils/systemInfo.js`) has been deleted — it had no callers. |
| `validator` | String validation helpers used by `backend/services/validadores.js`. |
| `dotenv` | Loads `.env`-style files; used as part of the env vault's plaintext-migration path. |

### 2.3 Dependencies (development)

| Package | Role |
|---|---|
| `@electron/rebuild` | Rebuilds native modules against the Electron ABI; invoked by `postinstall`. |
| `electron` | The Electron runtime itself (v41). |
| `electron-builder` | Packages the app into installers/distributables (`dist-*` scripts). |
| `esbuild` | Bundles `preload.cjs` into `preload.bundle.cjs` (see §3). |
| `marked` | Markdown parser; the built UMD bundle is vendored into `frontend/libs/marked.umd.js` for rendering message content. |
| `standard` | JavaScript linter/style checker. |
| `vitest` | Test runner for `backend/tests/*.test.js`. |

### 2.4 `build` (electron-builder) configuration

```json
"build": {
  "appId": "com.mateo.ravage",
  "productName": "Ravage",
  "win": { "target": "nsis" },
  "files": [
    "**/*",
    "!.env", "!env/", "!Docs/", "!backend/tests/", "!dist/", "!vscode", "!README.md"
  ],
  "extraResources": [
    { "from": "env/", "to": "env/" }
  ],
  "npmRebuild": false
}
```

- **Target**: Windows builds use the `nsis` installer target; `dist-linux` uses electron-builder's default
  Linux target set (no explicit `linux.target` override in this config).
- **Excluded from the asar bundle** (`files`): any plaintext `.env`, the `env/` directory, `Docs/`,
  `backend/tests/`, `dist/`, the VS Code config, and `README.md`. This keeps tests and documentation out of
  the shipped code bundle. Note this only excludes `env/` from *inside* `app.asar` — it is still shipped
  separately via `extraResources`, see below.
- **`extraResources`**: `env/` is copied into the packaged app **outside** the asar archive, at
  `<install-dir>/resources/env/`. Because the app code itself lives inside `app.asar`, a path resolved
  relative to the source tree would point at `.../app.asar/env`, which never exists. That is what
  `backend/utils/rutas_recursos.js` fixes: `resolverDirEnv()` returns `path.join(process.resourcesPath, 'env')`
  when the module is running from inside an asar bundle, and the project-tree path otherwise, so the vault
  finds (and, crucially, *deletes*) the plaintext `.env` files on first run of a packaged build too —
  see §4.2.
- **`npmRebuild: false`**: electron-builder is told *not* to run its own native-module rebuild step, since
  `postinstall` already ran `electron-rebuild` and the `dist-*` scripts explicitly call
  `electron-builder install-app-deps` for the Windows builds.

### 2.5 Browserslist

```json
"browserslist": ["Chrome >= 120", "Electron >= 40"]
```

Targets the Chromium engine bundled with Electron 40+ (the app currently ships Electron 41), used by any
tooling that needs to know the supported browser baseline (e.g. autoprefixing, if introduced later).

---

## 3. The preload bundling step

**Why it's needed:** the renderer window is created with `sandbox: true` (see `main.js`,
`createMainWindowHome`). Electron's sandboxed renderer cannot resolve Node-style `require()` calls to local
files the way a normal Node process can — a preload script that does `require('./preload/auth.cjs')` will
fail to load its dependencies when the sandbox is active. `contextIsolation: true` and
`nodeIntegration: false` compound this: the preload script runs in an isolated JS context and must not leak
raw Node built-ins (`fs`, `crypto`, etc.) to the page.

**The fix:** `esbuild` bundles `preload.cjs` — the entry point that `require()`s every module in
`preload/*.cjs` (`auth.cjs`, `chat.cjs`, `navigation.cjs`, `security.cjs`, `user.cjs`, `storage.cjs`,
`validators.cjs`, `mailbox.cjs`, `utils.cjs`, `avisos.cjs`, `opciones_dev.cjs`, `app_settings.cjs`) — into a
single, dependency-free file:

```bash
esbuild preload.cjs --bundle --platform=node --external:electron --outfile=preload.bundle.cjs
```

- `--bundle` inlines every local `require()`'d module into one file, so no runtime module resolution is
  needed inside the sandbox.
- `--platform=node` keeps Node-target semantics (CommonJS `require`/`module.exports` stay intact).
- `--external:electron` leaves `require('electron')` (used for `contextBridge`/`ipcRenderer`) unbundled,
  since Electron injects its own `electron` module into the preload context at runtime — it must not be
  inlined.
- `--outfile=preload.bundle.cjs` produces the file that `main.js` actually loads:

  ```js
  webPreferences: {
      preload: path.join(__dirname, 'preload.bundle.cjs'),
      ...
  }
  ```

**Workflow integration:**

- `npm start` always runs `build-preload` first, so any edit under `preload/` or to `preload.cjs` is picked
  up automatically on the next launch.
- `npm run debug` does **not** rebuild the bundle automatically — run `npm run build-preload` manually
  after preload changes before debugging.
- The `dist-*` packaging scripts also run `build-preload` first, ensuring the shipped bundle is fresh.

**Maintenance rules** (per `Docs/PRELOAD.md`):

- Never hand-edit `preload.bundle.cjs` — it is fully regenerated on every build and any manual edits are
  lost.
- Never expose whole Node modules (`fs`, `crypto`, etc.) through `contextBridge`; each `preload/*.cjs`
  module should only expose thin wrapper functions that call `ipcRenderer.invoke(...)`/`ipcRenderer.send(...)`
  so the actual privileged work happens in the main process.
- Preload source files must stay `.cjs` (CommonJS) even though the rest of the project uses
  `"type": "module"` (ESM) — this is required for compatibility with the sandboxed bundling setup.

---

## 4. Environment variables and the secrets vault

### 4.1 Two source files, one runtime vault

Ravage reads configuration from two example-driven `.env`-style files that are placed under `env/` before
the first launch:

| File | Contents |
|---|---|
| `env/.env.secret` | MongoDB URI, cryptographic keys, API keys, auth secrets. |
| `env/.env.config` | Internal, non-user-facing app configuration (currently just a debug-mode flag). |

Templates for both live at `Docs/env_doc/.env.secret.example` and `Docs/env_doc/.env.config.example`. On
first run, `inicializarVault()` (called from `app.whenReady()` in `main.js`, before the server/DB are
started) migrates these plaintext files into an OS-encrypted vault and deletes the plaintext originals. From
then on, environment variables are read only from the encrypted vault — the `env/` directory is expected to
be empty again after the first successful run.

### 4.2 Vault mechanism (`backend/utils/env_vault.js`)

The vault uses Electron's `safeStorage` API, which delegates encryption to the OS-native credential store:

| OS | Backend |
|---|---|
| Linux | libsecret (gnome-keyring / kwallet) |
| Windows | DPAPI |
| macOS | Keychain |

Startup flow:

```
app.whenReady()
      │
      ▼
 Any non-empty .env file in env/ ?
      │ yes                                  │ no
      ▼                                      ▼
 encrypt with safeStorage.encryptString()   Any *.enc file already in
 write <userData>/env_vault/<name>.enc      <userData>/env_vault/ ?
 delete the original plaintext file           │ yes              │ no
      │                                       ▼                  ▼
      └────────────────────────────► decrypt each .enc      (no vars loaded)
                                      inject into process.env
```

- **Migration** (`migrarEnvAlBaul`): only deletes the plaintext original after the encrypted `.enc` write
  succeeds.
- **Loading** (`cargarDesdeVaul`): decrypted vault contents take priority over anything previously loaded
  by `dotenv`.
- **Where the plaintext `.env` files are looked for**: `env_vault.js` no longer hardcodes
  `path.resolve(__dirname, '../../env')`. It delegates to `resolverDirEnv()` in
  `backend/utils/rutas_recursos.js`, which returns `<project>/env` in development and
  `process.resourcesPath/env` when the code is running from inside `app.asar` (see §2.4). The startup log
  line `[EnvVault] Buscando .env en: <ruta>` prints the directory actually used.
  *Previously* this resolution was wrong in packaged builds: the vault looked inside the asar, never found
  the files, never migrated them and never deleted them — so the credentials stayed in cleartext in
  `resources/env/` for the whole life of the installation. That is fixed.
- **Vault location**: `<userData>/env_vault/<original-filename>.enc`, where `<userData>` is
  `app.getPath('userData')` — typically `~/.config/Ravage/env_vault/` (Linux), `%APPDATA%\Ravage\env_vault\`
  (Windows), or `~/Library/Application Support/Ravage/env_vault/` (macOS).
- **Failure handling**: if encryption of a file fails, the plaintext original is *not* deleted, and the
  error is logged with an `[EnvVault]` prefix. If decrypting a `.enc` file fails, that file is skipped and
  the rest still load. Neither failure mode halts app startup — the app continues with whatever variables
  were successfully loaded.
- **No keyring available** (e.g. headless Linux without gnome-keyring): the vault logs a warning and neither
  migrates nor loads anything; plaintext `.env` files, if present, remain on disk unencrypted.
- **Rotating a secret**: re-create the relevant file under `env/` with the new value and relaunch the app —
  the vault detects it, re-encrypts, and overwrites the previous `.enc`.
- `Docs/env_doc/*.example` files are template-only and are never touched by the vault (filtered out by
  extension).

### 4.3 Variables in `.env.secret`

| Variable | Purpose |
|---|---|
| `URI_MONGODB` | MongoDB connection string (Atlas or local), expected to have TLS enabled. |
| `SECRET_KEY_JWT` | 32-byte hex key used to sign JSON Web Tokens. |
| `SECRET_KEY_COKKIE` | 32-byte hex key (AES-256) used to encrypt local session/settings files on disk. |
| `SECRET_KEY_PRIVATE` | 32-byte hex key (AES-256) used specifically to encrypt the user's E2EE private identity key on disk — kept distinct from `SECRET_KEY_COKKIE` so a compromise of one does not expose the other. |
| `INTERNAL_ENCRYPTION_KEY` | 32-byte hex key (AES-256) used for at-rest encryption of sensitive fields stored in MongoDB (the `EncryptedData` sub-schema). |
| `BREVO_API_KEY` | API key for the Brevo transactional email service (v3), used to send verification-code emails. |
| `BREVO_SENDER_EMAIL` | Verified sender address for outgoing Brevo emails. |
| `GOOGLE_SAFE_BROWSING_API_KEY` | API key for Google Safe Browsing, used by the message/URL security scanner to flag malicious links. |
| `SOCKET_SECRET` | Shared secret used to authenticate Socket.IO connections in production; generate with `openssl rand -hex 32`. |
| `CLIENT_URL` | Allowed CORS origin(s) for the Railway production server — a single URL or comma-separated list. |
| `HMAC_SECRET` | **Optional.** Key for the deterministic search hashes (`correo_hash`, `id_dp_hash`) produced by `hashDatosSistema()` in `backend/services/cryptoService.js`. Not present in `.env.secret.example`. If unset, the function falls back to the system key (`INTERNAL_ENCRYPTION_KEY`) and logs a one-time `console.warn`. The fallback is **deliberate**: every `*_hash` already stored in the database was computed that way, so making the variable mandatory would lock existing users out. Setting it on an existing installation requires recomputing those hashes first — see the migration note in the source. |

Secure hex keys can be generated with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4.4 Variables in `.env.config`

| Variable | Purpose |
|---|---|
| `MODO_DEBUG` | `true`/`false`. When `true`, enables extra debug logging/intervals (e.g. the memory-usage monitor in `main.js`); `console.log` calls always run regardless of this flag. |

### 4.5 First-time setup

```bash
cp Docs/env_doc/.env.secret.example env/.env.secret
cp Docs/env_doc/.env.config.example env/.env.config
# edit both files with real values
npm start
```

After the first successful launch, the `env/` directory is emptied by the vault migration and does not
need to be recreated on subsequent runs — the encrypted vault under `userData` is the source of truth from
then on.

---

## 5. Running in development

```bash
npm install       # installs dependencies; postinstall runs electron-rebuild for native modules
npm start          # build-preload, then electron .
```

On launch (see `Docs/architecture/OVERVIEW.md` §4 for full detail): the env vault initializes, the local
Express/Socket.IO server starts (`backend/servidores/serverLocalHost.js`, fixed port `3000`), MongoDB
connects, an auto-login attempt is made from the encrypted local session file, and the main window is
created loading either the login screen or the home screen.

For attaching a debugger:

```bash
npm run build-preload   # rebuild the bundle first if preload/ changed
npm run debug            # electron --trace-warnings --trace-deprecation --inspect=5858 .
```

For running only the backend server (no Electron UI), e.g. to test the Railway deployment path locally:

```bash
npm run start-railway
```

---

## 6. Running the test suite

```bash
npm run test        # vitest run
```

Tests live under `backend/tests/`:

- `cryptoService.test.js` — AES-256-GCM encrypt/decrypt round trips, X25519 key wrapping, ratchet key
  derivation.
- `chatRepository.test.js` — chat repository behavior.
- `validadores.test.js` — input validation and injection-prevention checks.
- `test_envio.js` — ad hoc message-sending script (not necessarily part of the automated `vitest run` suite
  depending on its Vitest test declarations).

---

## 7. Building distributables

All `dist-*` scripts rebuild the preload bundle first, then invoke `electron-builder`:

```bash
npm run dist-windows   # generic Windows x64 NSIS installer
npm run dist-win10     # Windows x64 build, artifact named "<product>-Win10-Setup.<ext>", output to dist/win10
npm run dist-win11     # Windows x64 build, artifact named "<product>-Win11-Setup.<ext>", output to dist/win11
npm run dist-linux     # Linux x64 build
```

The Windows scripts additionally run `electron-builder install-app-deps` to ensure native modules are
installed/rebuilt for the target platform/arch before packaging. Packaged output excludes `.env`, `env/`,
`Docs/`, `backend/tests/`, `dist/`, VS Code config, and `README.md` from the asar bundle (see the `files`
exclusion list in §2.4); the `env/` directory is shipped separately as an `extraResources` entry, landing at
`resources/env/` next to the asar, which is exactly where `resolverDirEnv()` looks for plaintext `.env`
files on a fresh install.

---

## 8. License, author, versions — quick reference

| Field | Value |
|---|---|
| License | ISC (`LICENSE`) |
| Copyright | Mateo González Lourido, 2026 |
| `package.json` `author` | mateo gonzalez lourido |
| Node.js | 18+ required |
| Electron | ^41.1.1 (devDependency) |
| Module system | ESM (`"type": "module"`) for the app code; preload stays CommonJS (`.cjs`) |
