import { Actualizar_render_chat, ACTUALIZAR_LISTAS_CHAT, abrir_chat_item,cambiar_datos_componente_lista_chats } from './gestor_chats.js'
import { obtener_archivos_mensaje, limpiar_archivos_mensaje, cerrar_ventana_archivos } from './manejador_archivos.js'

export async function manejar_input_escribiendo(textarea) {
    const id_chat = document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id;
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
    textarea.style.height = "38px"
    textarea.style.height = (textarea.scrollHeight) + "px"
}

export async function enviar_mensaje_chat(textarea) {
    let mensaje = textarea.value.trim()
    const id_chat = document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id
    const id_usuario = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
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
    textarea.style.height = "38px"
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
