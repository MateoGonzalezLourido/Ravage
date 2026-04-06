import { chat_componente_lista_estructura_html, Crear_chat_html, Encontrar_Nombre_Chat_Usuario, texto_mostrar_fecha_mensajes_bloque, aplicar_escaneres_asincronos, crear_mensaje_html } from './chat.js'
import { limpiar_archivos_mensaje } from './manejador_archivos.js'

export function cerrar_paneles_al_abrir_chat() {
    const infoSeccion = document.querySelector("#info-chat-seccion")
    if (infoSeccion && infoSeccion.classList.contains("abierto")) {
        infoSeccion.classList.remove("abierto")
    }
    const ventanaArchivos = document.querySelector(".ventana-archivos-mensaje")
    if (ventanaArchivos) {
        ventanaArchivos.classList.remove("abierto")
        setTimeout(() => ventanaArchivos.remove(), 310)
    }
    const seccionHistorial = document.querySelector("#seccion-historial-archivos")
    const chatUsuario = document.querySelector("#chat-usuario")
    if (seccionHistorial && !seccionHistorial.classList.contains("ocultar-display")) {
        seccionHistorial.classList.add("ocultar-display")
        if (chatUsuario) chatUsuario.classList.remove("ocultar-display")
    }
}



export async function Get_datos_chat_abrir(id_chat) {
    const resultados = await Promise.allSettled([
        window.chats.OBTENER_MODELO_DATOS_NECESARIOS_CHAT(),
        window.cache_persistente.getChatCache(id_chat),
        window.chats.OBTENER_CACHE_CHAT_ACTIVO(id_chat)
    ]);

    const res = resultados.map(r => r.status === 'fulfilled' ? r.value : null);
    const [template, cachePer, cacheAct] = res;

    if (!template) return null;
    let datos_necesarios = { ...template };

    let ids_usuarios = cachePer?.usuarios || cacheAct?.participantes || null;
    let campos_chat_faltantes = [];

    for (const key of Object.keys(datos_necesarios)) {
        if (cacheAct?.[key]) datos_necesarios[key] = cacheAct[key];
        else if (cachePer?.[key]) datos_necesarios[key] = cachePer[key];
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

    window.cache_persistente.setChatCache(datos_necesarios);
    window.chats.GUARDAR_CACHE_CHAT_ACTIVO({
        _id: id_chat,
        seguridad: datos_necesarios.seguridad,
        usuarios: ids_usuarios,
        admins: datos_necesarios.admins,
        fecha_creacion: datos_necesarios.fecha_creacion,
        n_mensajes: datos_necesarios.mensajes?.length || 0,
        d_participantes: usuarios_detalles
    });

    return datos_necesarios;
}

export async function ACTUALIZAR_LISTAS_CHAT(filtro = "") {
    try {
        const lista_chats = await window.chats.OBTENER_CHATS_USUARIO()
        window.chats.LIMPIAR_MENSAJES_CHATS_ANTIGUOS(lista_chats)

        const datos_chats_grupales = await window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: lista_chats, grupales: null, mensajes: false })

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

        document.querySelector("#lista-chats-componentes").innerHTML = html
    }
    catch (e) {
        throw e
    }
}

export async function abrir_chat_item(id_chat, force = false) {
    if (!force && document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == id_chat) {
        return;
    }

    const [datos_chat, id_usuario] = await Promise.all([
        Get_datos_chat_abrir(id_chat),
        window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
    ])
    if (!datos_chat) {
        window.pushNotificacion({ prioridad: 0, texto: "No se pudieron cargar los datos", tipo: "error" })
        return;
    }
    
    limpiar_archivos_mensaje()
    document.querySelector("#chat-usuario").innerHTML = await Crear_chat_html(datos_chat, id_usuario)
    cerrar_paneles_al_abrir_chat()
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

        const cerrar = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", cerrar) }}
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
                    if (document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == id_chat) await abrir_chat_item(id_chat, true)
                }
            }
            await ACTUALIZAR_LISTAS_CHAT()
            menu.remove()
        })
    }
}

export async function refrescar_componente_lista_chats(id_chat, componente, notificacion = false) {
    try {
        const [info_chats, lista_usuario] = await Promise.all([
            window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: [{ id: id_chat }], grupales: null, mensajes: false }),
            window.chats.OBTENER_CHATS_USUARIO()
        ])

        const info_chat = info_chats[0]
        if (!info_chat) return

        const chat_usuario = lista_usuario.find(c => (c.id || c._id) == id_chat)

        const datos_usar = {
            id: id_chat,
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

        const lista_contenedor = document.querySelector("#lista-chats-componentes")
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

export async function Actualizar_render_chat({ emisor, chat, mensaje = "", archivos = [], fecha, especial = null, data = {} }) {
    if (document.querySelector("#chat-usuario") && document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == chat) {
        const id_emisor = Array.isArray(emisor) ? emisor[0]?.toString() : emisor?.toString()

        const [nombres_contactos, id_propio, info_chat_cache] = await Promise.all([
            window.social_usuario.OBTENER_CONTACTOS_USUARIO(),
            window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO(),
            window.cache_persistente.getChatCache(chat)
        ]).catch(() => [[], null, null])

        let info_chat = await window.chats.OBTENER_CACHE_CHAT_ACTIVO()
        if (info_chat && info_chat._id !== chat && info_chat.id !== chat) {
            info_chat = null;
        }

        if (!info_chat) {
            info_chat = info_chat_cache
        }

        if (!info_chat) {
            info_chat = await window.chats.OBTENER_DATOS_CHAT_UNICO(chat).catch((e) => {
                console.error("Error al obtener datos para renderizar mensaje:", e);
                return null;
            })
        }

        const propio = id_propio && id_emisor == id_propio.toString()
        const esAdmin = info_chat?.usuarios?.length > 2 && info_chat?.admins?.some(admin_id => admin_id.toString() === id_emisor.toString());

        const nombre_emisor = await Encontrar_Nombre_Chat_Usuario({ id_buscar: id_emisor, grupal: false, contactos: nombres_contactos });

        const result_seguridad = await window.escaneres_seguridad_app.ESCANERES_SEGURIDAD_MENSAJE(chat)
        const escaneres_seguridad = result_seguridad.escaneres_seguridad || result_seguridad;
        const htmlPromise = crear_mensaje_html({ fecha, asunto: mensaje, archivos, propio, nombre_emisor, esAdmin, escaneres_seguridad })

        const chatContainer = document.querySelector("#cuerpo-mensajes-chat");
        if (!chatContainer) return;

        const lastBlock = chatContainer.querySelector(".bloque-dia-chat:last-child");
        const fechaActualText = texto_mostrar_fecha_mensajes_bloque(new Date(fecha));
        let lastBlockDateText = lastBlock ? lastBlock.querySelector(".fecha-bloque-mensajes span")?.innerHTML : null;

        const html = await htmlPromise;

        if (!lastBlock || lastBlockDateText !== fechaActualText) {
            const nuevoBloqueHTML = `
                <div class="bloque-dia-chat">
                    <div class="fecha-bloque-mensajes"><span>${fechaActualText}</span></div>
                    ${html}
                </div>
            `;
            chatContainer.insertAdjacentHTML("beforeend", nuevoBloqueHTML);
        } else {
            lastBlock.insertAdjacentHTML("beforeend", html);
        }

        const nuevoMensaje = chatContainer.querySelector(".mensaje-chat:last-child");
        if (nuevoMensaje) {
            aplicar_escaneres_asincronos(nuevoMensaje, mensaje, escaneres_seguridad);
        }

        scroll_fin_chat()
    }
}
export function scroll_fin_chat() {
    const chatCuerpo = document.querySelector("#cuerpo-mensajes-chat")
    if (chatCuerpo) {
        chatCuerpo.scrollTo({
            top: chatCuerpo.scrollHeight,
            behavior: "smooth"
        })
    }
}
export async function INICIO_CHAT_MENU_PRINCIPAL() {
    try {
        await ACTUALIZAR_LISTAS_CHAT()
    }
    catch (e) {
        throw e
    }
}
