import { limpiar_archivos_mensaje } from './manejador_archivos.js'
import { ID_USUARIO_MONGO, batchRequestCache, DOM_CACHE, invalidar_cache_virtualizacion } from '../caches_datos.js'
import { escapeHTML, safeIdSelector } from './seguridad_ui.js';
import {
    chat_componente_lista_estructura_html,
    Crear_chat_html,
    Encontrar_Nombre_Chat_Usuario,
    crear_mensaje_html,
    aplicar_escaneres_asincronos,
    texto_mostrar_fecha_mensajes_bloque,
    formatear_fecha_chat_lista,
    obtener_estado_virtualizacion,
    destruir_virtualizacion,
    cargar_bloque_arriba,
    cargar_bloque_abajo
} from './chat.js';
import { HILOS_DESACTIVADOS } from './ajustes.js';
import {
    manejar_input_escribiendo,
    manejar_solicitud_chat
} from './mensajes_eventos.js';

const MODELO_DATOS_NECESARIOS_CHAT = {
    nombre: null,
    usuarios: null,
    admins: null,
    fecha_creacion: null,
    nmensajes: null
};

export function cerrar_paneles_al_abrir_chat() {
    const infoSeccion = DOM_CACHE.info_chat_seccion
    if (infoSeccion && infoSeccion.classList.contains("abierto")) {
        infoSeccion.classList.remove("abierto")
    }
    const ventanaArchivos = document.querySelector(".ventana-archivos-mensaje")
    if (ventanaArchivos) {
        ventanaArchivos.classList.remove("abierto")
        setTimeout(() => ventanaArchivos.remove(), 310)
    }
    const seccionHistorial = DOM_CACHE.seccion_historial_archivos
    const chatUsuario = DOM_CACHE.chat_usuario
    if (seccionHistorial && !seccionHistorial.classList.contains("ocultar-display")) {
        seccionHistorial.classList.add("ocultar-display")
        if (chatUsuario) chatUsuario.classList.remove("ocultar-display")
    }
}

// Variable global en el módulo para gestionar el bloqueo de carga de chats
let id_chat_cargando = null;



export async function Get_datos_chat_abrir(id_chat) {
    const resultados = await Promise.allSettled([
        window.chats.OBTENER_CACHE_CHAT_ACTIVO(id_chat)
    ]);

    const res = resultados.map(r => r.status === 'fulfilled' ? r.value : null);
    const [cacheAct] = res;

    let datos_necesarios = { ...MODELO_DATOS_NECESARIOS_CHAT };

    let ids_usuarios = cacheAct?.usuarios || null;
    let campos_chat_faltantes = [];

    for (const key of Object.keys(datos_necesarios)) {
        if (cacheAct?.[key]) datos_necesarios[key] = cacheAct[key];
        else if (key !== 'd_usuarios' && key !== 'usuarios') campos_chat_faltantes.push(key);
    }

    const promesas_opt = [];
    const campos_str = campos_chat_faltantes.join(" ");
    const indice_chat = campos_chat_faltantes.length > 0 ? promesas_opt.push(window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat, campos_str)) - 1 : -1;
    const indice_ids = !ids_usuarios ? promesas_opt.push(window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat, 'usuarios')) - 1 : -1;

    const resultados_db = await Promise.all(promesas_opt);

    if (indice_chat !== -1 && resultados_db[indice_chat]) {
        Object.assign(datos_necesarios, resultados_db[indice_chat]);
    }
    if (indice_ids !== -1 && resultados_db[indice_ids]?.usuarios) {
        ids_usuarios = resultados_db[indice_ids].usuarios;
    }

    let usuarios_detalles = cacheAct?.d_participantes || null;
    if (!usuarios_detalles && ids_usuarios) {
        usuarios_detalles = await window.social_usuario.OBTENER_VARIOS_DATOS_USUARIOS_EXTERNOS(ids_usuarios, "apodo correo");
    }

    datos_necesarios.d_usuarios = usuarios_detalles;
    datos_necesarios.usuarios = ids_usuarios;
    datos_necesarios._id = id_chat;


    window.chats.GUARDAR_CACHE_CHAT_ACTIVO({
        _id: id_chat,
        nombre: datos_necesarios.nombre,
        seguridad: datos_necesarios.seguridad,
        usuarios: ids_usuarios,
        admins: datos_necesarios.admins,
        fecha_creacion: datos_necesarios.fecha_creacion,
        nmensajes: datos_necesarios.nmensajes,
        d_participantes: usuarios_detalles
    });

    return datos_necesarios;
}

/**
 * Incrementa el contador de mensajes en la caché activa del chat.
 * @param {string} id_chat - ID del chat a incrementar.
 * @param {number} incremento - Cantidad a sumar (defecto 1).
 */
export async function INCREMENTAR_MENSAJES_CACHE_ACTIVA(id_chat, incremento = 1) {
    if (!id_chat) return;
    try {
        const cache = await window.chats.OBTENER_CACHE_CHAT_ACTIVO(id_chat);
        if (cache) {
            const nuevo_total = (Number(cache.nmensajes) || 0) + incremento;
            await window.chats.GUARDAR_CACHE_CHAT_ACTIVO({
                _id: id_chat,
                nmensajes: nuevo_total
            });
            console.log(`[Cache] Mensajes incrementados para ${id_chat}: +${incremento} (Total: ${nuevo_total})`);
        }
    } catch (e) {
        console.error("Error al incrementar cache de mensajes:", e);
    }
}

export async function ACTUALIZAR_LISTAS_CHAT(filtro = "") {
    try {
        console.log("[Renderer] ACTUALIZAR_LISTAS_CHAT: Solicitando lista de chats...");
        const lista_chats = await window.chats.OBTENER_CHATS_USUARIO()
        console.log(`[Renderer] Recibidos ${lista_chats.length} chats básicos.`);

        console.log("[Renderer] ACTUALIZAR_LISTAS_CHAT: Solicitando metadatos de grupos...");
        const datos_chats_grupales = await window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: lista_chats, grupales: null, mensajes: false })
        console.log(`[Renderer] Recibidos metadatos para ${datos_chats_grupales?.length || 0} chats.`);

        const map_grupales = {}
        if (Array.isArray(datos_chats_grupales)) {
            datos_chats_grupales.forEach(chat => {
                if (chat) map_grupales[chat.id || chat._id] = chat
            })
        }

        const lista_chats_ordenada = [...lista_chats].sort((a, b) => {
            return new Date(b.ultimoCambio) - new Date(a.ultimoCambio)
        })

        const lista_filtrada = filtro
            ? lista_chats_ordenada.filter(c => {
                const chatEx = map_grupales[c.id] || {}
                const nombre = chatEx.nombre || "Chat sin nombre"
                return nombre.toLowerCase().includes(filtro.toLowerCase())
            })
            : lista_chats_ordenada

        const html = lista_filtrada
            .map(c => {
                const chatEx = map_grupales[c.id] || {}
                const nombre = chatEx.nombre || "Chat sin nombre"
                const datos_usar = { id: c.id, ultimoCambio: c.ultimoCambio, usuarios: chatEx.usuarios || [], nombre: nombre, ultimomensaje: c.ultimomensaje, silenciado: c.silenciado || false, bloqueado: c.bloqueado || false }
                return chat_componente_lista_estructura_html(datos_usar)
            })
            .join("")

        document.getElementById("lista-chats-componentes").innerHTML = html
    }
    catch (e) {
        throw e
    }
}

let timer_spin;
export async function abrir_chat_item(id_chat, force = false) {
    if (!force && DOM_CACHE.nav_principal_chat_usuario?.dataset.id === id_chat) {
        scroll_fin_chat(true);
        return;
    }

    // Bloqueo para evitar cargar el mismo chat varias veces antes de que se abra
    if (!force && id_chat_cargando === id_chat) {
        return;
    }

    id_chat_cargando = id_chat;

    try {
        clearTimeout(timer_spin)
        document.querySelectorAll(".sync-spinner").forEach(el => el.remove())

        timer_spin = setTimeout(() => {
            DOM_CACHE.chat_usuario?.insertAdjacentHTML("afterbegin", "<div class='sync-spinner chat-spinner'></div>")
        }, 3000)

        const [datos_chat, id_usuario] = await Promise.all([
            Get_datos_chat_abrir(id_chat),
            ID_USUARIO_MONGO
        ])

        clearTimeout(timer_spin)
        document.querySelectorAll(".chat-spinner").forEach(el => el.remove())

        if (id_chat_cargando !== id_chat) {
            return;
        }

        if (!datos_chat) {
            window.pushNotificacion({ prioridad: 0, texto: "No se pudieron cargar los datos", tipo: "error" })
            return;
        }

        limpiar_archivos_mensaje()
        destruir_virtualizacion()
        
        const htmlChat = await Crear_chat_html(datos_chat, id_usuario);
        DOM_CACHE.chat_usuario.innerHTML = htmlChat;
        
        // Refrescar caché de elementos dinámicos después de inyectar el HTML
        DOM_CACHE.refrescar_elementos_chat();

        const textarea = DOM_CACHE.textarea_mensaje_escritura;
        if (textarea) {
            textarea.focus()
            manejar_input_escribiendo(textarea)
        }

        cerrar_paneles_al_abrir_chat()
        registrar_scroll_usuario()


        const chatContainer = DOM_CACHE.cuerpo_mensajes_chat;
        chatContainer?.addEventListener("click", (pulsado) => {
            pulsado.currentTarget.querySelector(".asunto-svg")?.addEventListener("click", (el) => {
                el.stopPropagation()
                navigator.clipboard.writeText(el.currentTarget.querySelector('svg').outerHTML);
            })

            // Selección de texto: activar solo en el mensaje clickado
            const mensajeClickado = pulsado.target.closest(".mensaje-chat");
            const anteriores = chatContainer.querySelectorAll(".mensaje-chat.texto-seleccionable");
            anteriores.forEach(m => {
                if (m !== mensajeClickado) m.classList.remove("texto-seleccionable");
            });
            if (mensajeClickado) {
                mensajeClickado.classList.add("texto-seleccionable");
            } else {
                // Click fuera de cualquier mensaje -> limpiar selección
                window.getSelection()?.removeAllRanges();
            }
        })

    } finally {
        if (id_chat_cargando === id_chat) {
            id_chat_cargando = null;
        }
    }
}

export async function mostrar_menu_contextual_lista_chats(e, id_chat) {
    document.querySelector(".context-menu-chat")?.remove()

    const lista_chats = await window.chats.OBTENER_CHATS_USUARIO()
    const chatInfo = lista_chats.find(c => (c.id || c._id) === id_chat)

    const texto_silenciar = chatInfo?.silenciado ? "Desilenciar" : "Silenciar"
    const texto_bloquear = chatInfo?.bloqueado ? "Desbloquear" : "Bloquear"

    const html = `
        <div class="context-menu context-menu-chat" style="position: fixed; z-index: 1000;">
            <div class="context-menu-item" data-action="silenciar">${texto_silenciar}</div>
            <div class="context-menu-item" data-action="bloquear">${texto_bloquear}</div>
        </div>
    `
    document.body.insertAdjacentHTML("beforeend", html)

    const menu = document.querySelector(".context-menu-chat")
    if (menu) {
        menu.style.left = e.clientX + "px"
        menu.style.top = e.clientY + "px"

        const cerrar = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", cerrar) } }
        setTimeout(() => document.addEventListener("mousedown", cerrar), 0)

        menu.addEventListener("click", async (ev) => {
            const action = ev.target.dataset.action
            if (action === "silenciar") {
                const res = await window.chats.SILENCIAR_CHAT(id_chat)
                if (res?.success) window.pushNotificacion({ prioridad: 1, texto: "Chat alterado", tipo: "success" })
            } else if (action === "bloquear") {
                const res = await window.chats.BLOQUEAR_CHAT(id_chat)
                if (res?.success) {
                    window.pushNotificacion({ prioridad: 1, texto: "Bloqueo alterado", tipo: "success" })
                    if (document.querySelector(`#nav-principal-chat-usuario${safeIdSelector(id_chat)}`)) await abrir_chat_item(id_chat, true)
                }
            }
            await ACTUALIZAR_LISTAS_CHAT()
            menu.remove()
        })
    }
}

export async function refrescar_componente_lista_chats(id_chat, componente, notificacion = false) {
    try {
        const id_chat_str = String(id_chat);
        const [info_chats, lista_usuario] = await Promise.all([
            window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: [{ id: id_chat_str }], grupales: null, mensajes: false }),
            window.chats.OBTENER_CHATS_USUARIO()
        ])

        const info_chat = info_chats?.[0]
        if (!info_chat) return

        const chat_usuario = lista_usuario.find(c => String(c.id || c._id) === id_chat_str)

        const datos_usar = {
            id: id_chat_str,
            ultimoCambio: chat_usuario?.ultimoCambio,
            usuarios: info_chat.usuarios,
            nombre: info_chat.nombre,
            ultimomensaje: chat_usuario?.ultimomensaje,
            silenciado: chat_usuario?.silenciado || false,
            bloqueado: chat_usuario?.bloqueado || false
        }

        const html_nuevo = chat_componente_lista_estructura_html(datos_usar)

        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = html_nuevo
        const contenido_nuevo = tempDiv.firstElementChild.innerHTML

        componente.innerHTML = contenido_nuevo

        const lista_contenedor = DOM_CACHE.lista_chats_componentes
        if (lista_contenedor && componente) {
            lista_contenedor.prepend(componente)
        }

        if (notificacion) {
            componente.classList.add("nuevo-mensaje-notificacion")
        }

    } catch (e) {
        console.error("Error al refrescar componente de chat:", e)
    }
}

// ─── RENDER DE MENSAJES EN TIEMPO REAL ────────────────────────────────────────

let cola_render = Promise.resolve();

export function Actualizar_render_chat(params) {
    if (params && params.chat) {
        invalidar_cache_virtualizacion(params.chat.toString());
    }
    // Precalcular datos ANTES de entrar en la cola (en paralelo con otros mensajes)
    const datos_promise = _preparar_datos_mensaje(params);
    cola_render = cola_render.then(async () => {
        const datos = await datos_promise;
        return _insertar_mensaje_dom(datos);
    });
    return cola_render;
}

async function _preparar_datos_mensaje({ emisor, chat, mensaje = "", archivos = [], fecha, id_mensaje = null }) {
    const id_chat_str = chat?.toString();
    const id_emisor = Array.isArray(emisor) ? emisor[0]?.toString() : emisor?.toString();

    const [nombres_contactos, id_propio] = await Promise.all([
        batchRequestCache.get('contactos', () => window.social_usuario.OBTENER_CONTACTOS_USUARIO(), 30000),
        batchRequestCache.get('id_propio', () => ID_USUARIO_MONGO, Infinity)
    ]);

    const propio = id_propio && id_emisor == id_propio.toString();

    const [info_chat, result_seguridad, nombre_emisor] = await Promise.all([
        batchRequestCache.get(`info_chat_${id_chat_str}`, async () => {
            const activo = await window.chats.OBTENER_CACHE_CHAT_ACTIVO(id_chat_str).catch(() => null);
            if (activo && (activo._id === id_chat_str || activo.id === id_chat_str)) return activo;
            return await window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat_str).catch(() => null);
        }, 10000),
        batchRequestCache.get(`config_seguridad_${id_chat_str}`,
            () => window.escaneres_seguridad_app.ESCANERES_SEGURIDAD_MENSAJE(id_chat_str),
            60000
        ),
        propio
            ? Promise.resolve("")
            : batchRequestCache.get(`nombre_${id_emisor}`,
                () => Encontrar_Nombre_Chat_Usuario({ id_buscar: id_emisor, grupal: false, contactos: nombres_contactos }),
                30000
            )
    ]);

    const esAdmin = info_chat?.usuarios?.length > 2 && info_chat?.admins?.some(a => a.toString() === id_emisor);
    const escaneres_seguridad = result_seguridad?.escaneres_seguridad || result_seguridad;

    const html = await crear_mensaje_html({
        fecha,
        asunto: mensaje,
        archivos,
        propio,
        nombre_emisor,
        esAdmin,
        escaneres_seguridad,
        tieneArriba: false, // se recalcula en _insertar_mensaje_dom
        tieneAbajo: false,
        id_emisor,
        id_mensaje
    });

    return { html, fecha, id_chat_str, id_emisor, id_mensaje, mensaje, escaneres_seguridad };
}

const _temp_msg_container = document.createElement("div");

async function _insertar_mensaje_dom({ html, fecha, id_chat_str, id_emisor, id_mensaje, mensaje, escaneres_seguridad }) {
    if (DOM_CACHE.nav_principal_chat_usuario?.dataset.id !== id_chat_str) return;

    const chatContainer = DOM_CACHE.cuerpo_mensajes_chat;
    if (!chatContainer) return;

    // Evitar duplicados
    if (id_mensaje && chatContainer.querySelector(`.mensaje-chat[data-id="${id_mensaje}"]`)) return;

    const lastBlock = chatContainer.lastElementChild; // .bloque-dia-chat
    const fechaActualText = texto_mostrar_fecha_mensajes_bloque(new Date(fecha));
    
    // Evitar leer innerHTML si podemos
    const esNuevoDia = !lastBlock || 
                      lastBlock.classList.contains('bloque-dia-chat') === false ||
                      lastBlock.querySelector(".fecha-bloque-mensajes span")?.textContent !== fechaActualText;

    // Reutilizar contenedor temporal para el parseo
    _temp_msg_container.innerHTML = html;
    const nuevoMensajeEl = _temp_msg_container.firstElementChild;

    if (esNuevoDia) {
        const nuevoBloque = document.createElement("div");
        nuevoBloque.className = "bloque-dia-chat";
        nuevoBloque.innerHTML = `<div class="fecha-bloque-mensajes"><span>${fechaActualText}</span></div>`;
        nuevoBloque.appendChild(nuevoMensajeEl);
        chatContainer.appendChild(nuevoBloque);
    } else {
        if (!HILOS_DESACTIVADOS) {
            const lastMessage = lastBlock.querySelector(".mensaje-chat:last-child");
            if (lastMessage?.dataset.emisorId === id_emisor) {
                lastMessage.classList.add("agrupado-abajo");
                nuevoMensajeEl.classList.add("agrupado-arriba");
            }
        }
        lastBlock.appendChild(nuevoMensajeEl);
    }

    // Usar requestIdleCallback o similar si es posible, o al menos no bloquear
    aplicar_escaneres_asincronos(nuevoMensajeEl, mensaje, escaneres_seguridad);
    scroll_fin_chat();
}

// ─── SCROLL ───────────────────────────────────────────────────────────────────

let _usuario_scrolleando = false;
let _timer_scroll_usuario = null;
const PORCENTAJE_UMBRAL_CARGA = 0.35; //% de la altura total del scroll para disparar carga

export function registrar_scroll_usuario() {
    const chatCuerpo = DOM_CACHE.cuerpo_mensajes_chat
    if (!chatCuerpo) return;

    const marcar = () => {
        _usuario_scrolleando = true;
        clearTimeout(_timer_scroll_usuario);
        _timer_scroll_usuario = setTimeout(() => {
            _usuario_scrolleando = false;
        }, 1500);
    };

    let rachaScroll = 0;
    let ultimoScrollTime = 0;
    let ultimaDireccion = 0;
    const max_rachaScroll = 8;//evitar que el numero aumenten indefinidamente
    chatCuerpo.addEventListener("wheel", (e) => {
        if (e.ctrlKey) return;

        const ahora = Date.now();
        const direccionActual = Math.sign(e.deltaY);

        // Detectar si es un scroll continuado en la misma dirección (intervalo de ms)
        if (ahora - ultimoScrollTime < 400 && direccionActual === ultimaDireccion) {
            if (rachaScroll < max_rachaScroll) rachaScroll++;
        } else {
            rachaScroll = 0;
        }

        ultimoScrollTime = ahora;
        ultimaDireccion = direccionActual;

        // aplicamos un boost del 10% (1.1)
        const boost = rachaScroll >= 8 ? 2 : rachaScroll >= 3 ? 1.2 : 1.0;
        //amortizacion del scroll->cuanto mas pequeño mas frena
        const factor = rachaScroll >= 8 ? 1.0 : rachaScroll >= 3 ? 0.5 : 0.4;

        let delta = e.deltaY;

        // Manejar diferentes modos de delta (0: pixels, 1: lines, 2: pages)
        if (e.deltaMode === 1) delta *= 33;
        else if (e.deltaMode === 2) delta *= chatCuerpo.clientHeight;

        chatCuerpo.scrollTop += delta * factor;

        if (e.cancelable) e.preventDefault();
        marcar();
    }, { passive: false });

    chatCuerpo.addEventListener("touchmove", marcar, { passive: true });

    // Detectar scroll para virtualización: cargar más mensajes al llegar a los bordes
    chatCuerpo.addEventListener("scroll", () => {
        const scrollTop = Math.ceil(chatCuerpo.scrollTop);
        const scrollHeight = chatCuerpo.scrollHeight;
        const clientHeight = chatCuerpo.clientHeight;

        // Detección visual de "arriba de todo" (independiente de la carga)
        const isAtTop = scrollTop <= 25;
        const navChat = DOM_CACHE.nav_principal_chat_usuario;
        if (navChat) {
            if (isAtTop) navChat.classList.add("at-top");
            else navChat.classList.remove("at-top");
        }

        const virt = obtener_estado_virtualizacion();
        if (!virt || virt.cargando) return;

        const umbralDinamico = scrollHeight * PORCENTAJE_UMBRAL_CARGA;

        // Scroll cerca del tope o en el tope absoluto → cargar mensajes más antiguos
        if ((scrollTop < umbralDinamico || isAtTop) && virt.hay_mas_arriba) {
            cargar_bloque_arriba();
        }

        // Scroll cerca del fondo → cargar mensajes más nuevos (si se reciclaron)
        const distanciaAlFondo = scrollHeight - scrollTop - clientHeight;
        if (distanciaAlFondo < umbralDinamico && virt.hay_mas_abajo) {
            cargar_bloque_abajo();
        }
    }, { passive: true });
}

let scrollTimeout = null;
export function scroll_fin_chat(forzar = false) {
    const chatCuerpo = DOM_CACHE.cuerpo_mensajes_chat
    if (!chatCuerpo) return;

    // Si el usuario está scrolleando manualmente NO bajamos automáticamente,
    // A MENOS que ya esté prácticamente al final (en cuyo caso mantenemos el scroll pegado al fondo)
    const estaAlFinal = (chatCuerpo.scrollHeight - Math.ceil(chatCuerpo.scrollTop) - chatCuerpo.clientHeight) < 50;

    if (!forzar && _usuario_scrolleando && !estaAlFinal) return;
    if (scrollTimeout) return;

    scrollTimeout = setTimeout(() => {
        chatCuerpo.scrollTo({
            top: chatCuerpo.scrollHeight,
            behavior: "smooth"
        });
        scrollTimeout = null;
    }, 150);
}

// ─── INICIO Y UTILIDADES ──────────────────────────────────────────────────────

export async function INICIO_CHAT_MENU_PRINCIPAL() {
    try {
        await ACTUALIZAR_LISTAS_CHAT()
    }
    catch (e) {
        throw e
    }
}

export async function cambiar_datos_componente_lista_chats({ id_chat, data, notificacion = false }) {
    const id_chat_str = String(id_chat);
    const componente_lista = document.querySelector(`#lista-chats-componentes ${safeIdSelector(id_chat_str)}`)
    
    if (componente_lista) {
        // Actualizar último mensaje si viene en la data
        const asunto = data?.asunto || data?.data?.asunto || (typeof data === 'string' ? data : "");
        if (asunto) {
            const elMsg = componente_lista.querySelector(".ultimo-mensaje-chat-lista span");
            if (elMsg) elMsg.innerHTML = escapeHTML(asunto);
        }

        // Actualizar fecha si viene
        const fecha = data?.fecha || data?.data?.data || data?.data;
        if (fecha) {
            const elFecha = componente_lista.querySelector(".fecha-chat-lista span");
            if (elFecha) elFecha.innerHTML = escapeHTML(formatear_fecha_chat_lista(fecha));
        }

        // Reordenar: mover al principio de la lista
        const lista_contenedor = DOM_CACHE.lista_chats_componentes;
        if (lista_contenedor) {
            // Solo movemos si no hay un filtro de búsqueda activo que pueda verse afectado
            // o si simplemente queremos que el más reciente esté arriba siempre.
            // Para Ravage, el comportamiento esperado es que suba al tope.
            lista_contenedor.prepend(componente_lista);
        }

        if (notificacion) {
            componente_lista.classList.add("nuevo-mensaje-notificacion")
        }
    }
}