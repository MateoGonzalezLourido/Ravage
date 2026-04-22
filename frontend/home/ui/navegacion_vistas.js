import { crear_chat_historial_archivos_descargados } from './historial_archivos_descargados.js'
import { obtener_apodo_usuario } from '../caches_datos.js'

export function toggle_historial_descargas() {
    const seccionHistorial = document.getElementById("seccion-historial-archivos-alineador")
    const chatUsuario = document.getElementById("chat-usuario")
    const infoChatSeccion = document.getElementById("info-chat-seccion")

    if (!seccionHistorial || !chatUsuario) return

    if (seccionHistorial.classList.contains("ocultar-display")) {
        // Mostrar historial
        seccionHistorial.classList.remove("ocultar-display")
        chatUsuario.classList.add("ocultar-display")
        if (infoChatSeccion) infoChatSeccion.classList.add("ocultar-display")
        crear_chat_historial_archivos_descargados()
    } else {
        // Ocultar historial
        seccionHistorial.classList.add("ocultar-display")
        chatUsuario.classList.remove("ocultar-display")
        if (infoChatSeccion) infoChatSeccion.classList.remove("ocultar-display")
    }
}

export async function mensaje_bienvenida_usuario() {
    const ajustes_app = await window.ajustes_app.OBTENER_AJUSTES_APP()
    const apodo = await obtener_apodo_usuario()
    if (ajustes_app?.MSBienvenida) {
        window.pushNotificacion({ prioridad: 0, texto: `Benvido ${apodo} `, tipo: "info" })
        window.ajustes_app.GUARDAR_AJUSTES_APP({ MSBienvenida: false })
    }
}
