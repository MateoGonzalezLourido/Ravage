# Session & Authentication

This document describes Ravage's authentication system as implemented in code: registration, email verification, trusted-device auto-login, manual login, JWT issuance, rate limiting, and logout.

Primary source files:

| File | Role |
|---|---|
| `backend/services/sesionUsuario.js` | Core login/register/auto-login/logout flow |
| `backend/services/CreadorTokens.js` | JWT creation/validation |
| `backend/utils/rateLimiter.js` | In-memory rate limiter (auth attempts) |
| `backend/repositories/rateLimitRepository.js` | Persistent rate-limit audit + permanent device blocking |
| `backend/ipc/session_ipc.js` | IPC handlers exposing session/auth to the renderer |
| `backend/services/validadores.js` | Input validation used across this flow |
| `backend/services/controladorArchivos.js` | Local encrypted session/identity files (see `Docs/backend/MESSAGING.md` for full detail) |

This is an English translation and code-verified update of `Docs/Services/seguridad/LOGIN_SESION.md` (Spanish). Where the two disagree, this document follows the current source code. See **Corrections** at the end for specifics.

Device trust/blocking (`marcarDispositivoConfianza`, `bloquearDispositivo`, `DispositivosBloqueados`/`AppBlockedDevices`) is only summarized here — full detail belongs to `Docs/backend/CRYPTO_SECURITY.md`.

---

## 1. Registration (`registerUsuario`)

```
registerUsuario(mainWindow, { apodo, correo, password })
    │
    ├─ 1. Validate email format, nickname format, password format (no DB access)
    │
    ├─ 2. Check User.exists({ correo_hash }) — reject if already registered
    │
    ├─ 3. Respond immediately (loading icon off), continue in background:
    │      ├─ hash(password)            → Argon2id (backend/utils/libs.js)
    │      ├─ generarLlavesX25519()     → E2EE identity keypair
    │      ├─ generate 6-digit code
    │      └─ InsertarVC({correo, code, id: deviceId, data: {passwordHash, apodo,
    │              publicKey, privateKey, intentos: 5}})   → validationcodes (encrypted)
    │
    └─ 4. Send verification email (ValidarCorreoEstructura), fire-and-forget
```

- The heavy work (Argon2id hashing + X25519 keypair generation) runs in an unawaited async IIFE so the IPC caller gets an immediate `{ success: true }` while registration continues in the background.
- The registration verification code allows **5 attempts** (`n_intentos_codigo_validacion = 5`); TTL is enforced by the `validationcodes` MongoDB schema (10 minutes per the existing security docs).

### Verification (`ValidarCodeRegistroUsuario`)

1. Validate code structure (6 numeric digits) via `comprobar_codigo_verificacion`.
2. `BuscarVC(correo, code, deviceId)` looks up the code by `correo_hash + hash(code) + id_dp_hash` — the hash comparison happens inside the repository query, not in this function.
3. If `intentos <= 0`, delete the code and fail.
4. On success, call `InsertarUsuario({ apodo, contrasena: passwordHash, correo, publicKey })` to create the `User` document.
5. If insertion fails, decrement `intentos` and persist it back onto the (still encrypted) `ValidationCode.data`.
6. On success: `saveIdentityFile({ privateKey, publicKey })` (writes the local encrypted identity file) and `BorrarVC(correo)` run in parallel, then a "welcome" confirmation email (`ConfirmacionCuentaCreadaEstructura`) is sent fire-and-forget.

---

## 2. Manual login (`loginUsuario`)

```
loginUsuario(mainWindow, { username, contraseña, mantener_sesion_iniciada })
    │
    ├─ 1. Validate email + password format (no DB)
    │
    ├─ 2. In parallel:
    │      ├─ readFileSession('dispositivoConfianza')
    │      ├─ readFileSession('omitirVerificacionCuentaFile')
    │      ├─ DispositivosBloqueados.exists({correo_hash, id_dp_hash})
    │      └─ LoginUsuarioDB({correo, contrasena})   ← Argon2id compare happens here
    │
    ├─ 3. Device blocked for this account? → deny ("ESTE DISPOSITIVO TIENE EL ACCESO
    │       BLOQUEADO A ESTA CUENTA")
    │
    ├─ 4. Credentials invalid? → clear sessionFile, deny (caller records a rate-limit hit)
    │
    ├─ 5. Trusted-device check:
    │      dp_confianza_data valid + validateToken(token) + TokenDPC.exists(hash) → true
    │      otherwise the stale dispositivoConfianza file is cleared
    │
    ├─ 6. If not trusted, fall back to the "skip verification" token
    │      (omitirVerificacionCuentaFile): validateToken + TokenVC.exists(hash) → true
    │      otherwise the stale file is cleared / its JWT purged
    │
    ├─ 7. autoverificacion = true (trusted device OR valid skip-token)
    │      → enter directly. If mantener_sesion_iniciada, generate a session JWT (7d)
    │        in the background, save to sessionFile + AñadirJWTUsuario (DB)
    │
    └─ 8. autoverificacion = false
           → generate 6-digit code, InsertarCuentaVC({correo, code, id: deviceId,
             data: {mantenerSesion, intentos: 5}}), email it (ValidarCuentaUsuario)
```

`asegurarIdentidadLocal()` runs after any autoverified path to guarantee a local E2EE identity exists (see §6).

Note: `loginUsuario` returns `{ success: true, autoverificacion }` even when a code still needs to be entered — the renderer decides whether to show the code-entry screen based on `autoverificacion`.

### Rate limiting on login

Before `loginUsuario` (or `registerUsuario`) is even called, `backend/ipc/session_ipc.js` runs `checkSecurityLimits()`:

1. `estaDispositivoBloqueadoApp(id_dp_hash)` — permanent block check against `AppBlockedDevices`. If blocked, deny immediately with no further processing.
2. `authRateLimiter.check(id_dp_hash)` — in-memory limiter (see §4). If tripped, `registrarInfraccionPersistent(id_dp_hash)` records a daily infraction in `RateLimitAudit`; on the 5th infraction that day the device is permanently blocked (`AppBlockedDevices`).

On the `login-usuario` handler: a failed login (`!res.success`) calls `authRateLimiter.record(id_dp_hash)`; a successful one calls `authRateLimiter.reset(id_dp_hash)`. `registrar-usuario` and `validar-code-*` handlers record failures for malformed input but do not reset on success.

---

## 3. Verification code after manual login (`ValidarCodeLogin`)

Used when `loginUsuario` returned `autoverificacion: false`.

1. Validate code structure.
2. `BuscarCuentaVC(correo, code, deviceId)` — lookup by `correo_hash + hash(code) + id_dp_hash`. Not found → clear in-memory session vars, fail.
3. `intentos <= 0` → clear in-memory session vars, `BorrarCuentaVC(correo)`, fail.
4. On success:
   - If `mantenerSesion` was requested during login, generate a session JWT (`generarteToken('sesion')`, 7d) + device info, save to `sessionFile` and `AñadirJWTUsuario` (DB, `tksession`).
   - Always generate a "skip verification" token (`generarteToken('cuenta')`, 90m) and persist it to `omitirVerificacionCuentaFile` + `AñadirJWTUsuarioVC` (DB, `tokenvcv`).
   - Delete the login code (`BorrarCuentaVC`).
5. `asegurarIdentidadLocal()`.
6. If `correoPermitido('CORREO_INICIO_SESION')`, fire-and-forget a "new sign-in" confirmation email (`ConfirmacionInicioSesion`).

---

## 4. Rate limiting internals

### In-memory limiter — `backend/utils/rateLimiter.js`

```js
export const authRateLimiter = new RequestRateLimiter(7, 15 * 60 * 1000);
```

- `RequestRateLimiter` is a simple `Map<key, {count, resetTime}>` keyed by `id_dp_hash` (SHA-256 of the machine ID, computed once per `session_ipc.js` module init via `hashDatosSistema(machineIdSync())`).
- `check(key)`: resets the counter if the window expired, returns `{ blocked, count, limit, resetIn }`. `blocked` is `count >= limit` (7 by default).
- `record(key)`: increments the counter for a failed/limited attempt. Does nothing if `check()` was never called first for that window (no record exists to increment).
- `reset(key)`: deletes the entry — used after a successful login.
- Limits apply **per device** (not per account), are entirely in-memory, and reset on app restart or after the 15-minute window elapses.

### Persistent audit — `backend/repositories/rateLimitRepository.js`

- `estaDispositivoBloqueadoApp(id_dp_hash)` — checks `AppBlockedDevices` (collection `appblockeddevices`) for a permanent block record.
- `registrarInfraccionPersistent(id_dp_hash)` — called only once the in-memory limiter trips. Upserts a per-day counter in `RateLimitAudit` (collection `ratelimitaudit`, keyed by `id_dp_hash` + midnight-truncated date). If `intentos >= 5` for that day, upserts a permanent block into `AppBlockedDevices` with reason `"Exceso de intentos de seguridad (5 infracciones detectadas en un día)"`.
- A permanent app block is irreversible from within this code path — there is no unblock function in this repository (distinct from the per-account device blocking in `sesionUsuario.js`, which is reversible via `desbloquearDispositivo`).

---

## 5. JWT tokens — `backend/services/CreadorTokens.js`

```js
export async function generarteToken(duracion = "cuenta") {
    const duraciones = { sesion: '7d', cuenta: '90m', confianza: '365d' };
    const deviceId = String(machineIdSync());
    const sessionToken = randomBytes(32).toString("hex");
    return sign({ payload: sessionToken, deviceId }, SECRET_KEY_JWT, { expiresIn: duraciones[duracion] });
}

export async function validateToken(jwtToken) {
    try { return verify(jwtToken, SECRET_KEY_JWT); }
    catch { return null; }
}
```

| Type | `expiresIn` | Purpose | DB collection | Local file |
|---|---|---|---|---|
| `sesion` | 7 days | Session auto-login | `tksession` | `sessionFile` |
| `cuenta` | 90 minutes | Skip email-code re-verification | `tokenvcv` | `omitirVerificacionCuentaFile` |
| `confianza` | 365 days | Trusted device (skips code entirely) | `tokendpc` | `dispositivoConfianza` |

- The JWT payload only contains a random 32-byte hex `payload` and the `deviceId` — no user identity. The application layer (`sesionUsuario.js` / `SecurityRepository.js`) separately stores a **SHA-256 hash of the raw JWT string** (`createHash("sha256").update(token).digest("hex")`) associated with `correo_hash` + `id_dp_hash` in the corresponding MongoDB collection. A token is only accepted if both (a) it verifies via `jwt.verify` against `SECRET_KEY_JWT`, and (b) its SHA-256 hash matches a live DB record for that account+device.
- `SECRET_KEY_JWT` comes from `process.env.SECRET_KEY_JWT`, read once at module load (unlike the lazily-initialized keys in `controladorArchivos.js`).
- `generarteToken` is `async` but performs no `await` internally — the signature is `async` only for API consistency with its callers.

---

## 6. Auto-login on app start (`autoLoginUsuario`)

```
autoLoginUsuario()
    │
    ├─ 1. readFileSession('sessionFile') → { username, token }?
    │        missing → { success: false }
    │
    ├─ 2. comprobaciones_Correo(username) valid?
    │        no → clearFileSession('sessionFile'), { success: false }
    │
    ├─ 3. DispositivosBloqueados.exists({correo_hash, id_dp_hash})?
    │        yes → limpiarArchivosCompleto() (wipe all local files), fail with block message
    │
    ├─ 4. LoginUsuarioDB({ correo, token, id_dp })
    │        valid  → ACTUALIZAR_DATOS_LOGIN(...), asegurarIdentidadLocal(), success
    │        invalid → LimpiarJWTUsuario(username, token) + clearFileSession('sessionFile')
    │                  in parallel, fail
    │
    └─ (no rate limiting: a forged token still has to pass jwt.verify + DB hash match)
```

Auto-login does **not** go through `checkSecurityLimits()` / `authRateLimiter` — the IPC layer only wraps `login-usuario`/`registrar-usuario`/code-validation handlers, and `autoLoginUsuario()` is invoked directly from the app bootstrap, not via one of those IPC channels. This is consistent with it being signature-verified rather than a bruteforceable credential.

---

## 7. Local E2EE identity — `asegurarIdentidadLocal` / `REGENERAR_IDENTIDAD_USUARIO`

Called after every successful login/auto-login path:

1. `getIdentity()` (from `cryptoService.js`) — if `identidad.primary.privateKey` exists, done.
2. If no local identity **and** no active session (`storage.getIDMongodbUsuario()` unset), skip — nothing to regenerate against.
3. Otherwise call `REGENERAR_IDENTIDAD_USUARIO()`:
   - `generarLlavesX25519()` → new keypair.
   - `User.updateOne({_id}, {$set:{publicKey}})` and `saveIdentityFile({privateKey, publicKey})` run in parallel.
   - Refresh the in-memory user cache (`setUsuarioEnCache`) with the updated public key.
   - Logs a warning: regenerating identity breaks decryption of prior E2EE chat history (old messages were sealed to the previous public key).

This is a last-resort recovery path (e.g. first login on a new device where registration never persisted the identity file, or a corrupted/missing local identity file).

---

## 8. Logout (`cerrarSesionUsuario`)

```
cerrarSesionUsuario(correo)
    │
    ├─ notify renderer: "cerrando-sesion" true
    ├─ ACTUALIZAR_DATOS_LOGIN({ limpiar: true })   → wipe in-memory session state
    ├─ Promise.allSettled([
    │     clearFileSession('sessionFile'),
    │     clearCacheUsuarios(),
    │     clearCacheArchivosDescargados(),
    │     LimpiarJWTUsuario(correo, token)          ← only if a sessionFile token existed
    │   ])
    └─ notify renderer: "cerrando-sesion" false
```

The IPC handler `cerrar-sesion-usuario` (in `session_ipc.js`) additionally calls `app.relaunch(); app.exit(0)` after `cerrarSesionUsuario` resolves — the app process restarts entirely rather than just showing a login screen.

`dispositivoConfianza` and `omitirVerificacionCuentaFile` are **not** cleared on logout, so the next login on the same device can still skip verification via those tokens (matching the existing Spanish doc's claim).

---

## 9. Device management (brief — see CRYPTO_SECURITY.md for full detail)

`sesionUsuario.js` also exposes device-trust/session-management functions, all wired through `session_ipc.js`:

| Function | Effect |
|---|---|
| `marcarDispositivoConfianza(correo)` | Issues a `confianza` JWT (365d), saves `dispositivoConfianza` file + DB record; emails `CORREO_DISPOSITIVO_CONFIANZA` if allowed |
| `revocarDispositivoConfianza(correo)` | Clears the current device's trust file + DB record |
| `estadoDispositivoConfianza(correo)` | Checks whether the current device currently holds a valid trust token |
| `obtenerGestionDispositivos(correo)` | Lists all active sessions, trusted devices, and blocked devices for the account |
| `revocarSesionDispositivo(correo, id_dp_hash)` | Revokes a specific device's session record; clears local file if it's the current device |
| `revocarConfianzaDispositivo(correo, id_dp_hash)` | Revokes a specific device's trust record |
| `bloquearDispositivo(correo, id_dp_hash)` | Adds to `DispositivosBloqueados`, revokes that device's session + trust; blocks future login/auto-login for that device+account pair |
| `desbloquearDispositivo(correo, id_dp_hash)` | Removes the block |

Every one of these fires an informational email (subject to the relevant `CORREO_*` app setting) reporting the device name/OS/timestamp involved — see `Docs/backend/MESSAGING.md` §2 for the email templates and `Docs/Services/NOTIFICACIONES.md` for the full notification-settings matrix.

Device identity is a hash of `machineIdSync()` (from the `node-machine-id` style helper in `backend/utils/libs.js`), never the raw machine ID — `hashDatosSistema()` (SHA-256) is applied before anything touches MongoDB.

---

## 10. IPC surface — `backend/ipc/session_ipc.js`

All handlers are registered inside `registerSessionHandlers(mainWindow)`.

| Channel | Type | Notes |
|---|---|---|
| `cambiar-pagina-log` | `on` | `app.relaunch(); app.exit(0)` |
| `login-usuario` | `handle` | rate-limited; calls `loginUsuario` |
| `registrar-usuario` | `handle` | rate-limited; calls `registerUsuario` |
| `validar-code-registrar-usuario` | `handle` | rate-limited; calls `ValidarCodeRegistroUsuario` |
| `validar-code-login-usuario` | `handle` | rate-limited; calls `ValidarCodeLogin` |
| `borrar-code-registrar-usuario` | `handle` | `BorrarVC(correo)` — lets the renderer cancel a pending registration code |
| `borrar-code-login-usuario` | `handle` | `BorrarCuentaVC(correo)` |
| `cerrar-sesion-usuario` | `handle` | `cerrarSesionUsuario` + app relaunch |
| `obtener-apodo-sesion`, `obtener-correo-usuario`, `obtener-id-mongodb-usuario`, `obtener-idamigo-usuario`, `obtener-fecha-creacion-cuenta`, `obtener-fecha-bloqueo-apodo`, `obtener-fecha-bloqueo-correo`, `obtener-fecha-bloqueo-contraseña`, `obtener-invisible-usuario`, `obtener-mostrar-correo-usuario` | `handle` | Read-only accessors into `STORAGE/Variables_sesion.js` in-memory state |
| `comprobar-contraseña-cuenta` | `handle` | `comprobar_contraseña_cuenta` (validadores.js) — Argon2 compare against the current session's password |
| `permitir-cambio-datos-cuenta` | `handle` | Dispatches to `permitirCambioContraseñaUsuario` / `permitirCambioCorreoUsuario` / `permitirCambioApodoUsuario` (see `Docs/backend/MESSAGING.md` §4 for `Usuario.js`) |
| `cambiar-datos-usuario` | `handle` | `ValidarCodeCambioDatosCuenta` |
| `configurar-pin-seguridad`, `verificar-pin-seguridad`, `tiene-pin-seguridad` | `handle` | Local app-lock PIN, hashed with Argon2 (`hash`/`compare`), stored via `saveSecurityPinFile`/`readFileSession('securityPin')`. Independent of account auth. |
| `marcar-dispositivo-confianza`, `revocar-dispositivo-confianza`, `estado-dispositivo-confianza`, `obtener-gestion-dispositivos`, `revocar-sesion-dispositivo`, `revocar-confianza-dispositivo`, `bloquear-dispositivo`, `desbloquear-dispositivo` | `handle` | Device management (§9). The `*-dispositivo` handlers that take an `id_dp_hash` argument validate it is a 64-char lowercase hex string before calling the service function. |

`checkSecurityLimits()` (defined inline in `registerSessionHandlers`) is the gate described in §2/§4, applied to `login-usuario`, `registrar-usuario`, `validar-code-registrar-usuario`, and `validar-code-login-usuario`.

---

## 11. Local session files

Handled by `backend/services/controladorArchivos.js` (full detail in `Docs/backend/MESSAGING.md` §3). Summary relevant to auth:

| File key (`RTDF`) | Contents | Encryption key |
|---|---|---|
| `sessionFile` | `{ username, token }` | `SECRET_KEY_COKKIE` |
| `omitirVerificacionCuentaFile` | `{ username, token }` | `SECRET_KEY_COKKIE` |
| `dispositivoConfianza` | `{ username, token }` | `SECRET_KEY_COKKIE` |
| `identity` | `{ primary: {id, privateKey, publicKey, createdAt}, supportKeys: [] }` | `SECRET_KEY_PRIVATE` (dedicated key, separate from `SECRET_KEY_COKKIE`) |
| `securityPin` | `{ correo, pinHash }` | `SECRET_KEY_COKKIE` |

All are AES-256-GCM, gzip-compressed before encryption (`CifrarDatosArchivos`).

---

## Corrections vs. `Docs/Services/seguridad/LOGIN_SESION.md`

The Spanish document is otherwise accurate and was used as the structural basis for this one. Specific corrections made against current code:

1. **Key algorithm**: the Spanish doc repeatedly says "clave privada RSA" / "clave pública RSA". The code (`generarLlavesX25519()`, called from both `registerUsuario` and `REGENERAR_IDENTIDAD_USUARIO`) generates **X25519** keys, not RSA. This document uses X25519 throughout, consistent with `Docs/Services/CLAVES_SISTEMA.md` §4.
2. **Password hashing**: confirmed Argon2id via `backend/utils/libs.js` (`argon2.hash(password, { type: argon2.argon2id })`), matching the Spanish doc's cross-reference.
3. All token durations, collection names, and rate-limit thresholds (7/15min in-memory, 5/day persistent) in the Spanish doc were verified against `CreadorTokens.js`, `rateLimiter.js`, `rateLimitRepository.js`, and `models/Security.js` and are accurate as of this writing.
4. Added: the root `README.md` describes JWT with "rotación" (rotation) generically; the code does not rotate tokens on use — each token type is generated once per event (login, trust-marking, etc.) and only reissued when the user repeats that action or the token expires.
