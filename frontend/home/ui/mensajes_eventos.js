import { Actualizar_render_chat, ACTUALIZAR_LISTAS_CHAT, abrir_chat_item, cambiar_datos_componente_lista_chats, INCREMENTAR_MENSAJES_CACHE_ACTIVA } from './gestor_chats.js'
import { ID_USUARIO_MONGO, CACHE_USUARIOS_ACTIVO } from '../caches_datos.js'
import { obtener_archivos_mensaje, limpiar_archivos_mensaje, cerrar_ventana_archivos } from './manejador_archivos.js'

// Accede a _virt de chat.js sin importarlo directamente (evita ciclo mensajes_eventos→chat→gestor_chats→mensajes_eventos)
function _get_virt() { return window.__ravage_get_virt?.() ?? null; }

// ─── MENCIONES (@) ───────────────────────────────────────────────────────────

let _mencion_activa = null;     // { inicio: number, consulta: string }
let _dropdown_menciones = null;
let _candidatos = [];
let _indice_sel = -1;
let _click_fuera_handler = null;
let _suprimir_siguiente = false;

// Menciones insertadas en el borrador actual. En el textarea se muestra el apodo
// (@nombre) para no exponer el id; aquí guardamos a qué participante pertenece
// cada apodo y al enviar se reescribe a su forma canónica @{id}.
let _menciones_borrador = [];   // [{ id, nombre }]

// Caché de participantes por chat para no repetir llamadas IPC en cada tecla
let _cache_participantes_menciones = null;
let _cache_id_chat_menciones = null;

function _resolver_nombre_local(id, map_nombres) {
    const nombre = map_nombres?.[id];
    if (nombre && nombre !== '~no encontrado~') return nombre;
    const cached = CACHE_USUARIOS_ACTIVO.get(id)?.data;
    if (cached?.apodo) return '~' + cached.apodo;
    return null;
}

async function _obtener_participantes() {
    const virt = _get_virt();
    console.log('[MENCIONES] _get_virt() =', virt ? { id_chat: virt.id_chat, usuarios: virt.datos_chat?.usuarios, map_nombres: virt.map_nombres } : null);
    if (!virt) return [];

    // Invalidar caché si cambiamos de chat
    if (_cache_id_chat_menciones !== virt.id_chat) {
        _cache_participantes_menciones = null;
        _cache_id_chat_menciones = virt.id_chat;
    }
    if (_cache_participantes_menciones) return _cache_participantes_menciones;

    const id_propio = ID_USUARIO_MONGO?.toString();
    const map = virt.map_nombres || {};
    const resultado = [];
    const vistos = new Set();
    const ids_sin_nombre = [];

    // 1. Recorrer TODOS los participantes del chat (no solo emisores de mensajes)
    const usuarios_raw = virt.datos_chat?.usuarios || [];
    for (const u of usuarios_raw) {
        const id = typeof u === 'string' ? u : (u?.id || u?._id)?.toString?.();
        if (!id || id === id_propio || id === '[object Object]' || vistos.has(id)) continue;
        vistos.add(id);
        const nombre = _resolver_nombre_local(id, map);
        if (nombre) resultado.push({ id, nombre });
        else ids_sin_nombre.push(id);
    }

    // 2. También añadir emisores en map_nombres no incluidos arriba
    for (const [id, nombre] of Object.entries(map)) {
        if (id === id_propio || vistos.has(id) || nombre === '~no encontrado~') continue;
        resultado.push({ id, nombre });
        vistos.add(id);
    }

    // 3. Para los que no tienen nombre, pedir al backend (solo si hay)
    if (ids_sin_nombre.length > 0) {
        try {
            const [datos, contactos] = await Promise.all([
                window.social_usuario.OBTENER_VARIOS_DATOS_USUARIOS_EXTERNOS(ids_sin_nombre),
                window.social_usuario.OBTENER_CONTACTOS_USUARIO()
            ]);
            const map_c = Object.fromEntries((contactos || []).map(c => [c.id, c.apodo]));
            for (const u of (datos || [])) {
                const id = u?.id || u?._id?.toString?.();
                if (!id) continue;
                const nombre = map_c[id] || (u.apodo ? '~' + u.apodo : null);
                if (nombre) resultado.push({ id, nombre });
            }
        } catch { /* si falla, se muestran solo los que ya teníamos */ }
    }

    _cache_participantes_menciones = resultado;
    return resultado;
}

function _detectar_mencion(textarea) {
    const val = textarea.value;
    const pos = textarea.selectionStart;
    let i = pos - 1;
    while (i >= 0) {
        const ch = val[i];
        if (ch === '@') {
            const consulta = val.slice(i + 1, pos);
            if (!/[\s\n]/.test(consulta)) return { inicio: i, consulta };
            break;
        }
        if (ch === ' ' || ch === '\n') break;
        i--;
    }
    return null;
}

export function invalidar_cache_menciones() {
    _cache_participantes_menciones = null;
    _cache_id_chat_menciones = null;
    _menciones_borrador = [];
}

function _cerrar_dropdown() {
    if (_dropdown_menciones) {
        _dropdown_menciones.remove();
        _dropdown_menciones = null;
    }
    if (_click_fuera_handler) {
        document.removeEventListener('click', _click_fuera_handler);
        _click_fuera_handler = null;
    }
    _mencion_activa = null;
    _candidatos = [];
    _indice_sel = -1;
}

function _actualizar_seleccion() {
    if (!_dropdown_menciones) return;
    _dropdown_menciones.querySelectorAll('.dropdown-menciones-item').forEach((el, i) => {
        el.classList.toggle('seleccionado', i === _indice_sel);
        if (i === _indice_sel) el.scrollIntoView({ block: 'nearest' });
    });
}

function _mostrar_dropdown(textarea, candidatos, mencion) {
    _cerrar_dropdown();
    // _cerrar_dropdown() pone _mencion_activa = null, así que lo restauramos
    _mencion_activa = mencion;
    if (candidatos.length === 0) return;

    _candidatos = candidatos;
    _indice_sel = -1;

    const dropdown = document.createElement('div');
    dropdown.id = 'dropdown-menciones';
    dropdown.className = 'dropdown-menciones';

    candidatos.forEach((c, idx) => {
        const item = document.createElement('div');
        item.className = 'dropdown-menciones-item';
        item.textContent = '@' + c.nombre;
        item.addEventListener('mousedown', e => e.preventDefault());
        item.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            _insertar_mencion(textarea, c);
        });
        dropdown.appendChild(item);
    });

    const rect = textarea.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
    dropdown.style.bottom = (window.innerHeight - rect.top + 4) + 'px';

    document.body.appendChild(dropdown);
    _dropdown_menciones = dropdown;

    setTimeout(() => {
        _click_fuera_handler = (e) => {
            if (_dropdown_menciones && !_dropdown_menciones.contains(e.target)) {
                _cerrar_dropdown();
            }
        };
        document.addEventListener('click', _click_fuera_handler);
    }, 0);
}

function _insertar_mencion(textarea, candidato) {
    if (!_mencion_activa) return;
    const val = textarea.value;
    const antes = val.slice(0, _mencion_activa.inicio);
    const despues = val.slice(_mencion_activa.inicio + 1 + _mencion_activa.consulta.length);
    // Mostramos el apodo (legible); el id se guarda en el registro del borrador
    // y se sustituye al enviar. Nunca se muestra el id al usuario.
    const insercion = `@${candidato.nombre} `;
    if (!_menciones_borrador.some(m => m.id === candidato.id && m.nombre === candidato.nombre)) {
        _menciones_borrador.push({ id: candidato.id, nombre: candidato.nombre });
    }
    const nueva_pos = antes.length + insercion.length;
    _cerrar_dropdown();
    _suprimir_siguiente = true;
    textarea.value = antes + insercion + despues;
    textarea.setSelectionRange(nueva_pos, nueva_pos);
    textarea.style.height = '1px';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// Reescribe los apodos de las menciones del borrador (@nombre) a su forma
// canónica @{id} antes de enviar. Se procesan primero los nombres más largos
// para evitar coincidencias parciales entre apodos que comparten prefijo.
function _convertir_menciones_a_ids(texto) {
    if (!texto || _menciones_borrador.length === 0) return texto;
    const ordenadas = [..._menciones_borrador].sort((a, b) => b.nombre.length - a.nombre.length);
    for (const { id, nombre } of ordenadas) {
        const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // @nombre como token: precedido por inicio/espacio y no seguido de letra/dígito
        const re = new RegExp(`(^|\\s)@${escapado}(?![\\w])`, 'g');
        texto = texto.replace(re, `$1@{${id}}`);
    }
    return texto;
}

export function dropdown_menciones_activo() {
    return _dropdown_menciones !== null;
}

export function navegar_dropdown_menciones(delta) {
    if (!_dropdown_menciones) return;
    _indice_sel = Math.max(-1, Math.min(_candidatos.length - 1, _indice_sel + delta));
    _actualizar_seleccion();
}

export function seleccionar_candidato_activo(textarea) {
    if (!_dropdown_menciones) return false;
    const candidato = _indice_sel >= 0 ? _candidatos[_indice_sel] : _candidatos[0];
    if (!candidato) { _cerrar_dropdown(); return false; }
    _insertar_mencion(textarea, candidato);
    return true;
}

export function cerrar_dropdown_menciones() {
    _cerrar_dropdown();
}

// ─── INPUT ───────────────────────────────────────────────────────────────────

export async function manejar_input_escribiendo(textarea) {
    // Auto-ajuste de altura instantáneo
    textarea.style.height = "1px";
    textarea.style.height = (textarea.scrollHeight) + "px";

    if (_suprimir_siguiente) {
        _suprimir_siguiente = false;
    } else {
        const mencion = _detectar_mencion(textarea);
        console.log('[MENCIONES] input. mencion detectada =', mencion);
        if (mencion) {
            const todos = await _obtener_participantes();
            console.log('[MENCIONES] participantes obtenidos =', todos);
            // Re-detectar tras el await por si el usuario siguió escribiendo
            const mencion_actual = _detectar_mencion(textarea);
            if (mencion_actual) {
                const lower = mencion_actual.consulta.toLowerCase();
                const filtrados = mencion_actual.consulta
                    ? todos.filter(p => p.nombre.toLowerCase().includes(lower)).slice(0, 8)
                    : todos.slice(0, 8);
                console.log('[MENCIONES] filtrados =', filtrados, '→ mostrando dropdown');
                _mostrar_dropdown(textarea, filtrados, mencion_actual);
            } else {
                _cerrar_dropdown();
            }
        } else {
            _cerrar_dropdown();
        }
    }

    const id_chat = document.querySelector("#nav-principal-chat-usuario")?.dataset.id;
    const result_seguridad = await window.escaneres_seguridad_app.ESCANERES_SEGURIDAD_MENSAJE(id_chat);
    const esteg = result_seguridad.escaneres_seguridad?.ESCANER_ESTEGANOGRAFIA || result_seguridad?.ESCANER_ESTEGANOGRAFIA;

    if (esteg === 3) {
        const r = await window.escaneres_seguridad_app.eliminar_escenografia(textarea.value);
        if (r.cambios) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = r.text;
            textarea.setSelectionRange(start, end);
        }
    }
    if (textarea.value.length > 1000) textarea.value = textarea.value.substring(0, 1000);
}


export async function enviar_mensaje_chat(textarea) {
    let mensaje = textarea.value.trim()
    // Sustituir los apodos visibles de las menciones por su id canónico @{id}
    // antes de validar/enviar (cada receptor lo resolverá con su propio apodo).
    mensaje = _convertir_menciones_a_ids(mensaje)
    const id_chat = document.querySelector("#nav-principal-chat-usuario")?.dataset.id
    const id_usuario = ID_USUARIO_MONGO
    const archivos_actuales = obtener_archivos_mensaje()

    if (!mensaje && archivos_actuales.length === 0) return;

    const req_seguridad = await window.escaneres_seguridad_app.ESCANERES_SEGURIDAD_MENSAJE(id_chat);
    if ((req_seguridad.escaneres_seguridad?.ESCANER_ESTEGANOGRAFIA || 0) === 3) {
        const resc = await window.escaneres_seguridad_app.eliminar_escenografia(mensaje);
        mensaje = resc.text;
    }

    const esValido = await window.validadores.VALIDAR_MENSAJE(mensaje)
    if (!esValido && archivos_actuales.length === 0) {
        window.pushNotificacion({ PRIORIDAD: 2, texto: "Mensaje no válido", tipo: "info" }); return;
    }

    const copia_archivos = [...archivos_actuales]
    limpiar_archivos_mensaje() // Reset instantaneo de UI
    textarea.value = ""
    _menciones_borrador = [] // Borrador enviado: limpiar menciones registradas
    textarea.style.height = "35px" // Reset altura a la base de CSS (35px)
    cerrar_ventana_archivos()

    const result = await window.chats.ENVIAR_MENSAJE({ asunto: mensaje, archivos: copia_archivos, id_chat: id_chat, id_emisor: id_usuario })
    if (result && result.success && result.mensaje) {
        const respuesta = result.mensaje;
        await Actualizar_render_chat({
            emisor: respuesta.emisor,
            chat: id_chat,
            mensaje: respuesta.contenido?.[0]?.asunto || "",
            archivos: respuesta.contenido?.[0]?.archivos || [],
            fecha: respuesta.data,
            id_mensaje: result.id_mensaje
        })
        await cambiar_datos_componente_lista_chats({ id_chat, data: {asunto:mensaje,data:new Date().toISOString(),emisor:id_usuario} })
        INCREMENTAR_MENSAJES_CACHE_ACTIVA(id_chat, 1);
    }
}

export async function manejar_solicitud_chat(btn, aceptar) {
    const id_chat_sol = btn.dataset.chat
    const id_mensaje_sol = btn.dataset.mensaje
    
    btn.closest(".solicitud-botones")?.querySelectorAll("button").forEach(b => b.disabled = true)
    
    const res = await window.chats.RESPONDER_SOLICITUD_AÑADIR(id_chat_sol, id_mensaje_sol, aceptar)
    if (res?.success) {
        window.pushNotificacion({ prioridad: 1, texto: aceptar ? "Usuario añadido" : "Rechazado", tipo: "success" })
        await ACTUALIZAR_LISTAS_CHAT()
        await abrir_chat_item(id_chat_sol, true)
    } else {
        window.pushNotificacion({ prioridad: 0, texto: "Error al procesar", tipo: "error" })
        btn.closest(".solicitud-botones")?.querySelectorAll("button").forEach(b => b.disabled = false)
    }
}

export async function mostrar_menu_contextual_mensaje(e, mensaje_node) {
    const id_mensaje = mensaje_node.dataset.id;
    if (!id_mensaje) return;

    const id_chat = document.querySelector("#nav-principal-chat-usuario")?.dataset.id;
    if (!id_chat) return;

    // Verificar si somos admins
    const datos_chat = await window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat, "admins usuarios");
    const esAdmin = datos_chat?.admins?.includes(ID_USUARIO_MONGO);
    const esEmisor = mensaje_node.classList.contains("soy-emisor");

    document.querySelector(".context-menu-mensaje")?.remove();

    const menu = document.createElement("div");
    menu.className = "context-menu context-menu-mensaje";
    menu.style.position = "fixed";
    menu.style.zIndex = "1000";

    const items = [];

    // Siempre podemos eliminar si somos el emisor o si somos admins
    if (esEmisor || esAdmin) {
        items.push(`<div class="context-menu-item" style="color:#ff4d4f;" data-action="eliminar">Eliminar</div>`);
    }

    if (esAdmin) {
        items.push(`<div class="context-menu-item" data-action="fijar">Fijar</div>`);
    }

    if (items.length === 0) return; // Si no hay opciones, no mostrar menú

    menu.innerHTML = items.join("");
    document.body.appendChild(menu);

    const menuRect = menu.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuRect.width > window.innerWidth) x = window.innerWidth - menuRect.width - 5;
    if (y + menuRect.height > window.innerHeight) y = window.innerHeight - menuRect.height - 5;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const closeMenu = () => {
        menu.remove();
        document.removeEventListener("click", closeMenu);
    };

    setTimeout(() => {
        document.addEventListener("click", closeMenu);
    }, 0);

    menu.querySelectorAll(".context-menu-item").forEach(item => {
        item.addEventListener("click", async (ev) => {
            ev.stopPropagation();
            const action = item.dataset.action;
            closeMenu();

            if (action === "eliminar") {
                const res = await window.chats.ELIMINAR_MENSAJE(id_chat, id_mensaje);
                if (res?.success) {
                    const asuntoNode = mensaje_node.querySelector(".asunto-mensaje-chat");
                    if (asuntoNode) {
                        asuntoNode.innerHTML = `🚫 Este mensaje ha sido eliminado`;
                        asuntoNode.style.fontStyle = "italic";
                        asuntoNode.style.opacity = "0.7";
                    }
                    const archivosNode = mensaje_node.querySelector(".mensaje-div-archivos");
                    if (archivosNode) archivosNode.remove();

                    // Si el mensaje borrado era el fijado, quitar el banner
                    const banner = document.getElementById("banner-mensaje-fijado");
                    if (banner && banner.dataset.id === id_mensaje) {
                        banner.remove();
                    }
                } else {
                    window.pushNotificacion({ prioridad: 0, texto: res?.message || "Error al eliminar", tipo: "error" });
                }
            } else if (action === "fijar") {
                const res = await window.chats.FIJAR_MENSAJE(id_chat, id_mensaje);
                if (res?.success) {
                    window.pushNotificacion({ prioridad: 1, texto: "Mensaje fijado", tipo: "success" });
                    // Refresh the chat to show the banner
                    abrir_chat_item(id_chat, true);
                } else {
                    window.pushNotificacion({ prioridad: 0, texto: "Error al fijar", tipo: "error" });
                }
            }
        });
    });
}
