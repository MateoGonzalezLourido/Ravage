# Messaging, Notifications & Local Storage

Covers the push-notification "mailbox" (buzón) system, transactional email, local encrypted file storage, user profile/validation logic, and URL previews. This is an English translation and code-verified update of `Docs/Services/NOTIFICACIONES.md` and (partially) `Docs/Services/CLAVES_SISTEMA.md`. Where they disagree with current source, source wins — see **Corrections** at the end.

Primary source files:

| File | Role |
|---|---|
| `backend/services/buzonAPI.js` | MongoDB Change Streams → Socket.IO / IPC push notifications |
| `backend/services/MENSAJERIA/Servicio_mensajeria_correo.js` | Brevo transactional email sending |
| `backend/services/MENSAJERIA/Estructuras_correos.js` | HTML email templates |
| `backend/services/controladorArchivos.js` | Local encrypted session/identity/settings files |
| `backend/services/Usuario.js` | Account-data change flow (password/email/nickname) |
| `backend/services/validadores.js` | Input validation used across services |
| `backend/services/previsualizacion_url.js` | Link/URL preview extraction |

---

## 1. The mailbox ("buzón") push system — `buzonAPI.js`

Ravage does not poll for new events. Each user has one `BuzonUsuarios` MongoDB document (`backend/models/Buzon.js`) acting as an inbox of pending event entries (`{ tipo, data }`), and the app watches that single document via a **MongoDB Change Stream**.

### `iniciarBuzon(io, mainWindow)`

```js
changeStream = BuzonUsuarios.watch(
    [{ $match: { 'documentKey._id': myUserId } }],
    { fullDocument: "updateLookup" }
);
```

- Filters the change stream to the current user's own document only (`documentKey._id` match).
- `fullDocument: "updateLookup"` makes MongoDB attach the complete post-update document to every change event (not just the delta), since entries are pushed with `$push`/`$slice` and the driver otherwise wouldn't give you the array contents directly.
- If a stream is already open, `detenerBuzon()` closes it first (re-entrant safe — e.g. on reconnect).

### On each change event

1. Filter `doc.entrada` to entries not already seen this stream session, tracked in a `Set<string>` (`sentIds`) keyed by entry `_id`. This guards against duplicate delivery on replication/reconnect replay.
2. When `sentIds.size > MAX_ENTRADAS * 2` (400, since `MAX_ENTRADAS = 200`), prune IDs no longer present in the current document.
3. Decrypt each entry's `data` field. Two shapes are handled: an object with `{data, iv, tag}` (→ `desencriptarDatosSistema`, then `JSON.parse` if the result is a string) or a plain encrypted string.
4. `primer_contacto` (first contact after stream start/reconnect) triggers `optimizar_cola_entradas_buzon(doc)` first — this collapses entries of types `0`, `3`, `4` down to one-per-chat so a long-disconnected user doesn't see dozens of banners at once, and drops type `2` entirely. Only applied once per stream lifetime (until `detenerBuzon`/`iniciarBuzon` resets it).
5. `filtrar_entradas_ipc(docFinal, primer_contacto)` — drops entries whose chat/sender is in the user's blocked list (`getUsuariosBloqueados`), and flags `entrada.silenciado = true` for chats/senders in the silence list (`getUsuariosSilence`) or unconditionally when `ForceSilenciar` (i.e. `primer_contacto`) is true.
6. If anything survives filtering:
   - `io.to(myUserId.toString()).emit("nueva-notificacion", docFiltrado)` — Socket.IO room broadcast (a user can have multiple connected clients/tabs, all in the same room).
   - `mainWindow.webContents.send("nueva-notificacion", docFiltrado)` — direct IPC to the Electron renderer, wrapped in a try/catch so a destroyed/unavailable `webContents` doesn't block OS notifications.
   - `procesarNotificacionOSEntrada` (from `notificaciones_os.js`) is called per entry to decide on native OS notifications, independent of renderer availability.

### `detenerBuzon()`

Closes the change stream, nulls it out, and resets `primer_contacto = true` so the next `iniciarBuzon` call re-applies the reconnect-optimization pass.

### Buzón entry types

Types `0`–`8` are defined and consumed by the frontend event dispatcher (`buzon_eventos.js`, outside this doc's scope) and by the OS-notification/rate-limiting logic in `buzonAPI.js`. `Docs/Services/NOTIFICACIONES.md` §4 has the full type table (message, group-add, group-created, group-add-variant, kicked, silent-chat-update, add-request, add-request-response, pinned-message) — verified consistent with `optimizar_cola_entradas_buzon`'s handling of types `0/2/3/4` in this file.

### Cleanup / TTL

Not implemented in `buzonAPI.js` itself (lives in `models/Buzon.js` / `BuzonRepository.js`, outside this doc's file list), but relevant to this system: `MAX_ENTRADAS = 200` caps entries per document via `$slice` in the repository's `bulkWrite`, and a 90-day TTL index on `updatedAt` expires fully inactive mailboxes. See `Docs/Services/NOTIFICACIONES.md` §6 for the detailed mechanics (verified accurate against `Buzon.js`/`MAX_ENTRADAS` import used in this file).

---

## 2. Transactional email — `Servicio_mensajeria_correo.js` + `Estructuras_correos.js`

### Sending — `enviarEmail`

```js
async function enviarEmail({ correoDestino, asunto = "Sin asunto", htmlContenido = "" }) {
    const body = {
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: "RAVAGE" },
        to: [{ email: correoDestino }],
        subject: asunto,
        htmlContent: htmlContenido
    };
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify(body)
    });
    ...
}
```

- Uses the Brevo (formerly Sendinblue) transactional email HTTP API directly via native `fetch` — no SDK dependency.
- Errors are logged but never rethrown: "the user specified that if it fails, it shouldn't affect the code or the app" (per the source comment). Callers never need to handle email failures.
- `generarCodigoVerificacion()` produces a 6-digit numeric code via `randomInt(100000, 1000000)`.
- `correoPermitido(clave)` reads the named boolean setting from the local app-settings file (`getAjustesAppFile(clave)`); if the read fails, it **fails open** (`val !== false` → `true` when `val` is `undefined`/error), so email sending defaults to "allowed" if settings can't be read.

### Email templates — `Estructuras_correos.js`

All templates share `BaseEmailWrapper(content)`: a table-based, dark-themed (`#020617`/`#0f172a`) responsive HTML shell with MSO/Outlook compatibility comments, built for reliable rendering across Gmail/Outlook/Apple Mail.

| Function | Subject | Triggered from | Toggle setting |
|---|---|---|---|
| `ValidarCorreoEstructura` | "Verificación de correo" | `registerUsuario` (registration code) | Always sent |
| `ConfirmacionCuentaCreadaEstructura` | "¡Bienvenido a RAVAGE!" | `ValidarCodeRegistroUsuario` (account created) | Always sent |
| `ValidarCuentaUsuario` | "Verificación de seguridad" | `loginUsuario` (login verification code, when not auto-verified) | Always sent |
| `ConfirmacionInicioSesion` | "Alerta de Inicio de Sesión" | `ValidarCodeLogin` (after successful code entry) | `CORREO_INICIO_SESION` |
| `CodigoCambiarDatosCuenta` | "Confirmación de Cambios" | `Usuario.js` — `permitirCambioContraseñaUsuario` / `permitirCambioCorreoUsuario` (password/email change code) | Always sent |
| `ConfirmacionCambioContraseña` | "Contraseña Actualizada" | `Usuario.js` — `ValidarCodeCambioDatosCuenta`, `tipo === "contraseña"` | `CORREO_CAMBIO_CONTRASEÑA` |
| `ConfirmacionCambioCorreo` | "Cambio de Email" | `Usuario.js` — `ValidarCodeCambioDatosCuenta`, `tipo === "correo"` | `CORREO_CAMBIO_CORREO` |
| `ConfirmacionCambioApodo` | "Apodo Actualizado" | `Usuario.js` — `ValidarCodeCambioDatosCuenta`, `tipo === "apodo"` | `CORREO_CAMBIO_APODO` |
| `AvisoDispositivoConfianzaAnadido` | "Nuevo dispositivo de confianza añadido" | `sesionUsuario.js` — `marcarDispositivoConfianza` | `CORREO_DISPOSITIVO_CONFIANZA` |
| `AvisoDispositivoConfianzaRevocado` | "Dispositivo de confianza eliminado" | `sesionUsuario.js` — `revocarDispositivoConfianza`, `revocarConfianzaDispositivo` | `CORREO_DISPOSITIVO_CONFIANZA` |
| `AvisoSesionCerrada` | "Sesión de dispositivo cerrada" | `sesionUsuario.js` — `revocarSesionDispositivo` | `CORREO_SESION_CERRADA` |
| `AvisoDispositivoBloqueado` | "Dispositivo bloqueado en tu cuenta" | `sesionUsuario.js` — `bloquearDispositivo` | `CORREO_DISPOSITIVO_BLOQUEADO` |
| `AvisoDispositivoDesbloqueado` | "Dispositivo desbloqueado en tu cuenta" | `sesionUsuario.js` — `desbloquearDispositivo` | `CORREO_DISPOSITIVO_BLOQUEADO` |

This matches `Docs/Services/NOTIFICACIONES.md` §3's table, with the addition that the change-confirmation and code emails are cross-checked here against `Usuario.js` directly. See §4 below for one bug found in that wiring.

### Fire-and-forget pattern

Every send site follows:

```js
;(async () => {
    if (!await correoPermitido('CORREO_X')) return;
    const { asunto, htmlContenido } = SomeTemplate({ ... });
    enviarEmail({ correoDestino: correo, asunto, htmlContenido });
})();
```

Not awaited by the calling flow — the IPC response returns before the email send (or even the settings check) resolves.

---

## 3. Local encrypted files — `controladorArchivos.js`

Handles all on-disk state for the Electron app: session tokens, E2EE identity, app settings, caches, and the security PIN. Everything is written under `app.getPath('userData')/.APP_DATA/`.

### Key selection

Three symmetric keys are in play (see `Docs/Services/CLAVES_SISTEMA.md` §3 for the full key inventory, verified accurate against this file):

| Key | Source | Used for |
|---|---|---|
| `SECRET_KEY_COKKIE` | `process.env.SECRET_KEY_COKKIE` (lazy-loaded, 32-byte hex) | `sessionFile`, `omitirVerificacionCuentaFile`, `dispositivoConfianza`, `securityPin`, `cacheArchivosDescargados`, `cacheChatsFrecuentes`, `cacheHistorialBusquedasAñadir` |
| `SECRET_KEY_PRIVATE` | `process.env.SECRET_KEY_PRIVATE` (lazy-loaded) | `identity` file only (dedicated key, isolated from the others) |
| Per-user `secretKey` | `STORAGE/Variables_sesion.js` in-memory (loaded from `User.secretKey` at login) | Everything else (app settings via `saveAjustesAppFile`, other generic data) |

Both env-based keys throw (`fail-closed`) if the corresponding environment variable is missing when first needed. `readFileSession('identity')` is the one exception: a missing `SECRET_KEY_PRIVATE` returns `null` **without deleting or backing up the file**, since that failure mode means "env misconfigured," not "file corrupted."

### Encryption format

`CifrarDatosArchivos(data, especial)`:
1. `gzipSync(JSON.stringify(data))` — compress first.
2. AES-256-GCM encrypt with a random 12-byte IV.
3. Store `{ iv, tag, data, compressed: true }` as hex strings, JSON-serialized to disk.

`readFileSession` reverses this, decompressing only if `raw.compressed` is set (backward compatible with any pre-compression files).

### File paths (`RTDF` map)

| Key | Filename | Contents |
|---|---|---|
| `sessionFile` | `sesionfile.json` | `{ username, token }` — 7-day session JWT |
| `omitirVerificacionCuentaFile` | `auto_login.json` | `{ username, token }` — 90-min skip-verification token |
| `dispositivoConfianza` | `dp_confi.json` | `{ username, token }` — 365-day trust token |
| `ajustesAPP` | `ajustes_app.json` | App settings (notification toggles, etc.) |
| `infoAPP` | `info_app.json` | (declared, not exercised by functions in this file) |
| `identity` | `identity.json` | `{ primary: {id, privateKey, publicKey, createdAt}, supportKeys: [] }` — E2EE keys |
| `cacheArchivosDescargados` | `cache_archivos.json` | Downloaded-file cache |
| `cacheChatsFrecuentes` | `cache_chats_frec.json` | Frequent-chats cache |
| `cacheHistorialBusquedasAñadir` | `cache_hist_buscar_add.json` | "Add contact" search history |
| `securityPin` | `pin_seguridad.json` | `{ correo, pinHash }` — local app-lock PIN (Argon2 hash) |

### Identity file — multi-key support

The identity file format is `{ primary: {id, privateKey, publicKey, createdAt}, supportKeys: [] }`. `id` is a 16-hex-char fingerprint (`sha256(pem).slice(0,16)`). `saveIdentityFile` auto-migrates the legacy flat `{privateKey, publicKey}` shape into this structure on write; `readFileSession`/`_leerIdentidadLocal` do the same migration on read without persisting until the next save.

Supporting functions:
- `importarClavePrivada(pemContent, label)` — imports an external PEM as either the new primary (if no identity exists yet) or as an additional `supportKeys` entry (used to decrypt messages sealed under an older/foreign key).
- `cambiarClavePrincipal(keyId)` — promotes a support key to primary, demoting the old primary into `supportKeys` (labeled `"Antigua principal"`).
- `listarClavesIdentidad()` / `eliminarClaveSoporte(keyId)` — list/remove support keys.
- `exportarClavePrivadaADescargas()` / `exportarClavePorId(keyId)` — write a PEM to the OS Downloads folder (`0o600` permissions) for user backup/export.
- On decrypt failure of the identity file, the code attempts a **one-time migration**: it tries decrypting with the older `SECRET_KEY_COKKIE` (in case the file predates the dedicated `SECRET_KEY_PRIVATE` key), and if that succeeds, transparently re-saves it under the new key.
- If the identity file is genuinely unreadable (wrong key, corruption) it is **backed up** (renamed to `<file>.corrupt-<timestamp>`), never deleted — losing an E2EE private key is unrecoverable, so the code errs toward preserving the raw bytes for a possible manual recovery, unlike other session files (`sessionFile`, etc.) which are simply deleted (`clearFileSession`) on unreadable/corrupt state.

### File transfer

This file handles no chat file/attachment transfer — it is scoped to local app-state files (session, identity, settings, caches). Encrypted file/attachment storage for chats uses MongoDB GridFS per the root `README.md`, which lives outside the files covered by this document.

### Settings — `getAjustesAppFile` / `saveAjustesAppFile`

- `getAjustesAppFile(nombre?)` — reads `ajustesAPP`, merges over `AJUSTES_APP_DEFAULT` (`STORAGE/ajustes_defecto.js`), auto-creates the file with defaults if missing. `nombre` can be a single key, an array of keys, or omitted (returns everything). Also handles a legacy unencrypted-plaintext file transparently (no `iv`/`tag`/`data` shape).
- `saveAjustesAppFile({ data, create })` — `create: true` resets to defaults before merging `data`; otherwise merges onto the existing saved settings.
- `limpiarArchivosCompleto()` deletes every `RTDF` file except the directory entry itself (`sessionDir`) — used e.g. when auto-login detects a permanently blocked device.

---

## 4. User profile & account changes — `Usuario.js`

Handles password/email/nickname change requests, each gated behind an email verification code (except nickname, which needs no code — see below) and a simple in-process reentrancy lock.

### Reentrancy lock

A single module-level `bloquear_accion` boolean guards all four exported functions — a second concurrent call to any of `permitirCambioContraseñaUsuario` / `permitirCambioCorreoUsuario` / `permitirCambioApodoUsuario` / `ValidarCodeCambioDatosCuenta` while one is in flight returns `{ success: false, bloqueador: true }` rather than queuing. This is process-wide, not per-user — there is exactly one Electron renderer's worth of concurrency to worry about, so this is sufficient here but would not be safe in a multi-connection server context.

All four functions now release the lock in a `finally` block (`try { … } finally { bloquear_accion = false }`). Previously an early `return` on a DB error skipped the reset and left the flag stuck at `true`, blocking password, email **and** nickname changes for the remaining lifetime of the process — only an app restart cleared it.

### `permitirCambioContraseñaUsuario(contraseña?, contraseña_actual?)`

- Called with no argument: pure eligibility check — looks up `exp_bloq_contrasena` on the `User` document and reports whether the cool-down window has passed.
- Called with a new password: validates format, checks the cool-down, **requires and verifies the user's current password**, confirms the new password differs from the current one (`compare` via Argon2), then generates a 6-digit code, hashes it with `hash()` (Argon2id) before storing (`InsertarCodigoCambioDatos`), and emails it via `CodigoCambiarDatosCuenta`. Always sent (no toggle).

The `contraseña_actual` requirement is new: a missing value returns `"Debes introducir tu contraseña actual"` and a wrong one `"La contraseña actual no es correcta"`, both before any code is issued. It arrives from the renderer through the new `#cambio-pass-actual` input → `PERMITIR_CAMBIO_DATOS_CUENTA({data, tipo, contraseña_actual})` in `preload/user.cjs` → the 4th argument of the `permitir-cambio-datos-cuenta` IPC handler. See `Docs/backend/SESSION_AUTH.md` §12 for the full chain. Email and nickname changes are unaffected and take no `contraseña_actual`.

### `permitirCambioCorreoUsuario(correo?)`

Same shape, but also checks the new email isn't already registered to another account (`User.exists({correo_hash})`) before issuing a code.

### `permitirCambioApodoUsuario(apodo?)`

Same eligibility-check shape, but nickname changes **do not send a verification code at all** — the function only validates format/cooldown/difference-from-current and returns success directly; the actual change happens via `ValidarCodeCambioDatosCuenta` with `tipo === "apodo"`, which skips the code-checking branch entirely (`if (tipo != "apodo")`).

### `ValidarCodeCambioDatosCuenta({ data, code, tipo })`

1. For `tipo !== "apodo"`: validate code format, fetch the most recent `DatosCuentaVC` record for that `correo_hash` + `tipo` (sorted by `expira`), read the remaining attempts out of the record itself, verify it belongs to this device (`deviceId === desencriptarDatosSistema(code_db.id_dp)`, tolerant of a blank stored device id), and `compare()` the submitted code against the stored Argon2 hash. A wrong code decrements the stored attempt counter; reaching zero **deletes the code** from the DB.
2. Applies the change: `cambiarContraseñaUsuario` / `cambiarCorreoUsuario` / `cambiarApodoUsuario` (repository functions, outside this doc's scope) — and for password changes, immediately calls `cerrarSesionUsuario(correo)` afterward (forces logout so the user re-authenticates with the new password).
3. Sends the matching confirmation email (`CORREO_CAMBIO_CONTRASEÑA` / `CORREO_CAMBIO_CORREO` / `CORREO_CAMBIO_APODO`), subject to that setting.
4. Deletes the used verification code(s) via `BorrarDatosCuentaVC`.

#### Attempt counting lives in the DB

The module-level `intentos_codigo_validacion` variable is gone. Remaining attempts are stored **encrypted inside the `DatosCuentaVC` document's own `data` field**, exactly as `sesionUsuario.js` already did for `ValidationCode`. Three helpers implement it: `InsertarCodigoCambioDatos()` (inserts the code and seeds `data: encriptarDatosSistema({ intentos: 5 })`), `leerDatosVC()` (decrypts it, defaulting to `n_intentos_codigo_validacion = 5` for legacy records without `data`) and `guardarDatosVC()` (re-encrypts and persists the decrement). The counter now survives an app restart and is scoped per issued code rather than shared across all three change types.

#### `BorrarDatosCuentaVC` takes the hashed code

The function captures `code_hash_db = code_db.code` — the Argon2 hash exactly as stored — right after the lookup and passes that to every `BorrarDatosCuentaVC(correo, code_hash_db)` call. It used to be given the user-typed plaintext code, which never matched the stored hash, so no code was ever actually deleted.

#### Fixed: blank change-confirmation emails

Step 3 previously destructured `const { asunto2, htmlContenido2 } = ConfirmacionCambioContraseña(...)` (same pattern for `ConfirmacionCambioCorreo`/`ConfirmacionCambioApodo`), but those templates `return { asunto, htmlContenido }` — no `asunto2`/`htmlContenido2` keys exist — so `enviarEmail` received `undefined` for both and fell back to its own defaults (`asunto: "Sin asunto"`, empty body). Every password/email/nickname confirmation email went out blank. The code now uses `({ asunto, htmlContenido } = ConfirmacionCambio…({ apodo }))`, with a generic `"Confirmación Cambio Datos Cuenta"` subject as the fallback branch. **This defect is fixed** — the entry in *Corrections* below is kept for historical context only.

---

## 5. Input validation — `validadores.js`

| Function | Rule |
|---|---|
| `comprobaciones_Correo(correo)` | Must be a string, ≤255 chars, pass `validator.isEmail`, and be **fully lowercase** (any uppercase character is rejected, not normalized) |
| `comprobar_apodo(apodo)` | `validator.isAlphanumeric(apodo, 'es-ES', {ignore: '_-'})` (letters/digits plus `_`/`-`), length 3–20 |
| `comprobar_contraseña_cuenta(contraseña)` | Async — looks up the current session's user by `correo_hash`, `Argon2 compare()`s the supplied password against the stored hash; returns a boolean, not a `{success}` object |
| `comprobarContrasenaValidaciones(contraseña)` | String, 8–128 characters. No complexity requirement (no enforced mix of case/digits/symbols) — the source comment notes this only validates "hay un mensaje que enviar" (there's something to submit), not password strength |
| `comprobar_idAmigo(idAmigo)` | Exactly 10 uppercase hex characters (`^[0-9A-F]{10}$`) |
| `comprobar_codigo_verificacion(codigo)` | Exactly 6 numeric digits |
| `comprobar_mensaje(mensaje)` | Non-empty after trim, ≤1000 characters |
| `comprobar_nombre_archivo(nombre)` | Non-empty after trim, ≤255 chars, rejects `\ / : * ? " < > \|` |

All format-check functions return `{ success: boolean, message: string }` except `comprobar_contraseña_cuenta`, which is async and returns a plain boolean.

---

## 6. URL preview — `previsualizacion_url.js`

`obtenerPrevisualizacionUrl(targetUrl)`:

1. `fetch(targetUrl)` with a 4-second timeout via `AbortController`, spoofing a desktop Chrome `User-Agent` (some sites block obvious Node/bot user agents).
2. Bails (`null`) on a non-OK response or a `content-type` that isn't `text/html` — avoids downloading large binaries/media by mistake.
3. Reads the full response body as text (`response.text()` — no partial/streamed read), then extracts via regex (deliberately avoiding a DOM parser like `cheerio`/`jsdom` for speed/footprint):
   - Title: `og:title` meta tag, falling back to `<title>`.
   - Description: `og:description`, falling back to `name="description"`.
   - Image: `og:image` only (no fallback). Relative (`/...`) image URLs are resolved to absolute using the target's origin.
4. Requires at least a title or an image to consider the page "previewable"; otherwise returns `null`.
5. Unescapes a fixed set of HTML entities (`&lt; &gt; &quot; &#039; &amp; &nbsp;`) in title/description — the module comment explicitly notes `&lt;`/`&gt;` unescaping order is deliberate to avoid re-introducing raw `<`/`>` that a naive frontend `innerHTML` render could interpret as markup (XSS mitigation at the data layer).
6. Any fetch/parse error (except intentional `AbortError` timeouts, which are silently swallowed) is logged and also returns `null` — this function never throws to its caller.

Returns `{ titulo, descripcion, imagen, urlActiva }` or `null`.

---

## Corrections vs. existing Spanish docs

**Against `Docs/Services/NOTIFICACIONES.md`:**
- No factual corrections found — its description of `buzonAPI.js` (Change Stream filtering, `sentIds` dedup, `optimizar_cola_entradas_buzon`, `filtrar_entradas_ipc`, the fire-and-forget email pattern, and the `correoPermitido` fail-open behavior) matches the current source exactly.
- Extended: this document previously reported a `Usuario.js` email-template destructuring bug (`{asunto2, htmlContenido2}`) that made every change-confirmation email arrive blank. **That bug has since been fixed in the code** (§4); the notification doc never covered it, being scoped to the settings matrix rather than template wiring.

**Against `Docs/Services/CLAVES_SISTEMA.md`:**
- No factual corrections found for the portions relevant to this scope (§3's `SECRET_KEY_COKKIE`/`SECRET_KEY_PRIVATE` key-selection table matches `controladorArchivos.js` exactly, including the identity-file migration key fallback).
- Chain-key/ratchet material (§4 of that doc) is out of scope here — it belongs to `Docs/backend/CRYPTO_SECURITY.md`.

**Against root `README.md`:**
- Confirms: MongoDB Change Streams + Socket.IO for real-time push, Brevo API for transactional email, AES-256-GCM at-rest encryption, Argon2id password hashing.
- The README's `sesion_usuario` / `buzon.js` filenames in its architecture diagram are stale — current filenames are `sesionUsuario.js` and `buzonAPI.js` respectively (this doc uses the current filenames throughout).
