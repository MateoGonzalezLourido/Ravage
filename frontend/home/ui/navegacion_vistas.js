import { crear_chat_historial_archivos_descargados } from './historial_archivos_descargados.js'
import { obtener_apodo_usuario, DOM_CACHE } from '../caches_datos.js'
import { CARGAR_LISTA_CONTACTOS } from './gestor_contactos.js'

// ─── SELECTOR DE VISTA DEL PANEL IZQUIERDO (chats / contactos) ────────────────

let _vista_actual = "chats";

export function obtener_vista_actual() { return _vista_actual; }

/**
 * Cambia la vista del panel izquierdo y marca el botón seleccionado.
 * Reutilizable: lo usa tanto el clic del selector como la navegación a un
 * contacto desde una mención (para que el botón "contactos" quede activo).
 */
export async function cambiar_vista_panel(nueva_vista) {
    if (nueva_vista === _vista_actual) return;

    const selector = document.getElementById("selector-vista-panel");
    const lista_chats = document.getElementById("lista-chats-componentes");
    const lista_contactos = document.getElementById("lista-contactos-componentes");
    const btn_añadir = document.getElementById("bt-añadir-chat");
    const input_buscar = document.getElementById("input-buscar-chat");
    if (!selector || !lista_chats || !lista_contactos) return;

    _vista_actual = nueva_vista;

    selector.querySelectorAll(".selector-vista-btn").forEach(b =>
        b.classList.toggle("activo", b.dataset.vista === nueva_vista)
    );

    if (nueva_vista === "chats") {
        lista_chats.classList.remove("ocultar-display");
        lista_contactos.classList.add("ocultar-display");
        if (btn_añadir) btn_añadir.style.display = "";
        if (input_buscar) input_buscar.placeholder = "Buscar chat...";
    } else {
        lista_chats.classList.add("ocultar-display");
        lista_contactos.classList.remove("ocultar-display");
        if (btn_añadir) btn_añadir.style.display = "none";
        if (input_buscar) input_buscar.placeholder = "Buscar contacto...";
        await CARGAR_LISTA_CONTACTOS(input_buscar?.value.trim() || "");
    }
}

export function toggle_historial_descargas() {
    const seccionHistorial = DOM_CACHE.seccion_historial_archivos
    const chatUsuario = DOM_CACHE.chat_usuario
    const infoChatSeccion = DOM_CACHE.info_chat_seccion

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
