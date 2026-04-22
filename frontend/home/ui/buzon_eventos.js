import { Actualizar_render_chat, ACTUALIZAR_LISTAS_CHAT, refrescar_componente_lista_chats, cambiar_datos_componente_lista_chats, INCREMENTAR_MENSAJES_CACHE_ACTIVA } from './gestor_chats.js'
import { ID_USUARIO_MONGO } from '../caches_datos.js'
import { Encontrar_Nombre_Chat_Usuario, Es_usuario_Sesion } from './chat.js'
import { safeIdSelector } from './seguridad_ui.js';


export async function procesar_entradas_buzon(entradas) {
    if (!entradas || entradas.length === 0) return;
    
    try {
        let necesitaRefrescarListaCompleta = false;
        const mensajesPorChat = {}; // { id_chat: [entradas_tipo_0] }

        // 1. Clasificar entradas para evitar redundancia
        for (const entrada of entradas) {
            const tp = Number(entrada.tipo);
            const id_chat = entrada.data?.chat || entrada.chat;

            if (tp === 0) { // Mensaje de chat
                if (id_chat) {
                    if (!mensajesPorChat[id_chat]) mensajesPorChat[id_chat] = [];
                    mensajesPorChat[id_chat].push(entrada);
                }
            } else {
                // Otros tipos suelen requerir refrescar la lista completa (unirse/crear/expulsar)
                const resultado = await hacer_cambios_buzon(entrada);
                if (resultado === "REFRESCAR_LISTA") necesitaRefrescarListaCompleta = true;
            }
        }

        // 2. Procesar mensajes agrupados por chat
        for (const [id_chat, lote_mensajes] of Object.entries(mensajesPorChat)) {
            // Solo procesamos el ÚLTIMO mensaje del lote para actualizar el item de la lista
            // (los anteriores son irrelevantes para el "último mensaje" de la previsualización)
            const ultimo_mensaje = lote_mensajes[lote_mensajes.length - 1];
            await Cambio_buzonApi_mensaje(ultimo_mensaje, lote_mensajes.length > 1 ? lote_mensajes : null);
        }

        // 3. Refrescar lista completa si es necesario
        if (necesitaRefrescarListaCompleta) {
            await ACTUALIZAR_LISTAS_CHAT();
        }
    } catch (e) {
        console.error("Error al procesar lote de buzón", e);
    }
}

export async function hacer_cambios_buzon(entrada) {
    const tp = Number(entrada.tipo)
    const esta_silenciado = entrada.silenciado || false;

    if (tp === 0) { //mensaje chat
        return await Cambio_buzonApi_mensaje(entrada)
    }
    else if (tp === 1) {//unirse grupo
        return await Cambio_buzonApi_unirse_grupo(entrada, esta_silenciado)
    }
    else if (tp === 2) {//crear grupo
        return await Cambio_buzonApi_crear_grupo(entrada, esta_silenciado)
    }
    else if (tp === 3) {//usuario añadido
        return await Cambio_buzonApi_usuario_añadido(entrada, esta_silenciado)
    }
    else if (tp === 4) {//expulsar usuario
        return await Cambio_buzonApi_expulsar_usuario(entrada, esta_silenciado)
    }
    return null;
}

export async function iniciar_buzonAPI() {
    const syncBar = document.createElement("div")
    syncBar.className = "sync-mailbox-bar"
    syncBar.innerHTML = `<div class="sync-spinner"></div><span>Sincronizando buzón...</span>`

    const mostrarSync = setTimeout(() => {
        document.body.appendChild(syncBar)
        requestAnimationFrame(() => syncBar.classList.add("visible"))
    }, 1000)

    const cambios = await window.buzonAPI.REVISAR_BUZON()
    await procesar_entradas_buzon(cambios || [])

    await window.buzonAPI.INICIAR_BUZON()

    clearTimeout(mostrarSync)
    if (syncBar.parentNode) {
        syncBar.classList.remove("visible")
        setTimeout(() => syncBar.remove(), 450)
    }
}

export async function inicializar_buzon_notificaciones() {
    iniciar_buzonAPI().catch(e => console.error("Error buzón IPC:", e))
    window.buzonAPI.onNuevaNotificacion((data) => procesar_entradas_buzon(data.entrada))
    window.buzonAPI.onNotificarRender((data) => window.pushNotificacion(data))
}

/*funciones de cambios del buzon*/
async function Cambio_buzonApi_mensaje(entrada, lote = null) {
    const id_chat = entrada.data?.chat || entrada.chat;
    const esta_silenciado = entrada.silenciado || false;
    
    // Si no hay lote, creamos uno con la entrada única para unificar lógica
    const mensajes_a_procesar = lote || [entrada];
    const ultima_entrada = mensajes_a_procesar[mensajes_a_procesar.length - 1];

    // 0. Incrementar contador de mensajes en caché activa
    INCREMENTAR_MENSAJES_CACHE_ACTIVA(id_chat, mensajes_a_procesar.length);

    // 1. Actualizar el render del chat si está activo (abierto en pantalla)
    const chatAbierto = !!document.getElementById(`nav-prinicpal-chat-usaurio${safeIdSelector(id_chat)}`);
    
    if (chatAbierto && document.getElementById("chat-usuario")) {
        // Si hay muchos mensajes, podríamos querer optimizar esto más, 
        // pero por ahora los procesamos todos para que aparezcan en el chat.
        for (const msg_ent of mensajes_a_procesar) {
            const id_msg = msg_ent.data?.id_mensaje;
            if (!id_msg) continue;

            try {
                const respuesta = await window.chats.OBTENER_DATOS_MENSAJE(id_chat, id_msg);
                if (respuesta) {
                    await Actualizar_render_chat({
                        emisor: respuesta.emisor,
                        chat: id_chat,
                        mensaje: respuesta.contenido?.[0]?.asunto || "",
                        archivos: respuesta.contenido?.[0]?.archivos || [],
                        fecha: respuesta.data,
                        id_mensaje: id_msg
                    });
                }
            } catch (err) {
                console.error("Error al recuperar datos de mensaje para render:", err);
            }
        }
    }

    // 2. Actualizar el componente de la lista lateral (Sidebar)
    const chatC = Array.from(document.querySelectorAll(".chat-componente-lista-chats")).find(el => el.dataset.id == id_chat);
    
    if (chatC) {
        // Solo refrescamos visualmente el item una vez, con la info del último mensaje
        await refrescar_componente_lista_chats(id_chat, chatC, !esta_silenciado && !chatAbierto);
        
        // Notificación sonora/visual (solo si no está silenciado y el chat no está abierto)
        if (!esta_silenciado && !chatAbierto) {
            const nombre = chatC.querySelector(".nombre-chat-lista-componente span")?.textContent || "nuevo mensaje";
            window.pushNotificacion({
                prioridad: 0,
                texto: `Nuevo mensaje de ${nombre}`,
                tipo: "info"
            });
        }
    }

    // 3. Actualizar datos internos del componente (último mensaje, fecha, etc.)
    cambiar_datos_componente_lista_chats({ id_chat, data: ultima_entrada, notificacion: true });
    
    return null; 
}

async function Cambio_buzonApi_unirse_grupo(entrada, esta_silenciado) {
    const nombreChat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat })
    if (!esta_silenciado) {
        const mi_id = ID_USUARIO_MONGO;
        if (entrada.data.usuarios.includes(mi_id)) {
            window.pushNotificacion({ prioridad: 0, texto: `Te has unido a un nuevo chat${nombreChat ? `\n${nombreChat}` : ``}`, tipo: "info" })
        }
        else {
            const nombreEmisor = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.emisor })
            const nombreAñadido = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.añadido })
            window.pushNotificacion({ prioridad: 0, texto: `${nombreEmisor} añadió a ${nombreAñadido} al grupo${nombreChat ? `\n${nombreChat}` : ``}`, tipo: "info" })
        }
    }
    await Actualizar_render_chat({ emisor: entrada.data.emisor, chat: entrada.data.chat, fecha: entrada.data.data, especial: 1, data: entrada.data })
    return "REFRESCAR_LISTA";
}

async function Cambio_buzonApi_crear_grupo(entrada, esta_silenciado) {
    const nombreChat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat })
    const nombreCreador = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.creador })
    if (!esta_silenciado) {
        window.pushNotificacion({ prioridad: 0, texto: `${nombreCreador} ha creado un nuevo chat${nombreChat ? `\n${nombreChat}` : ``}`, tipo: "info" })
    }
    return "REFRESCAR_LISTA";
}

async function Cambio_buzonApi_expulsar_usuario(entrada, esta_silenciado) {
    const expulsadoId = entrada.data.expulsado;
    const isMe = await Es_usuario_Sesion(expulsadoId);
    const nombreExpulsado = isMe ? "Te" : await Encontrar_Nombre_Chat_Usuario({ id_buscar: expulsadoId });
    const chatNombre = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat });

    if (isMe) {
        if (document.getElementById(`nav-prinicpal-chat-usaurio${safeIdSelector(entrada.data.chat)}`)) {
            document.getElementById("chat-usuario").replaceChildren();
        }

        if (!esta_silenciado) {
            window.pushNotificacion({ prioridad: 0, texto: `Has sido expulsado del chat ${chatNombre || ""}`, tipo: "error" });
        }
    } else {
        if (!esta_silenciado) {
            window.pushNotificacion({ prioridad: 1, texto: `${nombreExpulsado} ha sido expulsado del chat ${chatNombre || ""}`, tipo: "info" });
        }
    }
    await Actualizar_render_chat({ emisor: entrada.data.emisor, chat: entrada.data.chat, fecha: entrada.data.data, especial: 1, data: entrada.data })
    return "REFRESCAR_LISTA";
}
async function Cambio_buzonApi_usuario_añadido(entrada, esta_silenciado) {
    const añadidoId = entrada.data.añadido;
    const isMe = await Es_usuario_Sesion(añadidoId);
    const nombreAñadido = isMe ? "Te" : await Encontrar_Nombre_Chat_Usuario({ id_buscar: añadidoId });
    const chatNombre = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat });

    if (isMe) {
        if (document.getElementById(`nav-prinicpal-chat-usaurio${safeIdSelector(entrada.data.chat)}`)) {
            document.getElementById("chat-usuario").replaceChildren();
        }

        if (!esta_silenciado) {
            window.pushNotificacion({ prioridad: 0, texto: `Has sido añadido al chat ${chatNombre || ""}`, tipo: "error" });
        }
    } else {
        if (!esta_silenciado) {
            window.pushNotificacion({ prioridad: 1, texto: `${nombreAñadido} ha sido añadido al chat ${chatNombre || ""}`, tipo: "info" });
        }
    }
    await Actualizar_render_chat({ emisor: entrada.data.emisor, chat: entrada.data.chat, fecha: entrada.data.data, especial: 1, data: entrada.data })
    return "REFRESCAR_LISTA";
}
