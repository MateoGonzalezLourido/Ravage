import { desplegar_menu_añadir_chat } from './añadir_chats_usuarios.js'
import { url_icono_extension_img } from './url_icono_extensiones_archivos.js'
import { scroll_fin_chat } from './gestor_chats.js'
import { escapeHTML, safeIdSelector } from './seguridad_ui.js';

const nombre_defecto = "~no encontrado~"

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

    const habilitados = escaneres_habilitados.escaneres_seguridad || escaneres_habilitados;

    for (const [id, scanner] of Object.entries(SCANNER_DEFINITIONS)) {
        if (habilitados[id] && scanner.type === "sync") {
            const { text, detected } = await scanner.sync(textoFinal, habilitados[id]);
            textoFinal = text;
            if (detected) tagsDetectados.push(id);
        }
    }
    return { textoFinal, tagsDetectados };
}

/**
 * Aplica escáneres post-renderizado para añadir iconos sin re-escanear si ya se detectó en sync.
 */
export async function aplicar_escaneres_asincronos(mensajeElement, texto, escaneres_habilitados = {}) {
    if (!mensajeElement) return;

    // Obtener lo que ya se detectó en la fase síncrona (optimización)
    const tagsStr = mensajeElement.dataset.scannerTags || "";
    const tagsYaDetectados = tagsStr ? tagsStr.split(",").filter(t => t) : [];
    const contenedorIconos = document.createElement("div");
    contenedorIconos.className = "contenedor-iconos-seguridad";

    let huboDeteccion = tagsYaDetectados.length > 0;

    // 1. Mostrar iconos de lo ya detectado
    for (const id of tagsYaDetectados) {
        if (SCANNER_DEFINITIONS[id]?.render) {
            contenedorIconos.insertAdjacentHTML("beforeend", SCANNER_DEFINITIONS[id].render());
        }
    }

    const habilitados = escaneres_habilitados.escaneres_seguridad || escaneres_habilitados;

    // 2. Correr escáneres puramente asíncronos
    for (const [id, scanner] of Object.entries(SCANNER_DEFINITIONS)) {
        if (habilitados[id] && scanner.type === "async" && !tagsYaDetectados.includes(id)) {
            const result = await scanner.async_detect(texto);

            // Evaluar si es una detección real (manejando objetos y booleanos)
            let detectado = false;

            if (result && typeof result === "object") {
                // Si el objeto tiene propiedades específicas de detección, las usamos
                // (Priorizamos la propiedad más común para cada tipo de escáner)
                detectado = !!(result.esMaliciosa || result.suspicious || result.detected);
            } else {
                // Si es un valor simple (booleano), lo convertimos a booleano real
                detectado = !!result;
            }

            if (detectado) {
                huboDeteccion = true;
                if (scanner.render) {
                    contenedorIconos.insertAdjacentHTML("beforeend", scanner.render());
                }
            }
        }
    }

    if (huboDeteccion) {
        mensajeElement.classList.add("amenaza-detectada");
        mensajeElement.appendChild(contenedorIconos);
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
            fecha_param_usar_string=fecha_param_usar.toDateString()
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
    const nombre = (datos_usar) => { return escapeHTML(datos_usar?.nombre) || `&lt;&lt;no encontrado&gt;&gt;` }

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
        <div class="nombre-chat-lista-componente" style="display: flex; align-items: center; justify-content: space-between;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nombre(datos_usar)}</span>
            ${datos_usar.bloqueado ? '<img src="../recursos/bloqueado.png" style="width: 16px;z-index:2 !important; height: 16px; opacity: 0.6; margin-left: 8px; flex-shrink: 0;" title="Chat bloqueado">' : (datos_usar.silenciado ? '<img src="../recursos/silenciar.png" style="width: 16px;z-index:2 !important; height: 16px; opacity: 0.6; margin-left: 8px; flex-shrink: 0;" title="Chat silenciado">' : '')}
        </div>
        ${ultimo_mensaje(datos_usar)}
        ${ultima_vez(datos_usar)}
    </div>`

    return html
}

export const crear_mensaje_html = async ({ id_mensaje = null, fecha, asunto = "", archivos = [], propio = false, nombre_emisor, esAdmin = false, escaneres_seguridad = {}, tieneArriba = false, tieneAbajo = false, id_emisor = "" }) => {
    const class_mensajes = ["soy-emisor", "soy-receptor"]

    //funciones de componentes
    const emisor_mensaje = (propio) => {
        return propio ? class_mensajes[0] : class_mensajes[1]
    }
    const asunto_mensaje = (asunto) => {
        return asunto ? `<div class="asunto-mensaje-chat">${asunto}</div> ` : ``
    }
    const nombre_emisor_mensaje = (nombre, propio, esAdmin, tieneArriba) => {
        if (propio || tieneArriba) return ``
 
        return `<div class="nombre-mensaje-chat-usuario"><span>${escapeHTML(nombre)}${esAdmin ? " <span style='font-size: 0.9em; opacity: 0.7;'>·Admin</span>" : ""}</span></div>`
    }
    const hora_mandado = (fecha) => {
        const fechaTraducida = new Date(fecha);
        const hora = fechaTraducida.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
        return `<div class="hora-mensaje-chat"><span>${hora}</span></div>`
    }
    const archivos_mensaje = async (archivos) => {
// ... (omitted same as before for brevity in internal thought, but I'll write full content)
        if (archivos?.length > 0) {
            const html = [`<div class="mensaje-div-archivos">`]
            for (const archivo of archivos) {
                const extension = archivo?.extension || (archivo.nombre?.includes(".") ? archivo.nombre.split(".").pop() : null)
                const [url, identificado] = await url_icono_extension_img(extension)
                const nombre_mostrar = identificado ? (archivo.nombre?.includes(".") ? archivo.nombre.substring(0, archivo.nombre.lastIndexOf(".")) : archivo.nombre) : (archivo.nombre?.includes(".") ? archivo.nombre : (archivo.extension ? archivo.nombre + "." + archivo.extension : archivo.nombre))

                const emisor_id = archivo.emisor_id || '';
                const ratchet_json = archivo.ratchet_info ? encodeURIComponent(JSON.stringify(archivo.ratchet_info)) : '';

                html.push(`<div class="archivo-mensaje-div-archivos" data-id="${archivo.id || archivo._id || ''}" data-nombre="${archivo.nombre}" data-iv="${archivo.iv || ''}" data-tag="${archivo.tag || ''}" data-emisor="${emisor_id}" data-ratchet="${ratchet_json}">
                <div><img src="${url}"><span>${nombre_mostrar}</span></div>
                </div> `)
            }
            html.push("</div>")
            return html.join("")
        }
        else return ``
    }

    const { textoFinal, tagsDetectados } = await aplicar_escaneres_sincronos(asunto, escaneres_seguridad);
    const textoEscapado = escapeHTML(textoFinal);


    return (`
    <div class="mensaje-chat ${emisor_mensaje(propio)} ${tieneArriba ? 'agrupado-arriba' : ''} ${tieneAbajo ? 'agrupado-abajo' : ''}" data-id="${id_mensaje || ''}" data-scanner-tags="${tagsDetectados.join(",")}" data-emisor-id="${id_emisor}">
        ${nombre_emisor_mensaje(nombre_emisor, propio, esAdmin, tieneArriba)}
        ${asunto_mensaje(textoEscapado)}
        ${await archivos_mensaje(archivos)}
        ${hora_mandado(fecha)}

    </div> `)

}

let controller_renderizado_activo = null;

async function renderizar_chat_progresivo_plano(datos, id_propio, contactos) {
    try {
        if (controller_renderizado_activo) {
            controller_renderizado_activo.abort = true;
        }
        const controller = { abort: false };
        controller_renderizado_activo = controller;

        const chatContainer = document.querySelector("#cuerpo-mensajes-chat");
        if (!chatContainer) return;

        const mensajes = (datos.mensajes || []).filter(m => m && typeof m === 'object');
        if (mensajes.length === 0) {
            if (datos.mensajes?.length > 0) {
                console.warn("Se recibieron mensajes pero no son objetos válidos. Posible error de carga en backend.");
            }
            return;
        }

        // 1. Pre-obtener todos los nombres en un solo lote (petición grande a DB)
        const uniqueEmitterIds = [...new Set(mensajes.map(m => {
            const emisor = Array.isArray(m.emisor) ? m.emisor[0] : m.emisor;
            return emisor ? emisor.toString() : null;
        }).filter(id => id))];

        const data_usuarios = await window.social_usuario.OBTENER_VARIOS_DATOS_USUARIOS_EXTERNOS(uniqueEmitterIds);
        const map_nombres = {};
        const map_contactos = {};

        // Mapear contactos para búsqueda rápida
        contactos.forEach(c => map_contactos[c.id] = c.apodo);

        data_usuarios.forEach(u => {
            const id = u.id || u._id?.toString();
            map_nombres[id] = map_contactos[id] || u.apodo || nombre_defecto;
        });

        // 2. Agrupar mensajes por día
        const mensajes_ordenados = [...mensajes].sort((a, b) => new Date(a.data) - new Date(b.data));
        const grupos_por_dia = [];
        let current_dia = null;

        mensajes_ordenados.forEach(m => {
            const dateStr = new Date(m.data).toDateString();
            if (dateStr !== current_dia) {
                grupos_por_dia.push({ fecha: m.data, mensajes: [] });
                current_dia = dateStr;
            }
            grupos_por_dia[grupos_por_dia.length - 1].mensajes.push(m);
        });

        // 3. Renderizar día a día (de más nuevo a más viejo)
        const dias_reversos = [...grupos_por_dia].reverse();
        let es_primer_dia = true;

        const escaneres_seguridad = await window.escaneres_seguridad_app.ESCANERES_SEGURIDAD_MENSAJE(datos._id)
        for (const grupo of dias_reversos) {
            if (controller.abort) return;

            // Renderizar mensajes del día en paralelo
            const mensajesConEstado = grupo.mensajes.map((m, index) => {
                const id_emisor = (Array.isArray(m.emisor) ? m.emisor[0] : m.emisor)?.toString();
                
                // Buscar si tiene uno arriba del mismo emisor
                const prevMsg = index > 0 ? grupo.mensajes[index - 1] : null;
                const prevEmisor = prevMsg ? (Array.isArray(prevMsg.emisor) ? prevMsg.emisor[0] : prevMsg.emisor)?.toString() : null;
                const tieneArriba = id_emisor === prevEmisor;

                // Buscar si tiene uno abajo del mismo emisor
                const nextMsg = index < grupo.mensajes.length - 1 ? grupo.mensajes[index + 1] : null;
                const nextEmisor = nextMsg ? (Array.isArray(nextMsg.emisor) ? nextMsg.emisor[0] : nextMsg.emisor)?.toString() : null;
                const tieneAbajo = id_emisor === nextEmisor;

                return { ...m, id_emisor, tieneArriba, tieneAbajo };
            });

            const html_mensajes = await Promise.all(mensajesConEstado.map(async (m) => {
                try {
                    const id_emisor = m.id_emisor;
                    if (!id_emisor) return "";

                    const propio = id_emisor === id_propio.toString();
                    const esAdmin = datos.usuarios?.length > 2 && datos.admins?.includes(id_emisor);
                    const nombre = map_nombres[id_emisor] || nombre_defecto;

                    return await crear_mensaje_html({ 
                        fecha: m.data, 
                        asunto: m?.contenido[0]?.asunto || "", 
                        archivos: m?.contenido[0]?.archivos || [], 
                        propio, 
                        nombre, 
                        esAdmin, 
                        escaneres_seguridad,
                        tieneArriba: m.tieneArriba,
                        tieneAbajo: m.tieneAbajo,
                        id_emisor
                    });
                } catch (err) {
                    console.error("Error al renderizar un mensaje individual:", err, m);
                    return "";
                }
            }));

            const html_dia = `
                <div class="bloque-dia-chat">
                    <div class="fecha-bloque-mensajes"><span>${texto_mostrar_fecha_mensajes_bloque(new Date(grupo.fecha))}</span></div>
                    ${html_mensajes.join('')}
                </div>
            `;

            if (es_primer_dia) {
                chatContainer.innerHTML = html_dia;
                // Scroll al final al cargar el día más reciente
                chatContainer.scrollTop = chatContainer.scrollHeight;
                es_primer_dia = false;
            } else {
                // Prepend manteniendo el scroll
                const scroll_previo = chatContainer.scrollHeight;
                const top_previo = chatContainer.scrollTop;

                chatContainer.insertAdjacentHTML("afterbegin", html_dia);

                const nuevo_scroll = chatContainer.scrollHeight;
                chatContainer.scrollTop = top_previo + (nuevo_scroll - scroll_previo);
            }

            // Dejar respirar al UI entre días
            await new Promise(resolve => setTimeout(resolve, 0));

            // Aplicar escáneres asíncronos a los mensajes recién insertados
            const nuevosMensajes = chatContainer.querySelectorAll(".mensaje-chat:not(.scanned)");
            for (const msgEl of nuevosMensajes) {
                msgEl.classList.add("scanned");
                const textoOriginal = msgEl.querySelector(".asunto-mensaje-chat")?.textContent || "";
                aplicar_escaneres_asincronos(msgEl, textoOriginal, escaneres_seguridad);
            }
        }
        //parche para mover el scroll para abajo del chat al abrirlo
        setTimeout(() => {
            scroll_fin_chat()
        }, 10);
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
        return data_externo?.apodo || "Usuario desconocido"
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
    <div id="nav-prinicpal-chat-usaurio" data-id="${datos?._id}">
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

export async function mostrar_datos_chat_usaurios(e) {
    e.preventDefault()
    // MOSTRAR DATOS DEL USUARIO Y DEL CHAT
    const id_chat = e.currentTarget.dataset.id || document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id
    if (!id_chat) return;

    const [cache_persistente, cache_activo] = await Promise.all([
        window.cache_persistente.getChatCache(id_chat),
        window.chats.OBTENER_CACHE_CHAT_ACTIVO(id_chat)
    ])

    // Combinar cachespriorizando el activo para datos más frescos
    let info_chat = { ...(cache_persistente || {}), ...(cache_activo || {}) }

    // Campos necesarios para la vista de info
    const campos_necesarios = ["usuarios", "admins", "fecha_creacion"]
    const faltantes = campos_necesarios.filter(f => !info_chat[f])

    // Si no tenemos n_mensajes ni el array de mensajes, pedirlo
    if (info_chat.n_mensajes === undefined && (!info_chat.mensajes || info_chat.mensajes.length === 0)) {
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
            n_mensajes: info_chat.n_mensajes ?? info_chat.mensajes?.length ?? 0
        })
    }

    const id_mio = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
    const soyAdmin = info_chat?.admins?.includes(id_mio) || false

    // Pre-obtener silenciados y bloqueados
    const [silenciados, bloqueados] = await Promise.all([
        window.social_usuario.OBTENER_USUARIOS_SILENCIADOS(),
        window.social_usuario.OBTENER_USUARIOS_BLOQUEADOS()
    ])
    const ids_silenciados = (silenciados || []).map(u => typeof u === "string" ? u : u.id || u._id || u);
    const ids_bloqueados = (bloqueados || []).map(u => typeof u === "string" ? u : u.id || u._id || u);

    const infoSeccion = document.querySelector("#info-chat-seccion")

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
                <span class="info-chat-valor">${info_chat?.n_mensajes ?? info_chat?.mensajes?.length ?? 0}</span>
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
                            <span class="info-chat-participante-nombre">Tú <span class="apodo-usuario-lista-participantes">(${await window.cuenta_usuario.GET_APODO_SESION().catch(() => "")})</span></span>
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
    </div>`

    infoSeccion.replaceChildren();
    infoSeccion.insertAdjacentHTML("beforeend", html);

    // Eventos de la sección de información
    document.querySelector("#bt-cerrar-info-chat")?.addEventListener("click", () => {
        infoSeccion.classList.remove("abierto")
    })

    document.querySelector("#bt-abrir-ajustes-chat")?.addEventListener("click", () => {
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

    document.querySelector("#bt-ver-archivos-chat")?.addEventListener("click", () => {
        // TODO: Implementar el menú de archivos mandados
    })

    document.querySelector("#bt-anadir-participante-chat")?.addEventListener("click", (e) => {
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
                    mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } })
                }
            }
            else if (action === "hacer-admin") {
                const resultado = await window.chats.HACER_ADMIN_CHAT(id_chat, id);
                if (resultado) {
                    mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } })
                }
            }
            else if (action === "quitar-admin") {
                const resultado = await window.chats.QUITAR_ADMIN_CHAT(id_chat, id);
                if (resultado) {
                    mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } })
                }
            }
            else if (action === "silenciar") {
                await window.social_usuario.AÑADIR_USUARIO_SILENCIADOS(id, "");
                mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
            }
            else if (action === "desilenciar") {
                await window.social_usuario.ELIMINAR_USUARIO_SILENCIADOS(id);
                mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
            }
            else if (action === "bloquear") {
                await window.social_usuario.AÑADIR_USUARIO_BLOQUEADOS(id, "");
                mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
            }
            else if (action === "desbloquear") {
                await window.social_usuario.ELIMINAR_USUARIO_BLOQUEADO(id);
                mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
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
        // Toggle the info section
        infoSeccion.classList.toggle("abierto")
        // If it's now open, close the attachment menu if it exists (abruptly snap)
        if (infoSeccion.classList.contains("abierto")) {
            const ventanaArchivos = document.querySelector(".ventana-archivos-mensaje")
            if (ventanaArchivos) {
                // Snap close instantly without animation
                ventanaArchivos.style.transition = "none"
                ventanaArchivos.style.width = "0"
                ventanaArchivos.classList.remove("abierto")
                ventanaArchivos.remove()
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
    const id_mio = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
    return usuario_comprobar === id_mio
}