import { Actualizar_render_chat, ACTUALIZAR_LISTAS_CHAT, refrescar_componente_lista_chats } from './gestor_chats.js'
import { Encontrar_Nombre_Chat_Usuario, Es_usuario_Sesion } from './chat.js'

export async function procesar_entradas_buzon(entradas) {
    if (!entradas || entradas.length === 0) return;
    try {
        for (const entrada of entradas) {
            await hacer_cambios_buzon(entrada);
        }
    } catch (e) {
        console.error("Error al procesar lote de buzón", e);
    }
}

export async function hacer_cambios_buzon(entrada) {
    const tp = Number(entrada.tipo)
    const esta_silenciado = entrada.silenciado || false;

    if (tp === 0) { //mensaje chat
        const id_chat = entrada.data?.chat || entrada.chat;
        const id_mensaje = entrada.data?.id_mensaje;

        const chatC = Array.from(document.querySelectorAll(".chat-componente-lista-chats")).find(el => el.dataset.id == id_chat);

        if (document.querySelector("#chat-usuario") && document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == id_chat) {
            const respuesta = await window.chats.OBTENER_DATOS_MENSAJE(id_chat, id_mensaje)
            await Actualizar_render_chat({
                emisor: respuesta.emisor,
                chat: id_chat,
                mensaje: respuesta.contenido?.[0]?.asunto || "",
                archivos: respuesta.contenido?.[0]?.archivos || [],
                fecha: respuesta.data
            })
        }

        if (chatC) {
            const chatAbierto = document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == id_chat;
            await refrescar_componente_lista_chats(id_chat, chatC, !esta_silenciado && !chatAbierto)

            if (!esta_silenciado && !chatAbierto) {
                const nombre = chatC.querySelector(".nombre-chat-lista-componente span")?.textContent || "nuevo mensaje";
                window.pushNotificacion({
                    prioridad: 0,
                    texto: `Nuevo mensaje de ${nombre}`,
                    tipo: "info"
                })
            }
        }
    }
    else if (tp === 1) {
        await ACTUALIZAR_LISTAS_CHAT()
        const nombreChat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat })
        if (!esta_silenciado) {
            const mi_id = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO();
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
    }
    else if (tp === 2) {
        await ACTUALIZAR_LISTAS_CHAT()
        const nombreChat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat })
        const nombreCreador = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.creador })
        if (!esta_silenciado) {
            window.pushNotificacion({ prioridad: 0, texto: `${nombreCreador} ha creado un nuevo chat${nombreChat ? `\n${nombreChat}` : ``}`, tipo: "info" })
        }
    }
    else if (tp === 4) {
        const expulsadoId = entrada.data.expulsado;
        const isMe = await Es_usuario_Sesion(expulsadoId);
        const nombreExpulsado = isMe ? "Te" : await Encontrar_Nombre_Chat_Usuario({ id_buscar: expulsadoId });
        const chatNombre = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat });

        if (isMe) {
            await ACTUALIZAR_LISTAS_CHAT();
            if (document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == entrada.data.chat) {
                document.querySelector("#chat-usuario").innerHTML = "";
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
    }
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
    await procesar_entradas_buzon(cambios?.entrada || [])

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
