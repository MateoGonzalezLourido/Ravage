import { Actualizar_render_chat, ACTUALIZAR_LISTAS_CHAT, refrescar_componente_lista_chats, cambiar_datos_componente_lista_chats } from './gestor_chats.js'
import { Encontrar_Nombre_Chat_Usuario, Es_usuario_Sesion } from './chat.js'
import { safeIdSelector } from './seguridad_ui.js';


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
        await Cambio_buzonApi_mensaje(entrada)
    }
    else if (tp === 1) {//unirse grupo
        await Cambio_buzonApi_unirse_grupo(entrada, esta_silenciado)
    }
    else if (tp === 2) {//crear grupo
        await Cambio_buzonApi_crear_grupo(entrada, esta_silenciado)
    }
    else if (tp === 3) {//usuario añadido
        await Cambio_buzonApi_usuario_añadido(entrada, esta_silenciado)
    }
    else if (tp === 4) {//expulsar usuario
        await Cambio_buzonApi_expulsar_usuario(entrada, esta_silenciado)
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

/*funciones de cambios del buzon*/
async function Cambio_buzonApi_mensaje(entrada) {
    const id_chat = entrada.data?.chat || entrada.chat;
    const id_mensaje = entrada.data?.id_mensaje;
    if(!id_chat || !id_mensaje) return;

    const chatC = Array.from(document.querySelectorAll(".chat-componente-lista-chats")).find(el => el.dataset.id == id_chat);
    //actualizar chat render si esta activo
    if (document.querySelector("#chat-usuario") && document.querySelector(`#nav-prinicpal-chat-usaurio${safeIdSelector(id_chat)}`)) {

        const respuesta = await window.chats.OBTENER_DATOS_MENSAJE(id_chat, id_mensaje)
        await Actualizar_render_chat({
            emisor: respuesta.emisor,
            chat: id_chat,
            mensaje: respuesta.contenido?.[0]?.asunto || "",
            archivos: respuesta.contenido?.[0]?.archivos || [],
            fecha: respuesta.data,
            id_mensaje: id_mensaje
        })
    }
    //notificacion
    if (chatC) {
        const chatAbierto = !!document.querySelector(`#nav-prinicpal-chat-usaurio${safeIdSelector(id_chat)}`);
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
    //actualizar ultimo mensaje
    cambiar_datos_componente_lista_chats({ id_chat, data: entrada,notificacion:true })
}

async function Cambio_buzonApi_unirse_grupo(entrada, esta_silenciado) {
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

async function Cambio_buzonApi_crear_grupo(entrada, esta_silenciado) {
    await ACTUALIZAR_LISTAS_CHAT()
    const nombreChat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat })
    const nombreCreador = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.creador })
    if (!esta_silenciado) {
        window.pushNotificacion({ prioridad: 0, texto: `${nombreCreador} ha creado un nuevo chat${nombreChat ? `\n${nombreChat}` : ``}`, tipo: "info" })
    }
}

async function Cambio_buzonApi_expulsar_usuario(entrada, esta_silenciado) {
    const expulsadoId = entrada.data.expulsado;
    const isMe = await Es_usuario_Sesion(expulsadoId);
    const nombreExpulsado = isMe ? "Te" : await Encontrar_Nombre_Chat_Usuario({ id_buscar: expulsadoId });
    const chatNombre = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat });

    if (isMe) {
        await ACTUALIZAR_LISTAS_CHAT();
        if (document.querySelector(`#nav-prinicpal-chat-usaurio${safeIdSelector(entrada.data.chat)}`)) {
            document.querySelector("#chat-usuario").replaceChildren();
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
async function Cambio_buzonApi_usuario_añadido(entrada, esta_silenciado) {
    const añadidoId = entrada.data.añadido;
    const isMe = await Es_usuario_Sesion(añadidoId);
    const nombreAñadido = isMe ? "Te" : await Encontrar_Nombre_Chat_Usuario({ id_buscar: añadidoId });
    const chatNombre = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat });

    if (isMe) {
        await ACTUALIZAR_LISTAS_CHAT();
        if (document.querySelector(`#nav-prinicpal-chat-usaurio${safeIdSelector(entrada.data.chat)}`)) {
            document.querySelector("#chat-usuario").replaceChildren();
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
}
