import { desplegar_menu_añadir_chat } from './añadir_chats_usuarios.js'
import { ID_USUARIO_MONGO, APODO_USUARIO, CACHE_USUARIOS_ACTIVO, obtener_apodo_usuario } from '../caches_datos.js'
import { url_icono_extension_img } from './url_icono_extensiones_archivos.js'
import { scroll_fin_chat } from './gestor_chats.js'
import { safeIdSelector } from './seguridad_ui.js';

const nombre_defecto = "~no encontrado~"

// ─── CONFIGURACIÓN DE VIRTUALIZACIÓN Y RENDIMIENTO ──────────────────────────
const BLOQUE_MENSAJES = 20;           // Cantidad de mensajes por bloque de carga
const MAX_MENSAJES_DOM = BLOQUE_MENSAJES * 15;         // Máximo de mensajes permitidos en el DOM antes de reciclar
const MAX_BLOQUES_CACHE = 60;         // Cuántos bloques de paginación guardar en caché
const SCANNER_BATCH_SIZE = 10;        // Tamaño mínimo de lote para enviar escáneres al worker
const SCANNER_BATCH_INTERVAL = 80;    // Tiempo máximo de espera (ms) para completar un lote
const OPEN_CHAT_ANIMATION_OFFSET = 350; // Offset inicial para la animación de scroll al abrir chat


// ─── DEFINICIÓN DE ESCÁNERES DE SEGURIDAD ──────────────────────────────────
// Tipos: 
// - sync: Modifican el texto durante el renderizado.
// - async: Corren después del renderizado para añadir iconos/avisos.
const SCANNER_DEFINITIONS = {
    ESCANER_ZALGO: {
        id: "ESCANER_ZALGO",
        type: "sync",
        sync: async (text, level) => {
            if (level === 0) return { text, detected: false };
            const detected = await window.escaneres_seguridad_app.detectar_zalgo(text);
            if (detected) {
                if (level === 3) {
                    return { text: await window.escaneres_seguridad_app.eliminar_zalgo(text), detected: true };
                }
                return { text, detected: true };
            }
            return { text, detected: false };
        },
        render: () => `<img src="../recursos/seguridad/zalgo.svg" class="icono-seguridad" title="Zalgo detectado">`
    },
    ESCANER_ESTEGANOGRAFIA: {
        id: "ESCANER_ESTEGANOGRAFIA",
        type: "sync",
        sync: async (text, level) => {
            if (!level || level === 0) return { text, detected: false };
            const detected = await window.escaneres_seguridad_app.detectar_escenografia(text);
            if (detected) {
                if (level === 3) {
                    const result = await window.escaneres_seguridad_app.eliminar_escenografia(text);
                    return { text: result.text, detected: true };
                }
                // Nivel 1 u otros: Solo avisar
                return { text, detected: true };
            }
            return { text, detected: false };
        },
        render: () => `<img src="../recursos/seguridad/escudo.svg" class="icono-seguridad" title="Caracteres invisibles detectados (posible esteganografía)">`
    },
    ESCANER_URL_MALICIOSA: {
        id: "ESCANER_URL_MALICIOSA",
        type: "async",
        async_detect: (text) => window.escaneres_seguridad_app.detectar_url_maliciosa(text),
        render: () => `<img src="../recursos/seguridad/url_peligro.svg" class="icono-seguridad" title="URL potencialmente maliciosa detectada">`
    },
    ESCANER_XSS: {
        id: "ESCANER_XSS",
        type: "async",
        async_detect: (text) => window.escaneres_seguridad_app.detectar_xss(text),
        render: () => `<img src="../recursos/seguridad/xss.svg" class="icono-seguridad" title="Posible inyección de código detectada">`
    },
    ESCANER_CODIGO: {
        id: "ESCANER_CODIGO",
        type: "async",
        async_detect: (text) => window.escaneres_seguridad_app.detectar_codigo(text),
        render: () => `<img src="../recursos/seguridad/codigo.svg" class="icono-seguridad" title="Fragmento de código detectado">`
    },
    ESCANER_COMANDOS_TERMINAL: {
        id: "ESCANER_COMANDOS_TERMINAL",
        type: "async",
        async_detect: (text) => window.escaneres_seguridad_app.detectar_comandos_terminal(text),
        render: () => `<img src="../recursos/seguridad/terminal.svg" class="icono-seguridad" title="Comando de terminal peligroso detectado">`
    },
    ESCANER_CRYPTO_BILLETERAS: {
        id: "ESCANER_CRYPTO_BILLETERAS",
        type: "async",
        async_detect: (text) => window.escaneres_seguridad_app.detectar_crypto_billeteras(text),
        render: () => `<img src="../recursos/seguridad/crypto.svg" class="icono-seguridad" title="Dirección de criptomoneda detectada (posible estafa)">`
    },
    ESCANER_DIRECCIONES_IP: {
        id: "ESCANER_DIRECCIONES_IP",
        type: "async",
        async_detect: (text) => window.escaneres_seguridad_app.detectar_direcciones_ip(text),
        render: () => `<img src="../recursos/seguridad/ip.svg" class="icono-seguridad" title="Dirección IP detectada (posible riesgo de privacidad)">`
    },
    ESCANER_HOMOGLIFOS: {
        id: "ESCANER_HOMOGLIFOS",
        type: "async",
        async_detect: (text) => window.escaneres_seguridad_app.detectar_homoglifos(text),
        render: () => `<img src="../recursos/seguridad/homoglifo.svg" class="icono-seguridad" title="Caracteres homoglifos detectados (posible suplantación)">`
    }
};

/**
 * Aplica escáneres que modifican el texto antes de generar el HTML.
 */
async function aplicar_escaneres_sincronos(texto, escaneres_habilitados = {}) {
    let textoFinal = texto;
    const tagsDetectados = [];
    const habilitados = normalizar_escaneres(escaneres_habilitados);

    for (const [id, scanner] of Object.entries(SCANNER_DEFINITIONS)) {
        if (habilitados[id] && scanner.type === "sync") {
            const { text, detected } = await scanner.sync(textoFinal, habilitados[id]);
            textoFinal = text;
            if (detected) tagsDetectados.push(id);
        }
    }

    return { textoFinal, tagsDetectados };
}

let cola_escaneres_async = [];
let timer_escaneres_async = null;
let procesando = false;

const normalizar_escaneres = (escaneres) =>
    escaneres?.escaneres_seguridad || escaneres || {};

/**
 * Aplica escáneres post-renderizado para añadir iconos sin re-escanear si ya se detectó en sync.
 * Usa un sistema de cola para enviar en lotes al backend y reducir sobrecarga IPC.
 */
export async function aplicar_escaneres_asincronos(mensajeElement, texto, escaneres_habilitados = {}) {
    if (!mensajeElement) return;
    const id_mensaje = mensajeElement.dataset.id || Math.random().toString(36).substr(2, 9);

    if (_virt && id_mensaje) {
        if (_virt.mensajes_escaneados.has(id_mensaje)) {
            const cachedTags = _virt.cache_tags_asincronos[id_mensaje] || [];
            if (cachedTags.length > 0) {
                const tagsActuales = (mensajeElement.dataset.scannerTags || "").split(",").filter(Boolean);
                const tagsFaltantes = cachedTags.filter(t => !tagsActuales.includes(t));
                if (tagsFaltantes.length > 0) {
                    let contenedorIconos = mensajeElement.querySelector(".contenedor-iconos-seguridad");
                    if (!contenedorIconos) {
                        contenedorIconos = document.createElement("div");
                        contenedorIconos.className = "contenedor-iconos-seguridad";
                        mensajeElement.appendChild(contenedorIconos);
                    }
                    for (const t of tagsFaltantes) {
                        if (SCANNER_DEFINITIONS[t]?.render) {
                            contenedorIconos.insertAdjacentHTML("beforeend", SCANNER_DEFINITIONS[t].render());
                        }
                    }
                    mensajeElement.dataset.scannerTags = [...tagsActuales, ...tagsFaltantes].join(",");
                    mensajeElement.classList.add("amenaza-detectada");
                }
            }
            return;
        }
        _virt.mensajes_escaneados.add(id_mensaje);
    }

    const tagsStr = mensajeElement.dataset.scannerTags || "";
    const tagsYaDetectados = tagsStr ? tagsStr.split(",").filter(t => t) : [];
    const contenedorIconos = document.createElement("div");
    contenedorIconos.className = "contenedor-iconos-seguridad";

    let huboDeteccion = tagsYaDetectados.length > 0;

    for (const id of tagsYaDetectados) {
        if (SCANNER_DEFINITIONS[id]?.render) {
            contenedorIconos.insertAdjacentHTML("beforeend", SCANNER_DEFINITIONS[id].render());
        }
    }

    if (huboDeteccion) {
        mensajeElement.classList.add("amenaza-detectada");
        mensajeElement.appendChild(contenedorIconos);
    }

    cola_escaneres_async.push({
        id_mensaje,
        mensajeElement,
        texto,
        escaneres_habilitados: normalizar_escaneres(escaneres_habilitados),
        tagsYaDetectados,
        contenedorIconos,
        huboDeteccion
    });

    if (cola_escaneres_async.length >= SCANNER_BATCH_SIZE) {
        procesar_cola_escaneres_async();
    } else if (!timer_escaneres_async) {
        timer_escaneres_async = setTimeout(procesar_cola_escaneres_async, SCANNER_BATCH_INTERVAL);
    }
}

async function procesar_cola_escaneres_async() {
    if (procesando) return;
    procesando = true;

    clearTimeout(timer_escaneres_async);
    timer_escaneres_async = null;

    if (cola_escaneres_async.length === 0) {
        procesando = false;
        return;
    }

    const lote = [...cola_escaneres_async];
    cola_escaneres_async = [];

    const itemsParaLote = lote.map(item => ({
        id_mensaje: item.id_mensaje,
        texto: item.texto,
        escaneres_habilitados: item.escaneres_habilitados
    }));

    try {
        const resultadosLote = await window.escaneres_seguridad_app.detectar_lote(itemsParaLote);
        if (!resultadosLote) return;

        const mapaResultados = {};
        for (const res of resultadosLote) {
            if (res) mapaResultados[res.id_mensaje] = res.detecciones;
        }

        for (const item of lote) {
            const detecciones = mapaResultados[item.id_mensaje];
            if (!detecciones) continue;

            let detectadoNuevo = false;

            for (const [id, result] of Object.entries(detecciones)) {
                if (item.tagsYaDetectados.includes(id)) continue;

                const scanner = SCANNER_DEFINITIONS[id];
                if (!scanner || scanner.type !== "async") continue;

                const detectado = result && typeof result === "object"
                    ? !!(result.esMaliciosa || result.suspicious || result.detected)
                    : !!result;

                if (detectado) {
                    detectadoNuevo = true;
                    item.huboDeteccion = true;
                    item.tagsYaDetectados.push(id);

                    if (_virt) {
                        if (!_virt.cache_tags_asincronos[item.id_mensaje]) _virt.cache_tags_asincronos[item.id_mensaje] = [];
                        if (!_virt.cache_tags_asincronos[item.id_mensaje].includes(id)) {
                            _virt.cache_tags_asincronos[item.id_mensaje].push(id);
                        }
                    }

                    if (scanner.render && document.body.contains(item.mensajeElement)) {
                        item.contenedorIconos.insertAdjacentHTML("beforeend", scanner.render());
                    }
                }
            }

            if (detectadoNuevo && !item.mensajeElement.classList.contains("amenaza-detectada")) {
                item.mensajeElement.classList.add("amenaza-detectada");
                item.mensajeElement.appendChild(item.contenedorIconos);
            }
        }

    } catch (e) {
        console.error("Error procesando lote de escáneres:", e);
    } finally {
        procesando = false;

        // Si llegaron más items mientras procesábamos, lanzar otro ciclo
        if (cola_escaneres_async.length > 0) {
            procesar_cola_escaneres_async();
        }
    }
}
export const texto_mostrar_fecha_mensajes_bloque = (fecha_param) => {
    //evitar errores
    let fecha_param_usar;
    let fecha_param_usar_string;
    if (!fecha_param) return ""
    else {
        try {
            fecha_param_usar = new Date(fecha_param)
            fecha_param_usar_string = fecha_param_usar.toDateString()
        } catch (e) {
            return ""
        }
    }
    //mirar si es hoy
    if (fecha_param_usar_string === new Date().toDateString()) return "Hoy"
    //mirar si fue ayer
    else if (fecha_param_usar_string === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()) return "Ayer"
    //mirar si es de la misma semana
    else if (fecha_param_usar.getDay() === new Date().getDay() && (Date.now() - fecha_param_usar.getTime() < 7 * 24 * 60 * 60 * 1000)) return fecha_param_usar.toLocaleString("es-ES", {
        weekday: "long"
    })
    // mirar si es del mismo mes y año
    else if (fecha_param_usar.getMonth() === new Date().getMonth() && fecha_param_usar.getFullYear() === new Date().getFullYear()) {
        //devolver el dia del mes y nombre del dia de la semana
        return fecha_param_usar.toLocaleString("es-ES", {
            weekday: "long"
        }) + " " + fecha_param_usar.getDate() + ", " + fecha_param_usar.toLocaleString("es-ES", {
            month: "long"
        }) + " " + fecha_param_usar.getFullYear()
    }
    else return fecha_param_usar_string
}

export const chat_componente_lista_estructura_html = (datos_usar) => {
    //recuperar nombre del chat
    const nombre = (datos_usar) => { return escapeHTML(datos_usar?.nombre) || `Chat sin nombre` }

    //recuperar ultima vez
    const ultima_vez = (datos_usar) => {
        if (datos_usar.usuarios.length <= 2 && datos_usar.ultimoCambio) {

            const fecha = new Date(datos_usar.ultimoCambio);
            const ahora = new Date();

            const hora = fecha.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            });

            // 🔹 Normalizamos fechas a medianoche para comparar días
            const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
            const fechaComparar = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

            const diferenciaDias = (hoy - fechaComparar) / (1000 * 60 * 60 * 24);

            let resultado;

            if (diferenciaDias === 0) {
                resultado = `Hoy, ${hora}`;
            }
            else if (diferenciaDias === 1) {
                resultado = `Ayer, ${hora}`;
            }
            else {
                const dia = fecha.getDate();
                const mes = fecha.toLocaleString("es-ES", {
                    month: "short"
                }).replace(".", "");

                resultado = `${hora}, ${dia} ${mes}`;
            }

            return `<div class="fecha-chat-lista"><span>${resultado}</span></div>`;
        }
        else {
            return ``;
        }
    }
    //recuperar ultimo mensaje
    const ultimo_mensaje = (datos_usar) => {
        if (datos_usar.usuarios.length == 2 && datos_usar.ultimomensaje) return (`<div class="ultimo-mensaje-chat-lista"><span>${escapeHTML(datos_usar.ultimomensaje)}</span></div>`)
        else return ``
    }

    let html = `
    <div data-id="${datos_usar.id}" class="chat-componente-lista-chats">
        <div class="nombre-chat-lista-componente">
            <span class="nombre-texto">${nombre(datos_usar)}</span>
        </div>
        ${ultimo_mensaje(datos_usar)}
        ${ultima_vez(datos_usar)}
        <div class="iconos-estado-chat">
            ${datos_usar.bloqueado ? '<img src="../recursos/bloqueado.png" class="icono-estado-lista icono-bloqueado" title="Chat bloqueado">' : ''}
            ${datos_usar.silenciado ? '<img src="../recursos/silenciar.png" class="icono-estado-lista icono-silenciado" title="Chat silenciado">' : ''}
        </div>
    </div>`

    return html
}
/*
* @function: crear el html de un mensaje, las partes estan fuera y dentro de la funcion principal
 */

const escapeHTML = (str) => str.replace(/[&<>"'`]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;', '`': '&#96;'
})[c]);

const sanitizarSVG = (svg) =>
    DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } });

const sanitizarTexto = (texto) =>
    DOMPurify.sanitize(texto, {
        ALLOWED_TAGS: ['b', 'i', 'u', 's', 'em', 'strong', 'br', 'span'],
        ALLOWED_ATTR: ['class', 'data-url'],
        FORCE_BODY: true,
        RETURN_DOM_FRAGMENT: false,
        FORBID_ATTR: ['style', 'onerror', 'onload'],
    });

const parsearURLs = (texto) => {
    const urlRegex = /https?:\/\/[^\s<>"']+/g;
    return texto.replace(urlRegex, (url) =>
        `<span class="url-mensaje" data-url="${escapeHTML(url)}">${escapeHTML(url)}</span>`
    );
};
// Post-proceso para forzar seguridad en links
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
    }
});
const emisor_mensaje = (propio) =>
    propio ? "soy-emisor" : "soy-receptor";

export const crear_mensaje_html = async ({
    id_mensaje = null, fecha, asunto = "", archivos = [],
    propio = false, nombre_emisor, esAdmin = false,
    escaneres_seguridad = {}, tieneArriba = false,
    tieneAbajo = false, id_emisor = ""
}) => {

    //todo: añadir parse para urls (<span class="url">url</span>) y añadirle un evento con el previsualizador de urls
    const asunto_mensaje = (asunto) => {
        const partes = asunto.split(/(<(?:\w+:)?svg[\s\S]*?<\/(?:\w+:)?svg>)/gi);
        const asuntoFormateado = partes.map(parte =>
            /^<(?:\w+:)?svg/i.test(parte)
                ? `<div class="asunto-svg">${sanitizarSVG(parte)}</div>`
                : `<span>${sanitizarTexto(parsearURLs(parte))}</span>`
        ).join('');
        return asuntoFormateado
            ? `<div class="asunto-mensaje-chat">${asuntoFormateado}</div>`
            : '';
    };

    const nombre_emisor_mensaje = (nombre, propio, esAdmin, tieneArriba) => {
        if (propio) return '';
        return `<div class="nombre-mensaje-chat-usuario">
      <span>${escapeHTML(nombre)}${esAdmin
                ? " <span style='font-size:0.9em;opacity:0.7'>·Admin</span>"
                : ""
            }</span>
    </div>`;
    };

    const hora_mandado = (fecha) => {
        const hora = new Date(fecha).toLocaleTimeString("es-ES", {
            hour: "2-digit", minute: "2-digit", hour12: false
        });
        return `<div class="hora-mensaje-chat"><span>${hora}</span></div>`;
    };

    const archivos_mensaje = async (archivos) => {
        if (!archivos || archivos?.length === 0) return '';
        const html = ['<div class="mensaje-div-archivos">'];
        for (const archivo of archivos) {
            const extension = archivo?.extension
                ?? archivo?.nombre?.split('.')?.pop()
                ?? null;
            const [url, identificado] = await url_icono_extension_img(extension);
            const nombre_mostrar = identificado
                ? (archivo?.nombre?.includes('.')
                    ? archivo?.nombre?.substring(0, archivo?.nombre.lastIndexOf('.'))
                    : archivo?.nombre)
                : (archivo?.extension && !archivo?.nombre?.includes('.')
                    ? `${archivo?.nombre}.${archivo?.extension}`
                    : archivo?.nombre);
            const emisor_id = escapeHTML(archivo?.emisor_id || '');
            const ratchet_json = archivo?.ratchet_info
                ? encodeURIComponent(JSON.stringify(archivo?.ratchet_info))
                : '';
            html.push(`
        <div class="archivo-mensaje-div-archivos"
          data-id="${escapeHTML(String(archivo?.id || archivo?._id || ''))}"
          data-nombre="${escapeHTML(archivo?.nombre || '')}"
          data-iv="${escapeHTML(archivo?.iv || '')}"
          data-tag="${escapeHTML(archivo?.tag || '')}"
          data-emisor="${emisor_id}"
          data-ratchet="${ratchet_json}">
          <div><img src="${url}"><span>${escapeHTML(nombre_mostrar)}</span></div>
        </div>`);
        }
        html.push('</div>');
        return html.join('');
    };

    const { textoFinal, tagsDetectados } =
        await aplicar_escaneres_sincronos(asunto, escaneres_seguridad);

    return `
    <div class="mensaje-chat ${emisor_mensaje(propio)}
      ${tieneArriba ? 'agrupado-arriba' : ''}
      ${tieneAbajo ? 'agrupado-abajo' : ''}"
      data-id="${escapeHTML(String(id_mensaje || ''))}"
      data-scanner-tags="${escapeHTML(tagsDetectados.join(','))}"
      data-emisor-id="${escapeHTML(String(id_emisor))}"
      data-fecha="${escapeHTML(String(fecha))}">
      ${nombre_emisor_mensaje(nombre_emisor, propio, esAdmin, tieneArriba)}
      ${asunto_mensaje(textoFinal)}
      ${await archivos_mensaje(archivos)}
      ${hora_mandado(fecha)}
    </div>`;
};

let controller_renderizado_activo = null;

// ─── CACHE USUARIOS CHAT ACTIVO (RAM) ───────────────────────────────────────

let intervalo_reinicio_cache = null;
const MAX_ACTIVE_CACHE_MB = 100; // Límite de la caché activa

/**
 * Agrega un usuario a la caché activa controlando el tamaño máximo.
 */
async function agregar_a_cache_activo(id, data) {
    const ahora = Date.now();
    CACHE_USUARIOS_ACTIVO.set(id, { data, timestamp: ahora });

    let totalSize = 0;
    const items = Array.from(CACHE_USUARIOS_ACTIVO.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (const [key, entry] of items) {
        totalSize += JSON.stringify(entry.data).length * 2 / (1024 * 1024);
    }

    if (totalSize > MAX_ACTIVE_CACHE_MB) {
        const desplazados = [];
        for (const [key, entry] of items) {
            if (totalSize <= MAX_ACTIVE_CACHE_MB) break;
            desplazados.push(entry.data);
            CACHE_USUARIOS_ACTIVO.delete(key);
            totalSize -= (JSON.stringify(entry.data).length * 2 / (1024 * 1024));
        }
        if (desplazados.length > 0) {
            console.debug(`[Cache Activa] Overflow detectado (${totalSize.toFixed(2)}MB). Desplazando ${desplazados.length} usuarios al backend.`);
            await window.social_usuario.GUARDAR_VARIOS_DATOS_USUARIOS_EXTERNOS(desplazados);
        }
    }
}


export function iniciar_limpieza_cache_activo(num_participantes) {
    if (intervalo_reinicio_cache) clearInterval(intervalo_reinicio_cache);

    let tiempo_reinicio;
    if (num_participantes <= 5) tiempo_reinicio = 10 * 60 * 1000; // 10 min
    else if (num_participantes <= 20) tiempo_reinicio = 15 * 60 * 1000; // 15 min
    else tiempo_reinicio = 20 * 60 * 1000; // 20 min

    intervalo_reinicio_cache = setInterval(() => {
        const ahora = Date.now();
        for (const [id, entry] of CACHE_USUARIOS_ACTIVO.entries()) {
            // Borrar datos que tengan más de 3 minutos
            if (ahora - entry.timestamp > 3 * 60 * 1000) {
                CACHE_USUARIOS_ACTIVO.delete(id);
            }
        }
    }, tiempo_reinicio);
}

export async function limpiar_cache_activo(ids_nuevos = []) {
    if (intervalo_reinicio_cache) {
        clearInterval(intervalo_reinicio_cache);
        intervalo_reinicio_cache = null;
    }

    const a_persistente = [];
    const ids_nuevos_set = new Set(ids_nuevos.map(id => id.toString()));

    for (const [id, entry] of CACHE_USUARIOS_ACTIVO.entries()) {
        if (!ids_nuevos_set.has(id)) {
            // Si no está en el nuevo chat, lo mandamos al backend para ahorrar RAM aquí
            a_persistente.push(entry.data);
            CACHE_USUARIOS_ACTIVO.delete(id);
        }
    }

    if (a_persistente.length > 0) {
        console.debug(`[Cache Activa] Cambio de chat: moviendo ${a_persistente.length} usuarios a caché persistente.`);
        // Enviar al backend para que vivan en la RAM persistente de sesión
        await window.social_usuario.GUARDAR_VARIOS_DATOS_USUARIOS_EXTERNOS(a_persistente);
    }
}

// ─── VIRTUALIZACIÓN DE MENSAJES ──────────────────────────────────────────────

let _virt = null;

export function obtener_estado_virtualizacion() {
    return _virt;
}

export function destruir_virtualizacion() {
    _virt = null;
}

function _agrupar_por_dia(mensajes) {
    const grupos = [];
    let current_dia = null;
    mensajes.forEach(m => {
        const dateStr = new Date(m.data).toDateString();
        if (dateStr !== current_dia) {
            grupos.push({ fecha: m.data, mensajes: [] });
            current_dia = dateStr;
        }
        grupos[grupos.length - 1].mensajes.push(m);
    });
    return grupos;
}


function _calcular_agrupacion(mensajes) {
    return mensajes.map((m, index) => {
        const id_emisor = m.emisor;
        const prevMsg = index > 0 ? mensajes[index - 1] : null;
        const tieneArriba = id_emisor === (prevMsg ? prevMsg.emisor : null);
        const nextMsg = index < mensajes.length - 1 ? mensajes[index + 1] : null;
        const tieneAbajo = id_emisor === (nextMsg ? nextMsg.emisor : null);
        return { ...m, id_emisor, tieneArriba, tieneAbajo };
    });
}

async function _construir_html_mensajes(mensajesConEstado, opciones) {
    const { map_nombres, escaneres_seguridad, id_propio, datos_chat } = opciones;
    const SuperaMin = datos_chat.usuarios?.length > 2;
    if (!datos_chat.admins) datos_chat.admins = [];

    return Promise.all(mensajesConEstado.map(async (m) => {
        if (!m) return "";
        const id_emisor = m.id_emisor || undefined;
        if (!id_emisor) return "";
        const propio = id_emisor === id_propio;
        const esAdmin = SuperaMin && datos_chat.admins.includes(id_emisor);
        const nombre = map_nombres[id_emisor] || nombre_defecto;
        return crear_mensaje_html({
            fecha: m.data, asunto: m.contenido[0]?.asunto || "",
            archivos: m.contenido[0]?.archivos || [], propio,
            nombre_emisor: nombre, esAdmin, escaneres_seguridad,
            tieneArriba: m.tieneArriba, tieneAbajo: m.tieneAbajo,
            id_emisor
        });
    }));
}

async function _resolver_nombres(mensajes, contactos) {
    const uniqueIds = [...new Set(mensajes.map(m => {
        const emisor = Array.isArray(m.emisor) ? m.emisor[0] : m.emisor;
        return emisor ? emisor.toString() : null;
    }).filter(Boolean))];

    const missingIds = [];
    const data_usuarios = [];
    const ahora = Date.now();

    // 1º Revisar en la caché activa de RAM
    for (const id of uniqueIds) {
        if (CACHE_USUARIOS_ACTIVO.has(id)) {
            data_usuarios.push(CACHE_USUARIOS_ACTIVO.get(id).data);
        } else {
            missingIds.push(id);
        }
    }

    // 2º Si faltan, pedirlos al backend (el backend mirará su propia caché persistente)
    if (missingIds.length > 0) {
        console.debug(`[Lazy Load] Pidiendo ${missingIds.length} usuarios al backend.`);
        const fetched = await window.social_usuario.OBTENER_VARIOS_DATOS_USUARIOS_EXTERNOS(missingIds);
        for (const u of fetched) {
            const id = u.id || u._id?.toString();
            await agregar_a_cache_activo(id, u);
            data_usuarios.push(u);
        }
    }

    const map_contactos = Object.fromEntries(contactos.map(c => [c.id, c.apodo]));
    return Object.fromEntries(data_usuarios.map(u => {
        const id = u.id || u._id?.toString();
        const apodo_contacto = map_contactos[id];
        const apodo_global = u.apodo;
        
        if (apodo_contacto) return [id, apodo_contacto];
        if (apodo_global) return [id, "~" + apodo_global];
        return [id, nombre_defecto];
    }));
}
// Nueva función que sustituye a _rearmar_agrupacion_dom() en inserciones
async function _rearmar_agrupacion_dom() {
    const chatContainer = document.getElementById("cuerpo-mensajes-chat");
    if (!chatContainer) return;

    const todos = chatContainer.querySelectorAll(".mensaje-chat");
    const len = todos.length;

    for (let i = 0; i < len; i++) {
        const actual = todos[i];
        const emisorActual = actual.getAttribute('data-emisor-id');

        const prev = i > 0 ? todos[i - 1] : null;
        const next = i < len - 1 ? todos[i + 1] : null;

        const mismoDiaArriba = prev && actual.closest('.bloque-dia-chat') === prev.closest('.bloque-dia-chat');
        const mismoDiaAbajo = next && actual.closest('.bloque-dia-chat') === next.closest('.bloque-dia-chat');

        actual.classList.toggle('agrupado-arriba',
            mismoDiaArriba && emisorActual === prev.getAttribute('data-emisor-id'));
        actual.classList.toggle('agrupado-abajo',
            mismoDiaAbajo && emisorActual === next.getAttribute('data-emisor-id'));
    }
}
/**
 * Renderiza un bloque de mensajes en el DOM, pudiendo prepend (arriba) o append (abajo).
 * Fusiona bloques de día cuando la fecha coincide con el bloque adyacente existente.
 */
async function _renderizar_bloque_en_dom(mensajes, opciones) {
    const { map_nombres, escaneres_seguridad, id_propio, datos_chat, posicion } = opciones;
    const chatContainer = document.getElementById("cuerpo-mensajes-chat");
    if (!chatContainer || mensajes.length === 0) return;

    const grupos = _agrupar_por_dia(mensajes);
    const esPrepend = posicion === 'prepend';
    let scrollHeightAntes = 0, scrollTopAntes = 0;

    if (esPrepend) {
        scrollHeightAntes = chatContainer.scrollHeight;
        scrollTopAntes = chatContainer.scrollTop;
    }

    // FIX 1: construir todo el HTML en paralelo antes de tocar el DOM
    const htmlPorGrupo = await Promise.all(grupos.map(async grupo => {
        const fechaTexto = texto_mostrar_fecha_mensajes_bloque(new Date(grupo.fecha));
        const mensajesConEstado = _calcular_agrupacion(grupo.mensajes);
        const html_arr = await _construir_html_mensajes(mensajesConEstado, { map_nombres, escaneres_seguridad, id_propio, datos_chat });
        return { fechaTexto, html_mensajes: html_arr.join('') };
    }));

    const iteracion = esPrepend ? [...htmlPorGrupo].reverse() : htmlPorGrupo;

    // FIX 2: el for solo toca el DOM, sin awaits, y recoge referencias a nodos nuevos
    const nodosNuevos = [];

    for (const { fechaTexto, html_mensajes } of iteracion) {
        const bloqueAdyacente = esPrepend
            ? chatContainer.querySelector(".bloque-dia-chat:first-child")
            : chatContainer.querySelector(".bloque-dia-chat:last-child");
        const fechaAdyacente = bloqueAdyacente?.querySelector(".fecha-bloque-mensajes span")?.textContent;

        if (bloqueAdyacente && fechaTexto === fechaAdyacente) {
            if (esPrepend) {
                bloqueAdyacente.querySelector(".fecha-bloque-mensajes").insertAdjacentHTML("afterend", html_mensajes);
            } else {
                bloqueAdyacente.insertAdjacentHTML("beforeend", html_mensajes);
            }
            bloqueAdyacente.querySelectorAll(".mensaje-chat:not(.scanned)").forEach(n => nodosNuevos.push(n));
        } else {
            const html_dia = `<div class="bloque-dia-chat">
                <div class="fecha-bloque-mensajes"><span>${fechaTexto}</span></div>
                ${html_mensajes}
            </div>`;
            chatContainer.insertAdjacentHTML(esPrepend ? "afterbegin" : "beforeend", html_dia);
            const bloqueNuevo = esPrepend
                ? chatContainer.querySelector(".bloque-dia-chat:first-child")
                : chatContainer.querySelector(".bloque-dia-chat:last-child");
            bloqueNuevo?.querySelectorAll(".mensaje-chat:not(.scanned)").forEach(n => nodosNuevos.push(n));
        }
    }

    if (esPrepend) {
        chatContainer.scrollTop = scrollTopAntes + (chatContainer.scrollHeight - scrollHeightAntes);
    }

    // FIX 3: rearmar solo el borde en lugar de todos los mensajes
    _rearmar_agrupacion_dom();

    // FIX 2: escanear solo los nodos nuevos, no todo el DOM
    await new Promise(r => setTimeout(r, 0));
    for (const msgEl of nodosNuevos) {
        msgEl.classList.add("scanned");
        const txt = msgEl.querySelector(".asunto-mensaje-chat")?.textContent || "";
        aplicar_escaneres_asincronos(msgEl, txt, escaneres_seguridad);
    }
}


/**
 * Recicla (elimina) mensajes del extremo opuesto al scroll cuando el DOM supera MAX_MENSAJES_DOM.
 * @param {'arriba'|'abajo'} extremo - Qué extremo reciclar
 */
function _reciclar_mensajes(extremo) {
    const chatContainer = document.getElementById("cuerpo-mensajes-chat");
    if (!chatContainer) return;

    const todos = chatContainer.querySelectorAll(".mensaje-chat");
    if (todos.length <= MAX_MENSAJES_DOM) return;

    const exceso = todos.length - MAX_MENSAJES_DOM;
    if (exceso <= 0) return;

    if (extremo === 'abajo') {
        // Eliminar los mensajes más nuevos (del final)
        const scrollHeightAntes = chatContainer.scrollHeight;
        const scrollTopAntes = chatContainer.scrollTop;

        for (let i = todos.length - 1; i >= todos.length - exceso; i--) {
            todos[i].remove();
        }
        // Limpiar bloques de día vacíos
        chatContainer.querySelectorAll(".bloque-dia-chat").forEach(b => {
            if (!b.querySelector(".mensaje-chat")) b.remove();
        });

        // Actualizar cursor de id más nueva
        const nuevosTodos = chatContainer.querySelectorAll(".mensaje-chat");
        if (nuevosTodos.length > 0 && _virt) {
            _virt._id_mas_nuevo = nuevosTodos[nuevosTodos.length - 1].getAttribute("data-id");
        }

        if (_virt) _virt.hay_mas_abajo = true;
        _rearmar_agrupacion_dom();
    } else {
        // Eliminar los mensajes más antiguos (del inicio)
        const scrollHeightAntes = chatContainer.scrollHeight;
        const scrollTopAntes = chatContainer.scrollTop;

        for (let i = 0; i < exceso; i++) {
            todos[i].remove();
        }
        chatContainer.querySelectorAll(".bloque-dia-chat").forEach(b => {
            if (!b.querySelector(".mensaje-chat")) b.remove();
        });

        // Actualizar cursor de id más antigua
        const nuevosTodos = chatContainer.querySelectorAll(".mensaje-chat");
        if (nuevosTodos.length > 0 && _virt) {
            _virt._id_mas_antiguo = nuevosTodos[0].getAttribute("data-id");
        }

        // Ajustar scroll
        chatContainer.scrollTop = scrollTopAntes - (scrollHeightAntes - chatContainer.scrollHeight);

        if (_virt) _virt.hay_mas_arriba = true;
        _rearmar_agrupacion_dom();
    }
}

/**
 * Carga un bloque de mensajes más antiguos (scroll hacia arriba).
 */
export async function cargar_bloque_arriba() {
    if (!_virt || _virt.cargando || !_virt.hay_mas_arriba) return;
    _virt.cargando = true;
    const navChat = document.getElementById("nav-principal-chat-usuario");
    if (navChat) navChat.classList.add("loading-messages");
    try {
        const chatContainer = document.getElementById("cuerpo-mensajes-chat");
        if (!chatContainer) return;
        const primerMsg = chatContainer.querySelector(".mensaje-chat");
        if (!primerMsg) return;

        // Obtener ID del mensaje más antiguo visible para usar como cursor
        const idCursor = _virt._id_mas_antiguo;
        const cacheKey = `${idCursor}_older`;

        let result = _virt.cache_paginacion[cacheKey];
        if (!result) {
            result = await window.chats.OBTENER_MENSAJES_PAGINADOS(
                _virt.id_chat, BLOQUE_MENSAJES, idCursor, 'older'
            );
            if (result && result.mensajes.length > 0) {
                _virt.cache_paginacion[cacheKey] = result;
                const keys = Object.keys(_virt.cache_paginacion);
                if (keys.length > MAX_BLOQUES_CACHE) delete _virt.cache_paginacion[keys[0]];
            }
        }

        if (!result || result.mensajes.length === 0) {
            _virt.hay_mas_arriba = false;
            return;
        }

        // Resolver nombres de emisores nuevos
        const idsNuevos = [...new Set(result.mensajes.map(m => (Array.isArray(m.emisor) ? m.emisor[0] : m.emisor)?.toString()).filter(Boolean))];
        const idsDesconocidos = idsNuevos.filter(id => !_virt.map_nombres[id]);

        if (idsDesconocidos.length > 0) {
            const missingIds = [];
            const ahora = Date.now();

            for (const id of idsDesconocidos) {
                if (CACHE_USUARIOS_ACTIVO.has(id)) {
                    const u = CACHE_USUARIOS_ACTIVO.get(id).data;
                    _virt.map_nombres[id] = u.apodo || nombre_defecto;
                } else {
                    missingIds.push(id);
                }
            }

            if (missingIds.length > 0) {
                const datos = await window.social_usuario.OBTENER_VARIOS_DATOS_USUARIOS_EXTERNOS(missingIds);
                for (const u of datos) {
                    const id = u.id || u._id?.toString();
                    await agregar_a_cache_activo(id, u);
                    _virt.map_nombres[id] = u.apodo || nombre_defecto;
                }
            }
        }

        await _renderizar_bloque_en_dom(result.mensajes, {
            map_nombres: _virt.map_nombres,
            escaneres_seguridad: _virt.escaneres_seguridad,
            id_propio: _virt.id_propio,
            datos_chat: _virt.datos_chat,
            posicion: 'prepend'
        });

        _virt._id_mas_antiguo = result.mensajes[0]?._id || result.mensajes[0]?.id;
        _virt.hay_mas_arriba = result.hay_mas;

        // Reciclar mensajes del extremo inferior si hay demasiados en DOM
        _reciclar_mensajes('abajo');
    } finally {
        _virt.cargando = false;
        const navChat = document.getElementById("nav-principal-chat-usuario");
        if (navChat) navChat.classList.remove("loading-messages");
    }
}

/**
 * Carga un bloque de mensajes más nuevos (scroll hacia abajo, tras reciclaje).
 */
export async function cargar_bloque_abajo() {
    if (!_virt || _virt.cargando || !_virt.hay_mas_abajo) return;
    _virt.cargando = true;
    try {
        const chatContainer = document.getElementById("cuerpo-mensajes-chat");
        if (!chatContainer) return;
        const msgs = chatContainer.querySelectorAll(".mensaje-chat");
        if (msgs.length === 0) return;

        const idCursor = _virt._id_mas_nuevo;
        const cacheKey = `${idCursor}_newer`;

        let result = _virt.cache_paginacion[cacheKey];
        if (!result) {
            result = await window.chats.OBTENER_MENSAJES_PAGINADOS(
                _virt.id_chat, BLOQUE_MENSAJES, idCursor, 'newer'
            );
            if (result && result.mensajes.length > 0) {
                _virt.cache_paginacion[cacheKey] = result;
                const keys = Object.keys(_virt.cache_paginacion);
                if (keys.length > MAX_BLOQUES_CACHE) delete _virt.cache_paginacion[keys[0]];
            }
        }

        if (!result || result.mensajes.length === 0) {
            _virt.hay_mas_abajo = false;
            return;
        }

        const idsNuevos = [...new Set(result.mensajes.map(m => (Array.isArray(m.emisor) ? m.emisor[0] : m.emisor)?.toString()).filter(Boolean))];
        const idsDesconocidos = idsNuevos.filter(id => !_virt.map_nombres[id]);
        if (idsDesconocidos.length > 0) {
            const missingIds = [];
            const ahora = Date.now();

            for (const id of idsDesconocidos) {
                if (CACHE_USUARIOS_ACTIVO.has(id)) {
                    const u = CACHE_USUARIOS_ACTIVO.get(id).data;
                    _virt.map_nombres[id] = u.apodo || nombre_defecto;
                } else {
                    missingIds.push(id);
                }
            }

            if (missingIds.length > 0) {
                const datos = await window.social_usuario.OBTENER_VARIOS_DATOS_USUARIOS_EXTERNOS(missingIds);
                for (const u of datos) {
                    const id = u.id || u._id?.toString();
                    await agregar_a_cache_activo(id, u);
                    _virt.map_nombres[id] = u.apodo || nombre_defecto;
                }
            }
        }

        await _renderizar_bloque_en_dom(result.mensajes, {
            map_nombres: _virt.map_nombres,
            escaneres_seguridad: _virt.escaneres_seguridad,
            id_propio: _virt.id_propio,
            datos_chat: _virt.datos_chat,
            posicion: 'append'
        });

        const lastMsg = result.mensajes[result.mensajes.length - 1];
        _virt._id_mas_nuevo = lastMsg?._id || lastMsg?.id;
        _virt.hay_mas_abajo = result.hay_mas;

        // Reciclar mensajes del extremo superior si hay demasiados en DOM
        _reciclar_mensajes('arriba');
    } finally {
        _virt.cargando = false;
    }
}

async function renderizar_chat_progresivo_plano(datos, id_propio, contactos) {
    if (!datos) return;
    try {
        if (controller_renderizado_activo) {
            controller_renderizado_activo.abort = true;
        }
        const controller = { abort: false };
        controller_renderizado_activo = controller;

        // Limpiar colas de escáneres al cambiar de chat
        cola_escaneres_async = [];
        if (timer_escaneres_async) {
            clearTimeout(timer_escaneres_async);
            timer_escaneres_async = null;
        }
        procesando = false;

        if (!_virt || _virt.id_chat !== datos._id) {
            // Identificar IDs del nuevo chat para saber qué conservar en RAM activa
            const ids_nuevos = (datos.usuarios || []).map(u => (u.id || u._id || u).toString());
            await limpiar_cache_activo(ids_nuevos);
            iniciar_limpieza_cache_activo(ids_nuevos.length || 2);
        }

        const chatContainer = document.getElementById("cuerpo-mensajes-chat");
        if (!chatContainer) return;

        let mensajes = (datos.mensajes || []).filter(m => m && typeof m === 'object');
        let initial_paginacion_hay_mas = null;

        if (mensajes.length === 0) {
            console.debug(`[Virtualización] No hay mensajes iniciales en datos. Pidiendo primer bloque al backend.`);
            const result = await window.chats.OBTENER_MENSAJES_PAGINADOS(datos._id, BLOQUE_MENSAJES, null, 'older');
            if (result && result.mensajes) {
                mensajes = result.mensajes;
                initial_paginacion_hay_mas = result.hay_mas;
                // Actualizar datos.mensajes para que el resto de la función siga igual
                datos.mensajes = mensajes;
            }
        }

        if (mensajes.length === 0) {
            // Inicializar virtualización vacía igualmente
            _virt = {
                id_chat: datos._id, datos_chat: datos, id_propio,
                map_nombres: {}, escaneres_seguridad: {},
                hay_mas_arriba: false, hay_mas_abajo: false, cargando: false,
                _id_mas_antiguo: null, _id_mas_nuevo: null,
                cache_paginacion: {},
                mensajes_escaneados: new Set(),
                cache_tags_asincronos: {}
            };
            return;
        }

        if (controller.abort) return;

        const [map_nombres, escaneres_seguridad] = await Promise.all([
            _resolver_nombres(mensajes, contactos),
            window.escaneres_seguridad_app.ESCANERES_SEGURIDAD_MENSAJE(datos._id)
        ]);

        if (controller.abort) return;

        let initial_hay_mas = mensajes.length >= BLOQUE_MENSAJES;
        // Si los pedimos por paginación, el backend ya nos dijo si hay más
        if (typeof initial_paginacion_hay_mas === 'boolean') {
            initial_hay_mas = initial_paginacion_hay_mas;
        }

        // Inicializar estado de virtualización
        _virt = {
            id_chat: datos._id,
            datos_chat: datos,
            id_propio,
            map_nombres,
            escaneres_seguridad,
            hay_mas_arriba: initial_hay_mas,
            hay_mas_abajo: false,
            cargando: false,
            _id_mas_antiguo: mensajes[0]?._id || mensajes[0]?.id,
            _id_mas_nuevo: mensajes[mensajes.length - 1]?._id || mensajes[mensajes.length - 1]?.id,
            cache_paginacion: {},
            mensajes_escaneados: new Set(),
            cache_tags_asincronos: {}
        };

        // Renderizar bloque inicial
        await _renderizar_bloque_en_dom(mensajes, {
            map_nombres, escaneres_seguridad, id_propio,
            datos_chat: datos, posicion: 'append'
        });

        // Asegurar scroll al fondo al abrir con una leve animación
        chatContainer.style.overflowAnchor = "none";

        if (chatContainer.scrollHeight > chatContainer.clientHeight) {
            // Empezar unos píxeles arriba para que la animación de caída sea visible
            chatContainer.scrollTop = Math.max(0, chatContainer.scrollHeight - chatContainer.clientHeight - OPEN_CHAT_ANIMATION_OFFSET);

            setTimeout(() => {
                chatContainer.scrollTo({
                    top: chatContainer.scrollHeight,
                    behavior: 'smooth'
                });
                chatContainer.style.overflowAnchor = "auto";
            }, 30);
        } else {
            chatContainer.scrollTop = chatContainer.scrollHeight;
            chatContainer.style.overflowAnchor = "auto";
        }
    } catch (e) {
        console.error("Error crítico en renderizar_chat_progresivo_plano:", e);
    }
}

export async function Encontrar_Nombre_Chat_Usuario({ id_buscar, grupal = true, contactos = null }) {
    //si grupal: false->es un usuario, true->puede ser un chat grupal
    if (grupal) {
        //buscar en tabla general de chats
        let chat_grupal = await window.cache_persistente.getChatCache(id_buscar)
        if (!chat_grupal) {
            chat_grupal = await window.chats.OBTENER_CACHE_CHAT_ACTIVO(id_buscar)
        }
        if (!chat_grupal) {
            chat_grupal = await window.chats.OBTENER_DATOS_CHAT_UNICO(id_buscar, "nombre")
        }
        if (chat_grupal?.nombre) return chat_grupal.nombre
        //como no existe, puede ser un usuario
    }

    //1ºbuscar en contactos apodo, 2º buscar en usuarios su nombre
    //se puede enviar contactos ya directamente si se tiene, para reducir llamadas a ipc al buscar el nombre de todos los usuarios del chat
    const nombres_contactos = contactos || await window.social_usuario.OBTENER_CONTACTOS_USUARIO()
    const indice_contacto = nombres_contactos.findIndex(x => x.id == id_buscar)

    if (indice_contacto === -1) {
        // Si no es contacto, intentamos obtener su apodo externo
        const data_externo = await window.social_usuario.OBTENER_DATOS_USUARIO_EXTERNO(id_buscar, "apodo")
        const apodo = data_externo?.apodo;
        return apodo ? "~" + apodo : nombre_defecto
    }
    else return nombres_contactos[indice_contacto].apodo
}

export async function Crear_chat_html(datos, id_propio) {

    const [nombre_chat, contactos] = await Promise.all([
        Encontrar_Nombre_Chat_Usuario({ id_buscar: datos?._id, grupal: true }),
        window.social_usuario.OBTENER_CONTACTOS_USUARIO()
    ])

    // Iniciar renderizado progresivo en segundo plano
    setTimeout(() => {
        renderizar_chat_progresivo_plano(datos, id_propio, contactos);
    }, 0);

    return `
    <div id="nav-principal-chat-usuario" data-id="${datos?._id}">
        <div id="nombre-chat-nav"><span>${nombre_chat}</span></div>
    </div>
    
    <div id="cuerpo-mensajes-chat">

    </div>

    <div class="seccion-escritura-mensaje-chat" ${datos.bloqueado ? 'style="background: rgba(255,0,0,0.05);"' : ''}>
        <div id="bt-añadir-archivo-mensaje-escritura" ${datos.bloqueado ? 'style="display:none;"' : ''}>        
            <img src="../recursos/carpeta.svg" alt="" draggable="false">
        </div>
        <textarea id="textarea-mensaje-escritura" 
            placeholder="${datos.bloqueado ? 'Este chat está bloqueado' : 'Escribe un mensaje'}" 
            maxlength="1000" 
            ${datos.bloqueado ? 'disabled style="cursor: not-allowed; opacity: 0.7;"' : ''}></textarea>
    </div>
`
}

// Helper para normalizar IDs que vienen del IPC (pueden ser strings o buffers serializados)
const normalizeIdHelper = (id) => {
    if (!id) return id;
    if (typeof id === 'string' && id !== "[object Object]") return id;
    if (id && typeof id === 'object') {
        if (id.buffer && typeof id.buffer === 'object') {
            const vals = Object.values(id.buffer);
            if (vals.length === 12) return vals.map(b => b.toString(16).padStart(2, '0')).join('');
        }
        if (id._id) return normalizeIdHelper(id._id);
        if (id.id) return normalizeIdHelper(id.id);
        // Caso de objeto con llaves '0'...'11' directamente
        if (id['0'] !== undefined && id['11'] !== undefined) {
            const vals = Object.values(id);
            if (vals.length === 12) return vals.map(b => b.toString(16).padStart(2, '0')).join('');
        }
    }
    return id.toString();
}

export async function mostrar_datos_chat_usuarios(e) {
    e.preventDefault()
    // MOSTRAR DATOS DEL USUARIO Y DEL CHAT
    const id_chat = e.currentTarget.dataset.id || document.querySelector("#nav-principal-chat-usuario")?.dataset.id
    if (!id_chat) return;

    const [cache_persistente, cache_activo] = await Promise.all([
        window.cache_persistente.getChatCache(id_chat),
        window.chats.OBTENER_CACHE_CHAT_ACTIVO(id_chat)
    ])

    // Combinar cachespriorizando el activo para datos más frescos
    let info_chat = { ...(cache_persistente || {}), ...(cache_activo || {}) }

    // Campos necesarios para la vista de info
    const campos_necesarios = ["usuarios", "admins", "fecha_creacion", "nmensajes"]
    const faltantes = campos_necesarios.filter(f => info_chat[f] === undefined)

    // Si no tenemos n_mensajes ni el array de mensajes, pedirlo
    if (info_chat.nmensajes === undefined && (!info_chat.mensajes || info_chat.mensajes.length === 0)) {
        faltantes.push("mensajes")
    }

    if (faltantes.length > 0) {
        const datos_extra = await window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat, faltantes.join(" "))
        info_chat = { ...info_chat, ...datos_extra }
    }

    if (info_chat) {
        // Asegurar que el cache activo tenga la última versión de los datos críticos
        window.chats.GUARDAR_CACHE_CHAT_ACTIVO({
            ...info_chat,
            seguridad: info_chat.seguridad || info_chat.escaneres_seguridad,
            nmensajes: info_chat.nmensajes ?? 0
        })
    }

    const id_mio = ID_USUARIO_MONGO
    const soyAdmin = info_chat?.admins?.includes(id_mio) || false

    // Pre-obtener silenciados y bloqueados
    const [silenciados, bloqueados] = await Promise.all([
        window.social_usuario.OBTENER_USUARIOS_SILENCIADOS(),
        window.social_usuario.OBTENER_USUARIOS_BLOQUEADOS()
    ])
    const ids_silenciados = (silenciados || []).map(u => typeof u === "string" ? u : u.id || u._id || u);
    const ids_bloqueados = (bloqueados || []).map(u => typeof u === "string" ? u : u.id || u._id || u);

    const infoSeccion = document.getElementById("info-chat-seccion")

    //crear html de la seccion
    const nombre_chat = document.querySelector("#nombre-chat-nav span")?.textContent || nombre_defecto
    const integrantes_chat = () => {
        return `<div> ${[...new Set(info_chat?.usuarios)]?.length || 0} integrantes</div> `
    }

    const fecha_final = info_chat?.fecha_creacion || info_chat?.createdAt;
    const fecha_formateada = fecha_final
        ? new Date(fecha_final).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : "*No disponible";

    let html = `
    <div class="info-chat-contenedor-fijo">
        <div class="info-chat-header">
            <div id="bt-cerrar-info-chat">
                <img src="../recursos/cruz.png" alt="cerrar">
            </div>
            <span>Información del chat</span>
            ${soyAdmin ? `
            <div id="bt-abrir-ajustes-chat">
                <img src="../recursos/engranaje.png" alt="ajustes" title="Ajustes del chat">
            </div>` : ''}

        </div>

        <div class="info-chat-cuerpo">
            <div class="info-chat-perfil">
                <div class="info-chat-nombre">
                    <span>${escapeHTML(nombre_chat)}</span>
                </div>
                <div class="info-chat-subtitulo">
                    ${integrantes_chat()}
                </div>
            </div>

            <div class="info-chat-detalles">
                <div class="info-chat-item">
                    <span class="info-chat-label">Mensajes</span>
                    <span class="info-chat-valor">${info_chat?.nmensajes ?? 0}</span>
                </div>
                <div class="info-chat-item">
                    <span class="info-chat-label">Creado el</span>
                    <span class="info-chat-valor">${fecha_formateada}</span>
                </div>
            </div>

            <div class="div-botones-info-chat">
                <button id="bt-ver-archivos-chat">
                    Ver Archivos
                </button>
            </div>

            ${await (async () => {
            try {
                if (!info_chat?.usuarios || !Array.isArray(info_chat.usuarios)) {
                    return `<div class="info-chat-lista-participantes"><div class="info-chat-lista-titulo">Participantes (0)</div><div class="info-chat-lista-items">No se pudieron cargar los participantes.</div></div>`
                }

                let participantes_ids = [...new Set(info_chat.usuarios.map(u => normalizeIdHelper(u)))]// normalizar a string y quitar repetidos
                participantes_ids = participantes_ids.filter(id => id && id !== id_mio?.toString())//quitar el id propio

                // Obtener datos de todos los participantes en paralelo
                const participantes_promesas = participantes_ids.map(id => window.social_usuario.OBTENER_DATOS_USUARIO_EXTERNO(id).catch(() => null))
                const participantes_datos = await Promise.all(participantes_promesas)

                let lista_html = `
                    <div class="info-chat-lista-participantes">
                        <div class="info-chat-lista-titulo">Participantes (${participantes_datos.length + 1}) <div id="bt-anadir-participante-chat">+</div></div>
                        <div class="info-chat-lista-items">
                        <div class="info-chat-participante-item" data-id="${id_mio}">
                            <div class="info-chat-participante-info">
                                <span class="info-chat-participante-nombre">Tú <span class="apodo-usuario-lista-participantes">(${await obtener_apodo_usuario() || ""})</span></span>
                                ${info_chat.admins?.some(a => normalizeIdHelper(a) === id_mio?.toString()) ? `<span class="info-chat-participante-admin" style="color: gray; font-size: 11px;">Admin</span>` : ""}
                            </div>
                        </div>
                    `
                participantes_datos.forEach((p, index) => {
                    const originalId = participantes_ids[index];
                    const nombre = escapeHTML(p?.apodo || "Usuario Ravage");
                    const correo = escapeHTML(p?.correo || "");

                    const idStr = normalizeIdHelper(originalId);
                    const esAdmin = info_chat.admins?.some(a => normalizeIdHelper(a) === idStr);
                    const estaBloqueado = ids_bloqueados.includes(idStr);
                    const estaSilenciado = ids_silenciados.includes(idStr);

                    lista_html += `
                        <div class="info-chat-participante-item" data-id="${idStr}" data-idamigo="${p?.idamigo || ""}">
                            <div class="info-chat-participante-info">
                                <span class="info-chat-participante-nombre">
                                    ${nombre}
                                    ${estaBloqueado ? '<img src="../recursos/bloqueado.png" class="icono-bloqueado" style="width: 14px; height: 14px; opacity: 0.6; margin-left: 5px; flex-shrink: 0;" title="Usuario bloqueado">' : (estaSilenciado ? '<img src="../recursos/silenciar.png" class="icono-silenciado" style="width: 14px; height: 14px; opacity: 0.6; margin-left: 5px; flex-shrink: 0;" title="Usuario silenciado">' : '')}
                                </span>
                                <span class="info-chat-participante-correo">${correo}</span>
                                ${esAdmin ? `<span class="info-chat-participante-admin" style="color: gray; font-size: 11px;">Admin</span>` : ""}
                            </div>
                        </div>
                        `
                })
                lista_html += `</div></div>`
                return lista_html
            } catch (err) {
                console.error("Error al renderizar participantes:", err);
                return `<div class="info-chat-lista-participantes"><div class="info-chat-lista-titulo">Participantes</div><div class="info-chat-lista-items">Error al cargar la lista.</div></div>`
            }
        })()}
        </div>
    </div>`

    infoSeccion.replaceChildren();
    infoSeccion.insertAdjacentHTML("beforeend", html);

    // Eventos de la sección de información
    document.getElementById("bt-cerrar-info-chat")?.addEventListener("click", () => {
        infoSeccion.classList.remove("abierto")
        const cuerpoChat = document.querySelector(".seccion-cuerpo-chat")
        if (cuerpoChat) cuerpoChat.classList.remove("panel-lateral-abierto")
    })

    document.getElementById("bt-abrir-ajustes-chat")?.addEventListener("click", () => {
        // Crear el overlay y el contenedor usando las clases de chat.css
        const overlay = document.createElement("div");
        overlay.className = "overlay-ajustes-chat-full";

        const menuInterior = document.createElement("div");
        menuInterior.className = "menu-ajustes-chat-interior";

        // Inyectar el menú en el overlay y el overlay en el body
        overlay.appendChild(menuInterior);
        document.body.appendChild(overlay);

        // Cerrar al hacer clic en el fondo (fuera del menú)
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.remove();
        });

        // TODO: Contenido del menú...
    })

    document.getElementById("bt-ver-archivos-chat")?.addEventListener("click", () => {
        // TODO: Implementar el menú de archivos mandados
    })

    document.getElementById("bt-anadir-participante-chat")?.addEventListener("click", (e) => {
        e.preventDefault()
        // TODO: Implementar el menú de añadir participante
        desplegar_menu_añadir_chat({ mostrar: true, id_chat: id_chat })

    })
    // Eventos de los participantes
    document.querySelector(".info-chat-lista-items").addEventListener("click", async e => {
        const item = e.target.closest(".info-chat-participante-item")
        if (!item) return
        const id = item.dataset.id
        //si es el propio usuario-> no mostrar menu contextual
        if (await Es_usuario_Sesion(id)) return;

        //menu contextual participantes
        const soyAdmin = info_chat.admins?.includes(id_mio) || false;
        const targetEsAdmin = info_chat.admins?.includes(id) || false;

        let html_contextMenu = `
            <div class="context-menu context-menu-participantes" style="position: fixed; z-index: 1000;">
                ${!(await Es_Contacto_Usuario(id)) ? `<div class="context-menu-item" data-action="añadir-contacto">Añadir Contacto</div>` : ``}
            </div>
        `
        // Inyectar opciones de admin
        const divContent = [];

        if (soyAdmin) {
            divContent.push(`<div class="context-menu-item" data-action="expulsar">Expulsar</div>`);
            if (targetEsAdmin) {
                divContent.push(`<div class="context-menu-item" data-action="quitar-admin">Quitar Admin</div>`);
            } else {
                divContent.push(`<div class="context-menu-item" data-action="hacer-admin">Hacer Admin</div>`);
            }
        }

        const esta_bloqueado = ids_bloqueados.includes(id);
        const esta_silenciado = ids_silenciados.includes(id);

        const texto_bloquear = esta_bloqueado ? "Desbloquear usuario" : "Bloquear usuario";
        const action_bloquear = esta_bloqueado ? "desbloquear" : "bloquear";

        const texto_silenciar = esta_silenciado ? "Desilenciar usuario" : "Silenciar usuario";
        const action_silenciar = esta_silenciado ? "desilenciar" : "silenciar";

        divContent.push(`<div class="context-menu-item" data-action="${action_silenciar}">${texto_silenciar}</div>`);
        divContent.push(`<div class="context-menu-item" data-action="${action_bloquear}">${texto_bloquear}</div>`);

        if (divContent.length > 0) {
            html_contextMenu = html_contextMenu.replace('</div>\n`', `${divContent.join('')}\n</div>\n`);
        }

        const ventanaContenedor = document.querySelector(".info-chat-cuerpo")
        ventanaContenedor.insertAdjacentHTML("beforeend", html_contextMenu)

        const menu = ventanaContenedor.querySelector(".context-menu")
        if (menu) {
            menu.style.left = e.clientX + "px"
            menu.style.top = e.clientY + "px"

            // Cerrar al hacer click fuera
            const cerrarMenuClickFuera = (event) => {
                if (!menu.contains(event.target)) {
                    menu.remove()
                    document.removeEventListener("mousedown", cerrarMenuClickFuera)
                }
            }
            document.addEventListener("mousedown", cerrarMenuClickFuera)
        }

        menu.addEventListener("click", async (ev) => {
            const action = ev.target.dataset.action
            if (action === "expulsar") {
                const resultado = await window.chats.EXPULSAR_USUARIO_CHAT(id, id_chat)
                if (resultado) {
                    // actualizar seccion info chat
                    mostrar_datos_chat_usuarios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } })
                }
            }
            else if (action === "hacer-admin") {
                const resultado = await window.chats.HACER_ADMIN_CHAT(id_chat, id);
                if (resultado) {
                    mostrar_datos_chat_usuarios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } })
                }
            }
            else if (action === "quitar-admin") {
                const resultado = await window.chats.QUITAR_ADMIN_CHAT(id_chat, id);
                if (resultado) {
                    mostrar_datos_chat_usuarios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } })
                }
            }
            else if (action === "silenciar") {
                await window.social_usuario.AÑADIR_USUARIO_SILENCIADOS(id, "");
                mostrar_datos_chat_usuarios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
            }
            else if (action === "desilenciar") {
                await window.social_usuario.ELIMINAR_USUARIO_SILENCIADOS(id);
                mostrar_datos_chat_usuarios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
            }
            else if (action === "bloquear") {
                await window.social_usuario.AÑADIR_USUARIO_BLOQUEADOS(id, "");
                mostrar_datos_chat_usuarios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
            }
            else if (action === "desbloquear") {
                await window.social_usuario.ELIMINAR_USUARIO_BLOQUEADO(id);
                mostrar_datos_chat_usuarios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
            }
            else if (action === "añadir-contacto") { //editar nombre/extension
                //comprobar si ya es contacto
                const es_contacto = await Es_Contacto_Usuario(id)
                if (es_contacto) return;
                const item = ev.target.closest(".info-chat-participante-item")
                const id = item.dataset.id
                const nombre = item.querySelector(".info-chat-participante-nombre").textContent
                const idamigo = item.dataset.idamigo
                // Comprobar si es valido el idamigo
                if (await window.validadores.VALIDAR_IDAMIGO(idamigo)) {
                    await window.social_usuario.AÑADIR_CONTACTO(id, nombre)
                } else {
                    window.pushNotificacion({ prioridad: 2, texto: "ID de amigo no válido", tipo: "info" })
                }
            }
        })
    })
    //mostrar seccion + cambiar css secciones

    if (infoSeccion) {
        const ventanaArchivos = document.querySelector(".ventana-archivos-mensaje")

        // Si vamos a abrir info y archivos está abierto, cerramos archivos
        if (!infoSeccion.classList.contains("abierto") && ventanaArchivos) {
            // Cerramos archivos animadamente (esto coexistirá con la apertura de info)
            if (typeof cerrar_ventana_archivos === "function") {
                cerrar_ventana_archivos()
            } else {
                ventanaArchivos.classList.remove("abierto")
                setTimeout(() => ventanaArchivos.remove(), 300)
            }
        }

        // Toggle the info section
        infoSeccion.classList.toggle("abierto")

        // Sincronizar clase en el contenedor padre para ajustes de ancho de mensajes
        const cuerpoChat = document.querySelector(".seccion-cuerpo-chat")
        if (cuerpoChat) {
            const algunoAbierto = infoSeccion.classList.contains("abierto") || !!document.querySelector(".ventana-archivos-mensaje.abierto")
            if (algunoAbierto) {
                cuerpoChat.classList.add("panel-lateral-abierto")
            } else {
                cuerpoChat.classList.remove("panel-lateral-abierto")
            }
        }
    }
}
//COMPROBAR SI ES UN CONTACTO DEL USUARIO
async function Es_Contacto_Usuario(usuario_comprobar) {
    //obtener contactos usuario
    const contactos = await window.social_usuario.OBTENER_CONTACTOS_USUARIO()
    return contactos.includes(usuario_comprobar)
}
//COMPROBAR SI ES EL USUARIO DE LA SESION
export async function Es_usuario_Sesion(usuario_comprobar) {
    const id_mio = ID_USUARIO_MONGO
    return usuario_comprobar === id_mio
}