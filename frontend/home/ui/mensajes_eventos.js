import { Actualizar_render_chat, ACTUALIZAR_LISTAS_CHAT, abrir_chat_item, cambiar_datos_componente_lista_chats, INCREMENTAR_MENSAJES_CACHE_ACTIVA } from './gestor_chats.js'
import { ID_USUARIO_MONGO } from '../caches_datos.js'
import { obtener_archivos_mensaje, limpiar_archivos_mensaje, cerrar_ventana_archivos } from './manejador_archivos.js'

export async function manejar_input_escribiendo(textarea) {
    // Auto-ajuste de altura instantáneo
    textarea.style.height = "1px";
    textarea.style.height = (textarea.scrollHeight) + "px";

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
