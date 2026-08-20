# Frontend Documentation

This document covers the `frontend/` folder: the Electron renderer-side code that draws the app's UI and talks to the backend exclusively through the `window.*` APIs exposed by the [preload scripts](./PRELOAD.md). None of the files in `frontend/` may use `require`/Node APIs directly — the renderer runs with `sandbox: true` (see `main.js`), so all backend access goes through `contextBridge`.

---

## 1. App Shell (`frontend/home/`)

### `home.html`

The main application shell (chat list, active chat panel, settings menu, "add chat" panel, PIN-unlock overlay, file-transfer dialogs, etc.) all live in this single HTML file, toggled via CSS classes rather than separate pages. It loads its stylesheets in this order:

```
base.css → layout.css → components.css → validation.css → chat.css
→ ../notificaciones/notificaciones.css → css_archivos.css → historial.css → ajustes.css
```

and its scripts at the bottom of `<body>`:

```html
<script src="../libs/purify.min.js"></script>
<script src="../libs/marked.umd.js"></script>
<script src="../notificaciones/notificaciones.js"></script>
<script type="module" src="./renderer.js"></script><!--CARGARLO AL FINAL DE TODO-->
```

`renderer.js` is loaded last and as an ES module (`type="module"`), so it can `import` from `./ui/*.js` and `./caches_datos.js`.

### `renderer.js`

The renderer bootstrap/hub. Responsibilities:

- Calls `optimizar_ventana()` (from `frontend/global/optimizar_ventana.js`) immediately to pause CSS animations when the window loses visibility.
- Imports and wires together every `ui/*.js` module (chat rendering, chat list management, file handling, message events, mailbox events, settings, navigation, contacts, session, file-extension icons).
- `inicializar_eventos_globales()` sets up **delegated** event listeners on a handful of stable containers (`DOM_CACHE.lista_chats_componentes`, `DOM_CACHE.chat_usuario`, `document`) rather than binding per-element handlers — this lets dynamically re-rendered chat/message DOM keep working without re-attaching listeners.
- `inicializar_escritura_automatica()` tracks the last focused input/textarea and auto-focuses it (or falls back to the chat textarea / search box) on any printable keypress, so the user can start typing without manually clicking a field first.
- On `DOMContentLoaded`, `preparar_interfaz_y_servicios()` plus a startup sequence runs:
  1. `DOM_CACHE.inicializar_estaticos()` to cache DOM references.
  2. Fetches the user's Mongo ID, nickname and email in parallel via `window.cuenta_usuario`.
  3. If `window.ajustes_app.TIENE_PIN()` is true, shows a blocking PIN overlay (`#overlay-pin-arranque`) and awaits `VERIFICAR_PIN` before continuing.
  4. Loads visual app settings (`window.ajustes_app.OBTENER_AJUSTES_APP()`) and applies `aplicar_ajuste_hilos(...)` (toggles animated "threads"/background motion).
  5. Fires the welcome message, loads the initial chat list (`INICIO_CHAT_MENU_PRINCIPAL()`), starts the URL-hover preview system, and connects the mailbox (`inicializar_buzon_notificaciones()`).
- Registers `window.avisos_ui.CERRANDO_SESION(...)` and `window.avisos_ui.LIMPIAR_RAM(...)` listeners so the backend can trigger a logout overlay or force the renderer to drop its in-memory caches (`limpiar_cache_virtualizacion_segundo_plano()`, `limpiar_cache_iconos()`, `DOM_CACHE.limpiar_cache_dom()`).
- On `window.focus`, if the DOM cache was cleared, re-initializes it — this is the recovery path after a RAM-cleanup cycle.
- If `window.opciones_dev?.isDev` is true, logs renderer heap usage (`performance.memory`) every 5s and warns above 80% of the heap limit.
- Globally prevents `<img>` drag-start (`dragstart`) to stop images being dragged out of the app.

### `caches_datos.js`

The central in-memory data store for the frontend, so the same data isn't re-fetched over IPC repeatedly. Exports:

- **Session identity** — `ID_USUARIO_MONGO`, `APODO_USUARIO`, `CORREO_USUARIO` plus setters (`establecer_id_usuario`, `establecer_apodo_usuario`, `establecer_correo_usuario`) and `obtener_apodo_usuario()` (lazy-fetches via `window.cuenta_usuario.GET_APODO_SESION()` if not cached).
- **UI/search state** — `cache_input_buscar_chat_ultimo` (avoids re-running chat search when the query hasn't changed) and `_cache_lista_usuarios_añadir` (selected users when creating a new chat/group).
- **Business-data caches** — `CACHE_USUARIOS_ACTIVO` (`Map` of user data for the currently open chat) and `batchRequestCache`, a short-TTL (default 500ms) memoizer used to coalesce repeated IPC lookups during batch rendering, with automatic eviction past 100 entries.
- **Attachment staging** — `cache_archivos_adjuntos` (`Map`) plus `establecer_cache_archivos_adjuntos`/`obtener_archivos_adjuntos_lista`, holding files selected for the next outgoing message.
- **Message-virtualization cache** — `CACHE_VIRTUALIZACION` (`Map<id_chat, {timestamp, mensajes_iniciales, hay_mas_inicial, cache_paginacion}>`), capped at 30 chats (`MAX_CHATS_CACHE_VIRTUALIZACION`) with LRU eviction, and each chat capped at `MAX_BLOQUES_PAGINACION_EXTRA` (5) extra pagination blocks. `guardar_cache_virtualizacion`, `obtener_cache_virtualizacion`, `invalidar_cache_virtualizacion` manage it; `limpiar_cache_virtualizacion_segundo_plano()` is the aggressive RAM-reclaim path (keeps only the 3 most recent chats, halves each chat's cached pagination blocks) invoked on the backend's `LIMPIAR_RAM` signal.
- **`DOM_CACHE`** — a single object holding references to stable DOM nodes (chat list container, chat panel, search input, settings menu, etc.), split into `inicializar_estaticos()` (elements permanent for the session, called once on boot/focus-recovery) and `refrescar_elementos_chat()` (elements that get recreated every time a different chat is opened, e.g. `#cuerpo-mensajes-chat`, `#textarea-mensaje-escritura`). `limpiar_cache_dom()` nulls out every non-function property to free references during RAM cleanup.

---

## 2. UI Modules (`frontend/home/ui/`)

| File | Responsibility |
|---|---|
| `chat.js` | Largest module (~2660 lines). Renders chat message HTML, virtualized/progressive message loading, mention resolution, security-scanner integration for message content, audio-message playback (waveform, player controls), image/file preview loading, URL hover-preview popups, and the "chat user info" panel. See detail below. |
| `gestor_chats.js` | Chat-list side: builds/refreshes the left-hand chat list, opens a chat (`abrir_chat_item`), tracks the active chat, context menus on chat list items, and DOM insertion of newly received/sent messages. See detail below. |
| `ajustes.js` | Settings panel: account data changes (password/nickname/email flows), security-scanner toggles per user, muted/blocked-user lists (`ver_chats_silenciados`, `ver_chats_bloqueados`), visual "threads" toggle (`aplicar_ajuste_hilos`). Largest UI file after `chat.js` (1344 lines). |
| `añadir_chats_usuarios.js` | "Add chat" flyout: searching external users, building a new 1:1 or group chat, selecting contacts to add. |
| `buzon_eventos.js` | Consumes real-time mailbox entries (`procesar_entradas_buzon`, `hacer_cambios_buzon`) pushed via `window.buzonAPI`, dispatching them into chat-list/chat-view updates; `inicializar_buzon_notificaciones()` wires the mailbox listeners on boot. |
| `descarga_archivos.js` | Small module handling the click-to-download flow for a message attachment, with a 1s cooldown between downloads. |
| `gestor_contactos.js` | Contacts panel: loading/filtering the contact list, opening a chat from a contact, contact context menu. |
| `historial_archivos_descargados.js` | Builds and caches the "downloaded files history" view, opening the pseudo-chat that lists past downloads. |
| `manejador_archivos.js` | Manages the outgoing-message attachment tray: file list rendering, opening/closing the attachment picker window, native file dialog, per-file context menu. |
| `mensajes_eventos.js` | Message composer logic: `@mention` autocomplete dropdown (navigation, selection), typing-indicator handling, sending a message (`enviar_mensaje_chat`), responding to "add to group" requests, per-message context menu. |
| `navegacion_vistas.js` | Left-panel view switcher (chats vs. contacts), the downloads-history toggle, and the welcome message on login. |
| `seguridad_ui.js` | Tiny utility module: `escapeHTML()` (XSS-safe HTML escaping for interpolated text) and `safeIdSelector()` (safely builds a CSS ID selector from arbitrary IDs). |
| `servicios_sesion.js` | Shows/hides the "Cerrando sesión..." (logging out) overlay bar. |
| `url_icono_extensiones_archivos.js` | Resolves and caches file-extension → icon URL lookups (backed by JSON manifests under `frontend/recursos/extensionesArchivos`), replacing least-recently-used cache entries first. |

### `chat.js` (in depth)

Handles everything needed to turn raw message/chat data into rendered DOM:

- **Media loading** — `cargar_preview_imagen`, `cargar_audio_mensaje` fetch and decrypt attachments via `window.chats.OBTENER_PREVIEW_IMAGEN`/`OBTENER_AUDIO_MENSAJE`, with fallback icons on failure (`_aplicar_fallback_preview`, `_aplicar_fallback_audio`). Audio playback builds a synthetic waveform (`_generar_waveform`/`_waveform_sintetica`) and wires custom player controls (`_setup_audio_events`).
- **Security scanning** — `aplicar_escaneres_sincronos` and `aplicar_escaneres_asincronos` run the scanners exposed by `window.escaneres_seguridad_app` against message text (sync scanners like zalgo/steganography run inline; async ones like malicious-URL detection are queued via `procesar_cola_escaneres_async` so rendering isn't blocked).
- **Mentions** — `resolverMenciones`/`resolverMencionesAsync` turn `@id` mention tokens into clickable `@nombre` spans, resolving names from a provided map, contacts cache, or IPC batch lookup (`_resolver_ids_menciones`).
- **Message rendering** — `crear_mensaje_html` builds the HTML for a single message (text via `marked`, sanitized via `DOMPurify`, plus attachments/mentions/date grouping). `_construir_html_mensajes`, `_renderizar_bloque_en_dom`, `_rearmar_agrupacion_dom` and `_agrupar_por_dia`/`_calcular_agrupacion` implement day-grouping of consecutive messages.
- **Virtualized scrolling** — `cargar_bloque_arriba`/`cargar_bloque_abajo` page older/newer messages in and out of the DOM as the user scrolls, backed by `window.chats.OBTENER_MENSAJES_PAGINADOS`; `_reciclar_mensajes` recycles/removes off-screen DOM nodes to bound memory use; `obtener_estado_virtualizacion`/`destruir_virtualizacion` expose/reset virtualization state. `agregar_a_cache_activo`, `iniciar_limpieza_cache_activo`, `limpiar_cache_activo` manage `CACHE_USUARIOS_ACTIVO` (from `caches_datos.js`) for the currently open chat's participants.
- **Chat/user info panel** — `mostrar_datos_chat_usuarios` (the largest function in the file, ~700 lines) renders the right-side "chat info" panel: participant list, admin controls, block/mute state, etc. `Crear_chat_html` and `Encontrar_Nombre_Chat_Usuario` build the chat header/name for both 1:1 and group chats.
- **URL hover previews** — `iniciar_sistema_hover_urls`, `_manejar_hover_url`, `_render_url_preview`, `_posicionar_popup_url` show a link-preview popup (via `window.utilidades_app.obtener_previsualizacion_url`) when hovering a URL in a message, flagging dangerous ones.
- **Mention click / add-contact flow** — `manejar_click_mencion`, `Es_Contacto_Usuario`, `Es_usuario_Sesion`, `abrir_dialogo_anadir_contacto`, `mostrar_opcion_anadir_contacto` let clicking a mention open that user's chat or offer to add them as a contact.

### `gestor_chats.js` (in depth)

Owns the left-hand chat list and the mechanics of switching the active chat:

- `ACTUALIZAR_LISTAS_CHAT(filtro)` rebuilds/filters the chat list from `window.chats.OBTENER_CHATS_USUARIO()`.
- `abrir_chat_item(id_chat, force)` is the main "open this chat" entry point: marks it active (`marcar_chat_activo`), loads its data/messages (`Get_datos_chat_abrir`), and triggers rendering — this is what `renderer.js`'s click delegation on `.chat-componente-lista-chats` calls.
- `Get_datos_chat_abrir(id_chat)` fetches a chat's data, preferring the in-memory virtualization cache (`caches_datos.js`) before falling back to IPC.
- `refrescar_componente_lista_chats` / `cambiar_datos_componente_lista_chats` update a single chat-list row in place (last message preview, unread badge, mute/block icons) without re-rendering the whole list, driven by mailbox events from `buzon_eventos.js`.
- `Actualizar_render_chat`, `_preparar_datos_mensaje`, `_insertar_mensaje_dom` handle inserting a freshly sent/received message into the currently open chat's DOM.
- `registrar_scroll_usuario`, `scroll_fin_chat` track/manage auto-scroll-to-bottom behavior so the view doesn't jump while a user is reading scrollback.
- `mostrar_menu_contextual_lista_chats` builds the right-click context menu (mute, block, delete, etc.) for a chat-list entry.
- `INICIO_CHAT_MENU_PRINCIPAL()` is the startup call from `renderer.js` that populates the initial chat list on boot.
- `INCREMENTAR_MENSAJES_CACHE_ACTIVA` bumps the cached message count for a chat, used by `mensajes_eventos.js` and `buzon_eventos.js` after sends/receives.

---

## 3. Styles (`frontend/home/styles/`)

The stylesheet is split by concern and loaded in a fixed cascade order from `home.html` (see §1). Rough breakdown:

| File | Scope |
|---|---|
| `base.css` | Resets, base typography/colors, global CSS variables — the foundation every other sheet builds on. |
| `layout.css` | Top-level page structure: the two/three-panel shell (chat list, active chat, side panels), sizing/positioning. |
| `components.css` | Reusable small UI pieces used across views — buttons, list items, badges, menus, dropdowns. |
| `validation.css` | Styling for form-validation states (error text, invalid-input highlighting), shared with the login/register form conventions. |
| `chat.css` | By far the largest sheet (~2400 lines): everything specific to the chat view — message bubbles, attachments, audio player, mention chips, context menus, the chat-info panel, URL preview popup. |
| `css_archivos.css` | Styling for the attachment tray / file-picker window (`manejador_archivos.js`) and its item list. |
| `historial.css` | Styling for the downloaded-files history view (`historial_archivos_descargados.js`). |
| `ajustes.css` | Largest sheet after `chat.css` (~1140 lines): the full settings panel — account fields, scanner toggles, blocked/muted lists, PIN/identity-key management UI. |

`frontend/notificaciones/notificaciones.css` (loaded separately, see §5) styles the in-app toast notifications and is shared between `home.html` and `sesion-log/sesion.html`.

---

## 4. Login/Register Screen (`frontend/sesion-log/`)

- **`sesion.html`** — the pre-login page: login form, registration form, email-code validation form, "new device trusted?" confirmation, and an "account created" confirmation screen, all as sibling sections toggled via `mostrarSeccion()`. Loads `style.css` and `../notificaciones/notificaciones.css`, then `../notificaciones/notificaciones.js` (non-module) and `./log.js` (module, loaded last).
- **`log.js`** — drives `sesion.html`:
  - `optimizar_ventana()` is called immediately, same as in `renderer.js`.
  - `preload_pag()` caches all relevant DOM elements into a module-level `elements` object and shows the login section by default.
  - `mostrarSeccion(seccionActiva)` / `mostrarError` / `ocultarError` implement the single-active-section navigation and inline error display.
  - The login form handler validates input via `window.validadores.VALIDAR_CORREO`/`VALIDAR_CONTRASEÑA`, then calls `window.sesion_usuario.LOGIN_USUARIO`; on success it either navigates straight to home (`autoverificacion`) or shows the email-code validation step.
  - The register form handler validates nickname/email/password/confirm-password, then calls `window.sesion_usuario.REGISTRAR_USUARIO`, leading into the same code-validation step.
  - `handleValidacionCode` submits the code via `VALIDAR_CODE_LOGIN_USUARIO`/`VALIDAR_CODE_REGISTRAR_USUARIO` depending on `formValidacion.dataset.mode`; on a successful login it shows the "trust this device?" section, wiring `MARCAR_DISPOSITIVO_CONFIANZA`/rejection to `window.paginas_app.CAMBIAR_PAGINA_HOME()`. Failed attempts decrement a local `intentos` (attempts) counter (starts at 5).
  - Registers `window.avisos_ui.ICONO_CARGANDO` (shows/hides a sync bar) and `window.avisos_ui.FALLO_CORREO_MANDAR` (pushes an error toast) listeners.
  - Also disables image dragging globally, mirroring `renderer.js`.

---

## 5. In-App Notifications (`frontend/notificaciones/`)

`notificaciones.js` (loaded as a plain classic script, not a module, so it's usable from both `home.html` and `sesion-log/sesion.html`) implements toast-style notifications:

- Icon/title lookup tables per type (`error`, `info`, `success`, `warning`, plus a `default`).
- `obtenerContenedor()` lazily creates a shared `#notificaciones-contenedor` div appended to `<body>`.
- `crearElementoNoti(texto, tipo, duracion)` builds a single notification's DOM (icon, title, body) with a CSS custom property (`--noti-duracion`) driving its auto-dismiss animation.
- `cerrarNotificacion(div)` handles the exit animation before removal.
- The module installs a global `window.pushNotificacion({ prioridad, texto, tipo })` function — this is the API every other frontend module (`renderer.js`, `log.js`, `chat.js`, etc.) calls to surface a toast.

`notificaciones.css` provides the accompanying styling (positioning, stacking, enter/exit animation).

---

## 6. Window Optimization (`frontend/global/optimizar_ventana.js`)

A single-purpose 7-line module:

```javascript
export function optimizar_ventana() {
    document.addEventListener('visibilitychange', () => {
        document.body.style.setProperty('--animate',
            document.hidden ? 'paused' : 'running'
        );
    });
}
```

It toggles the `--animate` CSS custom property between `paused` and `running` based on `document.hidden`, letting CSS animations (background threads, spinners, etc.) reference `animation-play-state: var(--animate)` so they pause automatically when the window is minimized/backgrounded — saving CPU/GPU. Called once at the top of both `renderer.js` and `log.js`.

---

## 7. Vendored Libraries (`frontend/libs/`)

Both files are third-party libraries vendored directly (loaded as plain `<script>` tags in `home.html`, not npm-installed into the bundle), because the sandboxed renderer cannot resolve `node_modules` imports at runtime for classic scripts:

- **`marked.umd.js`** — [marked](https://github.com/markedjs/marked), a Markdown-to-HTML renderer. Used by `chat.js` to render message text (bold, links, code blocks, etc.) as formatted HTML before display.
- **`purify.min.js`** — [DOMPurify](https://github.com/cure53/DOMPurify), an XSS sanitizer. Used to sanitize the HTML that `marked` produces (and any other user-controlled HTML) before it's inserted into the DOM, so a malicious message body can't execute script or inject unsafe markup. This is the primary defense-in-depth layer for message content, complementing the `escapeHTML`/`safeIdSelector` helpers in `ui/seguridad_ui.js` and the backend content scanners in `preload/security.cjs`.

---

## 8. Static Assets (`frontend/recursos/`)

Static images/icons used throughout the UI: the app icon (`RavageIcono.png`), generic action icons (search, download, mute, block, folder, gear, broom/clear, plus, cross, etc.), and two sub-folders — `extensionesArchivos/` (per-file-extension icons, looked up by `ui/url_icono_extensiones_archivos.js` via a JSON manifest) and `seguridad/` (security/scanner-related iconography). Not enumerated file-by-file here; add new assets under the existing sub-folder that matches their purpose.

