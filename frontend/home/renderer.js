// ─── IMPORTS DE COMPONENTES Y UTILIDADES ──────────────────────────────────
import { desplegar_menu_añadir_chat, set_callback_actualizar_listas } from './ui/añadir_chats_usuarios.js'
import { mostrar_datos_chat_usaurios } from './ui/chat.js'
import { Todos_Los_Eventos_Funciones_Ajustes } from './ui/ajustes.js'

// ─── IMPORTS DE MÓDULOS REFACTORIZADOS (NUEVA ARQUITECTURA) ───────────────
import {
    abrir_chat_item,
    ACTUALIZAR_LISTAS_CHAT,
    INICIO_CHAT_MENU_PRINCIPAL,
    mostrar_menu_contextual_lista_chats
} from './ui/gestor_chats.js'

import {
    abrir_ventana_archivos,
    cerrar_ventana_archivos,
    añadir_archivos_dialogo,
    mostrar_menu_contextual_archivo
} from './ui/manejador_archivos.js'

import {
    manejar_input_escribiendo,
    enviar_mensaje_chat,
    manejar_solicitud_chat
} from './ui/mensajes_eventos.js'

import {
    inicializar_buzon_notificaciones
} from './ui/buzon_eventos.js'

import { manejar_descarga_archivo } from './ui/descarga_archivos.js'
import { toggle_historial_descargas, mensaje_bienvenida_usuario } from './ui/navegacion_vistas.js'
import { manejar_ui_cierre_sesion } from './ui/servicios_sesion.js'

// Inicializar el bridge de actualización para el backend
set_callback_actualizar_listas(ACTUALIZAR_LISTAS_CHAT);

// ==========================================
// DELEGACIÓN GLOBAL DE EVENTOS (HUB PRINCIPAL)
// ==========================================
function inicializar_eventos_globales() {
    // 1. EVENTOS PANEL IZQUIERDO (Lista de Chats)
    document.querySelector("#lista-chats-componentes")?.addEventListener("click", (e) => {
        const componente = e.target.closest('.chat-componente-lista-chats')
        if (componente) { e.preventDefault(); abrir_chat_item(componente.dataset.id) }
    })

    document.querySelector("#lista-chats-componentes")?.addEventListener("contextmenu", (e) => {
        const componente = e.target.closest('.chat-componente-lista-chats')
        if (componente) { e.preventDefault(); mostrar_menu_contextual_lista_chats(e, componente.dataset.id) }
    })

    // 2. EVENTOS PANEL DERECHO (Chat Activo & Inputs)
    const divChatUsuario = document.querySelector("#chat-usuario")
    if (divChatUsuario) {
        divChatUsuario.addEventListener("click", (e) => {
            const btnAceptarSol = e.target.closest(".bt-solicitud-aceptar")
            if (btnAceptarSol) { e.preventDefault(); manejar_solicitud_chat(btnAceptarSol, true); return }

            const btnRechazarSol = e.target.closest(".bt-solicitud-rechazar")
            if (btnRechazarSol) { e.preventDefault(); manejar_solicitud_chat(btnRechazarSol, false); return }

            if (e.target.closest("#nav-prinicpal-chat-usaurio")) { mostrar_datos_chat_usaurios(e); return }
            if (e.target.closest("#bt-añadir-archivo-mensaje-escritura")) { abrir_ventana_archivos(); return }

            // Delegación descarga archivos
            if (e.target.closest(".archivo-mensaje-div-archivos")) { manejar_descarga_archivo(e); return }
        })

        divChatUsuario.addEventListener("input", (e) => {
            if (e.target.id === "textarea-mensaje-escritura") manejar_input_escribiendo(e.target)
        })

        divChatUsuario.addEventListener("keypress", (e) => {
            if (e.target.id === "textarea-mensaje-escritura" && e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); enviar_mensaje_chat(e.target)
            }
        })
    }

    // 3. EVENTOS MENÚ DE ARCHIVOS ADJUNTOS
    document.querySelector(".seccion-cuerpo-chat")?.addEventListener("click", (e) => {
        if (e.target.closest("#bt-cerrar-archivos-mensaje")) { cerrar_ventana_archivos(); return }
        if (e.target.closest("#bt-añadir-archivos-mensaje-escritura")) { añadir_archivos_dialogo(); return }
        if (e.target.closest("#bt-limpiar-archivos-mensaje-escritura")) {
            import('./ui/manejador_archivos.js').then(m => { m.limpiar_archivos_mensaje(); m.actualizar_html_lista_archivos() })
            return
        }

        const itemAdjunto = e.target.closest(".ventana-archivos-mensaje-cuerpo-componente-item")
        if (itemAdjunto) { e.preventDefault(); mostrar_menu_contextual_archivo(e, itemAdjunto); return }
    })
}

// ==========================================
// INICIALIZACIÓN DE LA APLICACIÓN (HUB)
// ==========================================
async function preparar_interfaz_y_servicios() {
    // 1. Registro de eventos permanentes
    inicializar_eventos_globales()

    document.querySelector("#bt-seccion-menu-cuenta-ajustes")?.addEventListener("click", Todos_Los_Eventos_Funciones_Ajustes)
    document.querySelector("#bt-añadir-chat")?.addEventListener("click", (e) => desplegar_menu_añadir_chat({ e, mostrar: true }))
    document.querySelector("#bt-seccion-historial-archivos")?.addEventListener("click", toggle_historial_descargas)

    let cache_input_buscar_chat_ultimo = ""
    const input_buscar_chat = document.querySelector("#input-buscar-chat")
    input_buscar_chat?.addEventListener("keyup", (e) => {
        e.preventDefault()
        if (input_buscar_chat.value.trim() !== cache_input_buscar_chat_ultimo) {
            ACTUALIZAR_LISTAS_CHAT(input_buscar_chat.value.trim())
            cache_input_buscar_chat_ultimo = input_buscar_chat.value.trim()
        }
    })

    // 2. Gestión global de fin de sesión (Listener)
    window.avisos_ui.CERRANDO_SESION(manejar_ui_cierre_sesion)
}

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Procesos de arranque
    mensaje_bienvenida_usuario().catch(e => console.error("Error bienvenida:", e))
    INICIO_CHAT_MENU_PRINCIPAL()

    // 2. Preparar el entorno
    preparar_interfaz_y_servicios()

    // 3. Sincronización del Buzón (Backend IPC)
    inicializar_buzon_notificaciones()
})
