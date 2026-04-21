/* optimizacion ventana */
import { optimizar_ventana } from '../global/optimizar_ventana.js';
optimizar_ventana()
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
    mostrar_menu_contextual_archivo,
    limpiar_archivos_mensaje,
    actualizar_html_lista_archivos
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

    // 3. EVENTOS MENÚ DE ARCHIVOS ADJUNTOS (Delegación Global)
    document.addEventListener("click", (e) => {
        // Cierre y acciones de la ventana de archivos
        if (e.target.closest("#bt-cerrar-archivos-mensaje")) { cerrar_ventana_archivos(); return }
        if (e.target.closest("#bt-añadir-archivos-mensaje-escritura")) { añadir_archivos_dialogo(); return }
        if (e.target.closest("#bt-limpiar-archivos-mensaje-escritura")) {
            limpiar_archivos_mensaje();
            actualizar_html_lista_archivos();
            cerrar_ventana_archivos();
            return
        }

        // Click en un item de la lista de archivos
        const itemAdjunto = e.target.closest(".ventana-archivos-mensaje-cuerpo-componente-item")
        if (itemAdjunto) {
            e.preventDefault();
            e.stopPropagation();
            mostrar_menu_contextual_archivo(e, itemAdjunto);
            return
        }
    })
}

/**
 * Permite escribir en el último input/textarea activo sin tener que seleccionarlo manualmente.
 */
function inicializar_escritura_automatica() {
    let ultimoInput = null;

    // Rastrear el último input o textarea que tuvo el foco
    document.addEventListener("focusin", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
            ultimoInput = e.target;
        }
    });

    // Si se pulsa en el cuerpo del chat, el último input por defecto será el de escritura
    document.addEventListener("click", (e) => {
        if (e.target.closest("#cuerpo-mensajes-chat")) {
            const chatInput = document.querySelector("#textarea-mensaje-escritura");
            if (chatInput) ultimoInput = chatInput;
        }

        if (e.target.closest("#lista-chats") && !e.target.closest(".chat-componente-lista-chats")) {
            const searchInput = document.querySelector("#input-buscar-chat");
            if (searchInput) ultimoInput = searchInput;
        }
    });

    window.addEventListener("keydown", (e) => {
        // Si ya hay un elemento de entrada enfocado, dejar que el navegador maneje el evento normalmente
        if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") {
            return;
        }

        // Solo actuar si es una tecla imprimible (letra o número) o teclas de borrado
        // Evitamos combinaciones con Ctrl, Alt, Meta o teclas de función/navegación
        const esTeclaImprimible = (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") && !e.ctrlKey && !e.metaKey && !e.altKey;

        if (esTeclaImprimible) {
            // Buscar el objetivo: último usado, o el chat, o el buscador
            const target = (ultimoInput && document.body.contains(ultimoInput) && ultimoInput.offsetParent !== null && !ultimoInput.disabled)
                ? ultimoInput
                : document.querySelector("#textarea-mensaje-escritura")
                || document.querySelector("#input-buscar-chat");

            if (target && !target.disabled) {
                target.focus();
                // Nota: Al enfocar durante el keydown, el carácter se escribirá automáticamente
            }
        }
    });
}

// ==========================================
// INICIALIZACIÓN DE LA APLICACIÓN (HUB)
// ==========================================
async function preparar_interfaz_y_servicios() {
    // 1. Registro de eventos permanentes
    inicializar_eventos_globales()
    inicializar_escritura_automatica()

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

// ==========================================
// PREVENCIÓN GLOBAL DE ARRASTRE DE IMÁGENES
// ==========================================
document.addEventListener("dragstart", (e) => {
    if (e.target.tagName === 'IMG') {
        e.preventDefault();
    }
});

// Monitor de memoria en el Renderer (Debug)
if (window.opciones_dev?.isDev) {
    setInterval(() => {
        if (typeof performance !== 'undefined' && performance.memory) {
            const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            const limit = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);
            console.log(`[Renderer Memory] Used: ${used}MB / Limit: ${limit}MB`);
            if (used > limit * 0.8) {
                console.warn("ALERTA: Memoria del Renderer cerca del límite!");
            }
        }
    }, 5000);
}

document.addEventListener("DOMContentLoaded", async () => {
    console.log("[Renderer] DOMContentLoaded - Iniciando arranque...");

    try {
        // 1. Procesos de arranque
        console.log("[Renderer] Lanzando mensaje de bienvenida...");
        mensaje_bienvenida_usuario().catch(e => console.error("Error bienvenida:", e))

        console.log("[Renderer] Cargando lista de chats inicial...");
        await INICIO_CHAT_MENU_PRINCIPAL()
        console.log("[Renderer] Lista de chats inicial cargada.");

        // 2. Preparar el entorno
        console.log("[Renderer] Configurando eventos globales...");
        preparar_interfaz_y_servicios()

        // 3. Sincronización del Buzón (Backend IPC)
        console.log("[Renderer] Conectando buzón de notificaciones...");
        inicializar_buzon_notificaciones()
        console.log("[Renderer] Buzón conectado.");

        // 4. Asegurar que todas las imágenes existentes no sean arrastrables
        document.querySelectorAll('img').forEach(img => img.draggable = false);

        console.log("[Renderer] Arranque completado con éxito.");
    } catch (err) {
        console.error("[Renderer] Error CRÍTICO durante el arranque:", err);
    }
})

