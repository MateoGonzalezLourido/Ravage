# Preload Scripts Documentation

The **preload** script is the main bridge between the `frontend` (renderer process) and the `backend` (Electron main process). Its job is to expose a limited, safe API to the browser context via `contextBridge`, instead of giving the renderer direct access to Node/Electron internals.

---

## 1. Structure

To keep the code organized and scalable, preload functionality is split into modules inside the `/preload/` folder. Each module groups the functions of one logical domain:

| Module | Domain |
|---|---|
| `preload/auth.cjs` | Session management, login/register, trusted devices |
| `preload/chat.cjs` | Messaging and chat management |
| `preload/navigation.cjs` | Switching between app pages |
| `preload/security.cjs` | Content security scanners |
| `preload/user.cjs` | Account data of the current user |
| `preload/social.cjs` | Contacts, blocking/muting, external user lookup |
| `preload/storage.cjs` | Cache/persistence management |
| `preload/validators.cjs` | Data validation (email, nickname, passwords, etc.) |
| `preload/mailbox.cjs` | Real-time mailbox / socket-driven events |
| `preload/utils.cjs` | General utilities (e.g. URL preview) |
| `preload/app_settings.cjs` | App settings, identity keys, PIN, workers |
| `preload/avisos.cjs` | One-way backend → renderer event listeners |
| `preload/opciones_dev.cjs` | Developer-mode flag |

The last three (`app_settings.cjs`, `avisos.cjs`, `opciones_dev.cjs`) exist in the codebase but were **not** documented in the previous version of this document; they are covered in full below.

---

## 2. The Bridge Definition (`preload.cjs`)

The root file `preload.cjs` is the main entry point. It imports every module above and exposes each one to the `window` object of the frontend via `contextBridge.exposeInMainWorld()`.

```javascript
const { contextBridge } = require('electron');
const auth = require('./preload/auth.cjs');
// ...
contextBridge.exposeInMainWorld('sesion_usuario', auth);
// ...
```

This way, frontend code (running in the renderer, e.g. `frontend/home/renderer.js`) can safely call `window.sesion_usuario.LOGIN_USUARIO(...)`.

### Exposed globals

| Global (`window.*`) | Source module | Purpose |
|---|---|---|
| `sesion_usuario` | `auth.cjs` | Login/register, session, trusted-device management |
| `paginas_app` | `navigation.cjs` | Navigate between app pages (home / login / support) |
| `cuenta_usuario` | `user.cjs` | Read the logged-in user's account data |
| `social_usuario` | `social.cjs` | Contacts, blocking, muting, external user search |
| `chats` | `chat.cjs` | Chat/message CRUD, file transfer, chat admin actions |
| `ajustes_app` | `app_settings.cjs` | App settings, identity/PIN management, worker count |
| `validadores` | `validators.cjs` | Input validation (email, nickname, password, etc.) |
| `buzonAPI` | `mailbox.cjs` | Real-time mailbox (Socket.io-backed notifications) |
| `cache_url_img_extensiones` | `storage.cjs` (`storage.cache_url_img_extensiones`) | **Not implemented** — see note below |
| `cache_persistente` | `storage.cjs` (`storage.cache_persistente`) | User-cache and search-history persistence |
| `cache_archivos_descargados` | `storage.cjs` (`storage.cache_archivos_descargados`) | Downloaded-files cache management |
| `escaneres_seguridad_app` | `security.cjs` | Content security scanners (XSS, zalgo, malicious URLs, etc.) |
| `utilidades_app` | `utils.cjs` | General utilities (URL preview) |
| `avisos_ui` | `avisos.cjs` | One-way backend→renderer notices (loading icon, logout, RAM cleanup) |
| `opciones_dev` | `opciones_dev.cjs` | `isDev` flag for developer-only UI/behavior |

> **Code-verified quirk:** `preload.cjs` line 52 does `contextBridge.exposeInMainWorld('cache_url_img_extensiones', storage.cache_url_img_extensiones)`, but `preload/storage.cjs` only exports `cache_persistente` and `cache_archivos_descargados` — there is no `cache_url_img_extensiones` key in that module. As a result, `window.cache_url_img_extensiones` currently resolves to `undefined` at runtime. No frontend code references this global (file-extension icons are instead served by a plain IPC call in `preload/utils.cjs`-adjacent code, see `frontend/home/ui/url_icono_extensiones_archivos.js`), so this is dead/broken wiring rather than an active bug, but it should either be removed from `preload.cjs` or implemented in `storage.cjs`.

---

## 3. Why a "Bundle" Is Needed

Electron uses a **sandbox** for the renderer process for security. When the sandbox is enabled (`sandbox: true` in `webPreferences`, set in `main.js` line ~316):

1. **Module resolution** — the preload script cannot resolve local CommonJS modules (`require('./preload/auth.cjs')`, etc.) the way plain Node.js would, because a sandboxed preload runs in a restricted context.
2. **Isolation** — the renderer cannot `require` Node built-ins directly; only what the sandboxed preload explicitly forwards through `contextBridge` is reachable.

To work around this, the project uses **esbuild** to bundle the entry script `preload.cjs`, together with every file it `require`s from `/preload/`, into a single self-contained file: `preload.bundle.cjs`.

## 4. The Build Process

The build command is defined in `package.json`:

```bash
npm run build-preload
```

which runs:

```
esbuild preload.cjs --bundle --platform=node --external:electron --outfile=preload.bundle.cjs
```

(`electron` itself is marked `--external` because it's provided by the Electron runtime, not bundled.)

### Workflow integration

- **`npm start`** — defined as `npm run build-preload && electron .`, so the bundle is always rebuilt before the app launches. Any change under `/preload/` or in root `preload.cjs` is picked up automatically on the next start.
- **`dist-windows` / `dist-win10` / `dist-win11` / `dist-linux`** — all packaging scripts in `package.json` also run `npm run build-preload` first, so the shipped bundle is never stale.
- **`main.js`** is configured to always load the generated file:

```javascript
webPreferences: {
    preload: path.join(__dirname, 'preload.bundle.cjs'),
    sandbox: true,
    // ...
}
```

## 5. Maintenance and Best Practices

- **Never edit `preload.bundle.cjs`** — it is overwritten on every build. Make changes only in `preload.cjs` or the files under `/preload/`.
- **Safe exposure** — never expose full Node modules (like `fs` or `crypto`) directly. Every module in `/preload/` wraps backend behavior behind `ipcRenderer.invoke`/`ipcRenderer.send`, so the actual operation always runs in the main process.
- **File typing** — the project uses `"type": "module"` at the root, so preload files must keep the `.cjs` extension (CommonJS) to remain compatible with the current bundling/sandbox setup.

---

## 6. Module Reference

Every function below is a thin wrapper: it either calls `ipcRenderer.invoke(channel, ...args)` (request/response, returns a Promise) or `ipcRenderer.send(channel, ...args)` (fire-and-forget), or in `avisos.cjs` registers an `ipcRenderer.on(channel, callback)` listener. Channel names (in parentheses) match the corresponding `ipcMain.handle`/`ipcMain.on` registration in `backend/ipc/`.

### `auth.cjs` → `window.sesion_usuario`

| Function | Purpose |
|---|---|
| `LOGIN_USUARIO(usuario, contraseña, mantener_sesion_iniciada)` | Logs in with email/password, optionally keeping the session persisted |
| `REGISTRAR_USUARIO(apodo, username, password)` | Registers a new account |
| `VALIDAR_CODE_REGISTRAR_USUARIO(correo, code)` | Validates the email confirmation code sent during registration |
| `VALIDAR_CODE_LOGIN_USUARIO(username, password)` | Validates the 2FA-style email code sent during login |
| `BORRAR_CODES_VALIDACION_CORREO(correo)` | Deletes pending registration validation codes |
| `BORRAR_CODES_VALIDACION_CUENTA(correo)` | Deletes pending login validation codes |
| `CERRAR_SESION()` | Logs the current user out |
| `MARCAR_DISPOSITIVO_CONFIANZA()` | Marks the current device as trusted (skips future login codes) |
| `REVOCAR_DISPOSITIVO_CONFIANZA()` | Revokes trust for the current device |
| `ESTADO_DISPOSITIVO_CONFIANZA()` | Gets whether the current device is currently trusted |
| `OBTENER_GESTION_DISPOSITIVOS()` | Lists all known/trusted devices for the account |
| `REVOCAR_SESION_DISPOSITIVO(id_dp_hash)` | Force-logs-out a specific device's session |
| `REVOCAR_CONFIANZA_DISPOSITIVO(id_dp_hash)` | Revokes trust of a specific device |
| `BLOQUEAR_DISPOSITIVO(id_dp_hash)` | Blocks a device from logging in |
| `DESBLOQUEAR_DISPOSITIVO(id_dp_hash)` | Unblocks a previously blocked device |

### `navigation.cjs` → `window.paginas_app`

| Function | Purpose |
|---|---|
| `CAMBIAR_PAGINA_SOPORTE()` | Navigates the window to the support page |
| `CAMBIAR_PAGINA_HOME()` | Navigates the window to the home (chat) page |
| `CAMBIAR_PAGINA_SESION()` | Navigates the window to the login/register page |

### `user.cjs` → `window.cuenta_usuario`

| Function | Purpose |
|---|---|
| `GET_APODO_SESION()` | Gets the current user's nickname |
| `OBTENER_CORREO_USUARIO()` | Gets the current user's email |
| `OBTENER_ID_MONGODB_USUARIO()` | Gets the current user's MongoDB `_id` |
| `OBTENER_IDAMIGO_USUARIO()` | Gets the current user's shareable friend ID |
| `COMPROBAR_CONTRASEÑA({ contraseña })` | Verifies the given password against the account |
| `PERMITIR_CAMBIO_DATOS_CUENTA({ data, tipo })` | Requests permission/starts the flow to change an account field |
| `CAMBIAR_DATOS_CUENTA(contraseña, code, tipo)` | Confirms and applies an account data change (email/password/nickname) |
| `OBTENER_FECHA_CREACION_CUENTA()` | Gets the account creation date |
| `OBTENER_FECHA_BLOQUEO_APODO()` | Gets the date until which the nickname is locked from further changes |
| `OBTENER_FECHA_BLOQUEO_CORREO()` | Gets the date until which the email is locked from further changes |
| `OBTENER_FECHA_BLOQUEO_CONTRASEÑA()` | Gets the date until which the password is locked from further changes |
| `OBTENER_USUARIOS_BLOQUEADOS()` | Gets the current user's blocked-users list |
| `OBTENER_USUARIOS_SILENCIADOS()` | Gets the current user's muted-users list |
| `OBTENER_MOSTRAR_CORREO_USUARIO()` | Gets whether the user's email is publicly visible |

### `social.cjs` → `window.social_usuario`

| Function | Purpose |
|---|---|
| `ENCONTRAR_USUARIOS_EXTERNOS(texto, correo)` | Searches other users by nickname or (if `correo` is true) email |
| `OBTENER_DATOS_USUARIO_EXTERNO(id, datos)` | Fetches public data of one external user, optionally a specific field subset |
| `OBTENER_VARIOS_DATOS_USUARIOS_EXTERNOS(ids, datos)` | Batch version of the above for multiple user IDs |
| `OBTENER_CONTACTOS_USUARIO()` | Gets the current user's contact list |
| `OBTENER_USUARIOS_BLOQUEADOS()` | Gets the blocked-users list |
| `OBTENER_USUARIOS_SILENCIADOS()` | Gets the muted-users list |
| `AÑADIR_CONTACTO(id, apodo)` | Adds a user as a contact |
| `ELIMINAR_CONTACTO(id)` | Removes a contact |
| `OBTENER_HIST_CHATS_CONTACTOS()` | Gets chat history linkage per contact |
| `VINCULAR_CHAT_CONTACTO(contacto_id, chat_id)` | Links an existing chat to a contact entry |
| `AÑADIR_USUARIO_BLOQUEADOS(id, apodo)` | Blocks a user |
| `ELIMINAR_USUARIO_BLOQUEADO(id)` | Unblocks a user |
| `AÑADIR_USUARIO_SILENCIADOS(id, apodo)` | Mutes a user |
| `ELIMINAR_USUARIO_SILENCIADOS(id)` | Unmutes a user |
| `TOGGLE_INVISIBLE_USUARIO()` | Toggles the current user's online-visibility (invisible mode) |
| `TOGGLE_MOSTRAR_CORREO_USUARIO()` | Toggles whether the current user's email is publicly shown |
| `GUARDAR_VARIOS_DATOS_USUARIOS_EXTERNOS(usuarios)` | Bulk-persists a set of external users' data into local cache |

### `chat.cjs` → `window.chats`

| Function | Purpose |
|---|---|
| `OBTENER_CHATS_USUARIO()` | Lists all of the current user's chats |
| `OBTENER_DATOS_CHATS_GRUPALES({ data, grupales, mensajes })` | Batch-fetches data for group chats |
| `OBTENER_DATOS_CHAT_UNICO(id, datos_buscar)` | Fetches data for a single chat |
| `OBTENER_MENSAJES_PAGINADOS(id_chat, limit, cursor_date, direction)` | Paginated message fetch (`'older'`/newer direction) used by the virtualized chat view |
| `CREAR_CHAT_NUEVO(ids, nombre, id_chat)` | Creates a new 1:1 or group chat |
| `ENVIAR_MENSAJE({ asunto, archivos, id_chat, id_emisor })` | Sends a message (text and/or attached files) |
| `SELECCIONAR_ARCHIVOS()` | Opens the native file picker for attachments |
| `DESCARGAR_ARCHIVO(id, nombre, iv, tag, id_chat, ratchet_info, emisor_id)` | Downloads and decrypts a message attachment |
| `OBTENER_PREVIEW_IMAGEN(id, nombre, iv, tag, id_chat, ratchet_info, emisor_id)` | Fetches a decrypted image preview (thumbnail/inline render) |
| `OBTENER_AUDIO_MENSAJE(id, nombre, iv, tag, id_chat, ratchet_info, emisor_id)` | Fetches and decrypts a voice-message audio file |
| `OBTENER_DATOS_MENSAJE(id_chat, id_mensaje)` | Fetches a single message's data by ID |
| `EXPULSAR_USUARIO_CHAT(id_usuario, id_chat)` | Kicks a user from a group chat |
| `RESPONDER_SOLICITUD_AÑADIR(id_chat, id_mensaje, aceptar)` | Accepts/rejects a pending "add to group" request |
| `HACER_ADMIN_CHAT(id_chat, id_usuario)` | Grants group-admin rights to a user |
| `QUITAR_ADMIN_CHAT(id_chat, id_usuario)` | Revokes group-admin rights from a user |
| `SILENCIAR_CHAT(id_chat)` | Mutes notifications for a chat |
| `BLOQUEAR_CHAT(id_chat)` | Blocks a chat |
| `GUARDAR_CACHE_CHAT_ACTIVO(data)` | Persists the active chat's virtualization cache block to the backend |
| `OBTENER_CACHE_CHAT_ACTIVO(id, bloque)` | Reads back a cached virtualization block for a chat |
| `ELIMINAR_MENSAJE(id_chat, id_mensaje)` | Deletes a message |
| `FIJAR_MENSAJE(id_chat, id_mensaje)` | Pins a message in the chat |
| `DESFIJAR_MENSAJE(id_chat)` | Unpins the currently pinned message |
| `LIMPIAR_MENSAJES_CHAT(id_chat)` | Clears all messages in a chat |
| `GESTIONAR_ELIMINAR_CHAT(id_chat)` | Deletes/leaves a chat |
| `ACTUALIZAR_DATOS_CHAT(id_chat, datos)` | Updates chat metadata (name, etc.) |

### `app_settings.cjs` → `window.ajustes_app`

Not present in the old Spanish doc — documented here from the code.

| Function | Purpose |
|---|---|
| `OBTENER_AJUSTES_APP(nombre)` | Reads app settings, optionally filtered to one setting name |
| `GUARDAR_AJUSTES_APP(data)` | Persists app settings |
| `EXPORTAR_ENV_A_DESCARGAS()` | Exports the vault's `.env` file to the Downloads folder |
| `EXPORTAR_CLAVE_PRIVADA()` | Exports the user's E2EE private identity key |
| `IMPORTAR_CLAVE_PRIVADA_ARCHIVO()` | Imports a private identity key from a file (adds it as a support key) |
| `LISTAR_CLAVES_IDENTIDAD()` | Lists the identity keys currently registered for the account |
| `CAMBIAR_CLAVE_PRINCIPAL(keyId)` | Switches which identity key is the primary one |
| `ELIMINAR_CLAVE_SOPORTE(keyId)` | Removes a secondary/support identity key |
| `EXPORTAR_CLAVE_POR_ID(keyId)` | Exports a specific identity key by its ID |
| `VERIFICAR_CONTRASENA_ACTUAL(contraseña)` | Verifies the current account password |
| `OBTENER_EMAIL_SOPORTE()` | Gets the support-contact email address |
| `CONFIGURAR_PIN(oldPin, newPin)` | Sets or changes the local security PIN |
| `VERIFICAR_PIN(pinAttempt)` | Verifies an entered PIN against the stored one |
| `TIENE_PIN()` | Checks whether a security PIN is currently configured |
| `OBTENER_NUM_CPUS()` | Gets the number of CPU cores available (for worker tuning UI) |
| `SET_NUM_WORKERS(n)` | Sets the number of worker threads the backend should use |

### `validators.cjs` → `window.validadores`

| Function | Purpose |
|---|---|
| `VALIDAR_CORREO(correo)` | Validates an email address format |
| `VALIDAR_APODO(apodo)` | Validates a nickname |
| `VALIDAR_CONTRASEÑA(contraseña)` | Validates password strength/format |
| `VALIDAR_IDAMIGO(idAmigo)` | Validates a friend-ID format |
| `VALIDAR_CODIGO(codigo)` | Validates a 6-digit verification code format |
| `VALIDAR_MENSAJE(mensaje)` | Validates a chat message body |
| `VALIDAR_NOMBRE_ARCHIVO(nombre)` | Validates a file name |

### `mailbox.cjs` → `window.buzonAPI`

| Function | Purpose |
|---|---|
| `REVISAR_BUZON()` | Requests an on-demand mailbox check/sync |
| `INICIAR_BUZON()` | Starts the mailbox listener (fire-and-forget `send`) |
| `onNuevaNotificacion(callback)` | Registers a listener for `nueva-notificacion` events (new mailbox entries) |
| `onNotificarRender(callback)` | Registers a listener for `notificar-render` events (render-triggering pushes) |

### `storage.cjs` → `window.cache_persistente` / `window.cache_archivos_descargados`

`storage.cjs` exports two sub-objects, each exposed to `window` under its own name (see globals table above).

**`cache_persistente`**

| Function | Purpose |
|---|---|
| `getUsuarioCache(id)` | Reads a cached external-user record |
| `obtenerHistorialBusquedas()` | Gets the local search history |
| `anadirHistorialBusquedas(id, datoUsado)` | Adds an entry to search history |
| `borrarHistorialBusquedas(id_o_dato)` | Removes one entry from search history |
| `limpiarHistorialCompleto()` | Clears all search history |
| `limpiarVariableCacheHistorial()` | Clears the in-memory history cache variable |
| `cancelarLimpiezaVariableCacheHistorial()` | Cancels a scheduled cache-clear |

**`cache_archivos_descargados`**

| Function | Purpose |
|---|---|
| `getCacheArchivosDescargados()` | Gets the downloaded-files cache index |
| `setCacheArchivosDescargados(cache)` | Overwrites the downloaded-files cache index |
| `setLimiteCacheArchivosDescargados(limite)` | Sets the max size/count limit for the downloads cache |
| `clearCacheArchivosDescargados()` | Clears the downloaded-files cache |

> Note: `preload.cjs` also tries to expose a third key, `storage.cache_url_img_extensiones`, as `window.cache_url_img_extensiones` — but `storage.cjs` does not define that key (see quirk note in §2).

### `security.cjs` → `window.escaneres_seguridad_app`

| Function | Purpose |
|---|---|
| `ESCANERES_SEGURIDAD_MENSAJE(id_chat)` | Gets which security scanners are enabled for a chat |
| `detectar_escenografia(text)` | Detects hidden/invisible steganography characters |
| `eliminar_escenografia(text)` | Strips steganography characters from text |
| `detectar_url(text)` | Detects URLs in text |
| `eliminar_url(text)` | Strips URLs from text |
| `detectar_url_maliciosa(text)` | Checks URLs against Google Safe Browsing |
| `detectar_xss(text)` | Detects injected HTML/JS (XSS) |
| `detectar_codigo(text)` | Detects source-code fragments |
| `detectar_zalgo(text)` | Detects excessive combining/diacritical (zalgo) characters |
| `eliminar_zalgo(text)` | Strips zalgo characters from text |
| `detectar_comandos_terminal(text)` | Detects dangerous shell/terminal commands |
| `detectar_crypto_billeteras(text)` | Detects cryptocurrency wallet addresses |
| `detectar_direcciones_ip(text)` | Detects IP addresses |
| `detectar_homoglifos(text)` | Detects homoglyph/look-alike character spoofing |
| `detectar_lote(items)` | Runs batch detection over multiple items at once |

### `utils.cjs` → `window.utilidades_app`

| Function | Purpose |
|---|---|
| `obtener_previsualizacion_url(text)` | Fetches metadata for a URL preview card |

### `avisos.cjs` → `window.avisos_ui`

Not present in the old Spanish doc. Unlike the other modules, these are one-way **listeners** (`ipcRenderer.on`) that let the backend push events into the renderer, rather than request/response `invoke` calls.

| Function | Purpose |
|---|---|
| `ICONO_CARGANDO(callback)` | Fires when the backend toggles the "syncing" loading indicator (`icono-cargando`) |
| `FALLO_CORREO_MANDAR(callback)` | Fires when the backend fails to send a verification email (`fallo-correo-mandar`) |
| `CERRANDO_SESION(callback)` | Fires while a logout is in progress, so the UI can show a "logging out" overlay (`cerrando-sesion`) |
| `LIMPIAR_RAM(callback)` | Fires when the backend asks the renderer to release memory/cache (`limpiar-ram-frontend`) |

### `opciones_dev.cjs` → `window.opciones_dev`

Not present in the old Spanish doc. Unlike the other modules it exposes no functions — just a static flag computed at preload load time:

| Field | Purpose |
|---|---|
| `isDev` | `true` when the `MODO_DEBUG` environment variable is `"true"`; gates developer-only behavior in the renderer, e.g. the renderer-memory logger in `frontend/home/renderer.js` |

(This module also imports `ipcRenderer` but does not currently use it.)

---
*Ravage Architecture Manual - Preload System*
