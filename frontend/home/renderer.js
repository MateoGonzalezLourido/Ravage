/* optimizacion ventana */
import { optimizar_ventana } from '../global/optimizar_ventana.js';
optimizar_ventana()
// ─── IMPORTS DE COMPONENTES Y UTILIDADES ──────────────────────────────────
import { desplegar_menu_añadir_chat, set_callback_actualizar_listas } from './ui/añadir_chats_usuarios.js'
import { mostrar_datos_chat_usuarios, iniciar_sistema_hover_urls } from './ui/chat.js'
import { Todos_Los_Eventos_Funciones_Ajustes, aplicar_ajuste_hilos } from './ui/ajustes.js'

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
    manejar_solicitud_chat,
    mostrar_menu_contextual_mensaje
} from './ui/mensajes_eventos.js'
document.getElementsByClassName
import {
    inicializar_buzon_notificaciones
} from './ui/buzon_eventos.js'

import { manejar_descarga_archivo } from './ui/descarga_archivos.js'
import { toggle_historial_descargas, mensaje_bienvenida_usuario } from './ui/navegacion_vistas.js'
import { CARGAR_LISTA_CONTACTOS, abrir_chat_por_contacto, mostrar_menu_contextual_contacto } from './ui/gestor_contactos.js'
import { manejar_ui_cierre_sesion } from './ui/servicios_sesion.js'
import { limpiar_cache_iconos } from './ui/url_icono_extensiones_archivos.js'
import {
    establecer_id_usuario,
    establecer_apodo_usuario,
    establecer_correo_usuario,
    cache_input_buscar_chat_ultimo,
    establecer_cache_busqueda_chat,
    DOM_CACHE,
    limpiar_cache_virtualizacion_segundo_plano
} from './caches_datos.js'

// Inicializar el bridge de actualización para el backend
set_callback_actualizar_listas(ACTUALIZAR_LISTAS_CHAT);

// ==========================================
// SELECTOR DE VISTA (Chats / Contactos)
// ==========================================
let vista_actual = "chats";

function inicializar_selector_vista() {
    const selector = document.getElementById("selector-vista-panel");
    const lista_chats = document.getElementById("lista-chats-componentes");
    const lista_contactos = document.getElementById("lista-contactos-componentes");
    const btn_añadir = document.getElementById("bt-añadir-chat");
    const input_buscar = document.getElementById("input-buscar-chat");
    if (!selector || !lista_chats || !lista_contactos) return;

    selector.addEventListener("click", async (e) => {
        const btn = e.target.closest(".selector-vista-btn");
        if (!btn) return;

        const nueva_vista = btn.dataset.vista;
        if (nueva_vista === vista_actual) return;

        vista_actual = nueva_vista;

        selector.querySelectorAll(".selector-vista-btn").forEach(b => b.classList.remove("activo"));
        btn.classList.add("activo");

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
    });
}

// ==========================================
// DELEGACIÓN GLOBAL DE EVENTOS (HUB PRINCIPAL)
// ==========================================
function inicializar_eventos_globales() {
    // 1. EVENTOS PANEL IZQUIERDO (Lista de Chats)
    DOM_CACHE.lista_chats_componentes?.addEventListener("click", (e) => {
        const componente = e.target.closest('.chat-componente-lista-chats')
        if (componente) { e.preventDefault(); abrir_chat_item(componente.dataset.id) }
    })

    DOM_CACHE.lista_chats_componentes?.addEventListener("contextmenu", (e) => {
        const componente = e.target.closest('.chat-componente-lista-chats')
        if (componente) { e.preventDefault(); mostrar_menu_contextual_lista_chats(e, componente.dataset.id) }
    })

    // Eventos panel de Contactos
    DOM_CACHE.lista_contactos_componentes?.addEventListener("click", (e) => {
        const componente = e.target.closest(".chat-componente-lista-chats");
        if (componente) {
            e.preventDefault();
            abrir_chat_por_contacto(componente.dataset.contactoId, componente.dataset.apodo, componente.dataset.id || "");
        }
    })

    DOM_CACHE.lista_contactos_componentes?.addEventListener("contextmenu", (e) => {
        const componente = e.target.closest(".chat-componente-lista-chats");
        if (componente) {
            e.preventDefault();
            mostrar_menu_contextual_contacto(e, componente.dataset.contactoId, componente.dataset.id || "");
        }
    })

    DOM_CACHE.chat_usuario?.addEventListener("contextmenu", (e) => {
        const mensaje_node = e.target.closest('.mensaje-chat');
        if (mensaje_node) {
            e.preventDefault();
            mostrar_menu_contextual_mensaje(e, mensaje_node);
        }
    })

    // 2. EVENTOS PANEL DERECHO (Chat Activo & Inputs)
    const divChatUsuario = DOM_CACHE.chat_usuario
    if (divChatUsuario) {
        divChatUsuario.addEventListener("click", (e) => {
            const btnAceptarSol = e.target.closest(".bt-solicitud-aceptar")
            if (btnAceptarSol) { e.preventDefault(); manejar_solicitud_chat(btnAceptarSol, true); return }

            const btnRechazarSol = e.target.closest(".bt-solicitud-rechazar")
            if (btnRechazarSol) { e.preventDefault(); manejar_solicitud_chat(btnRechazarSol, false); return }

            if (e.target.closest("#nav-principal-chat-usuario")) { mostrar_datos_chat_usuarios(e); return }
            if (e.target.closest("#bt-añadir-archivo-mensaje-escritura")) { abrir_ventana_archivos(); return }

            // Delegación descarga archivos
            if (e.target.closest(".archivo-mensaje-div-archivos")) { manejar_descarga_archivo(e); return }
        })

        divChatUsuario.addEventListener("input", (e) => {
            if (e.target.id === "textarea-mensaje-escritura") manejar_input_escribiendo(e.target)
        })

        divChatUsuario.addEventListener("keypress", (e) => {
            if (e.target.id === "textarea-mensaje-escritura" && e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); 
                enviar_mensaje_chat(e.target)
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
            const chatInput = DOM_CACHE.textarea_mensaje_escritura;
            if (chatInput) ultimoInput = chatInput;
        }

        if (e.target.closest("#lista-chats") && !e.target.closest(".chat-componente-lista-chats")) {
            const searchInput = DOM_CACHE.input_buscar_chat;
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
                : DOM_CACHE.textarea_mensaje_escritura
                || DOM_CACHE.input_buscar_chat;

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
    inicializar_selector_vista()
    inicializar_eventos_globales()
    inicializar_escritura_automatica()

    document.getElementById("bt-seccion-menu-cuenta-ajustes")?.addEventListener("click", Todos_Los_Eventos_Funciones_Ajustes)
    document.getElementById("bt-añadir-chat")?.addEventListener("click", (e) => desplegar_menu_añadir_chat({ e, mostrar: true }))
    document.getElementById("bt-seccion-historial-archivos")?.addEventListener("click", toggle_historial_descargas)

    
    
    const input_buscar_chat = DOM_CACHE.input_buscar_chat
    input_buscar_chat?.addEventListener("keyup", (e) => {
        e.preventDefault()
        const valor = input_buscar_chat.value.trim()
        if (vista_actual === "contactos") {
            CARGAR_LISTA_CONTACTOS(valor);
        } else if (valor !== cache_input_buscar_chat_ultimo) {
            ACTUALIZAR_LISTAS_CHAT(valor)
            establecer_cache_busqueda_chat(valor)
        }
    })

    // 2. Gestión global de fin de sesión (Listener)
    window.avisos_ui.CERRANDO_SESION(manejar_ui_cierre_sesion)

    // 3. Limpieza de RAM (Backend signal)
    window.avisos_ui.LIMPIAR_RAM(() => {
        limpiar_cache_virtualizacion_segundo_plano();
        limpiar_cache_iconos();
        DOM_CACHE.limpiar_cache_dom();
    })

    // 4. Recuperación de RAM (Re-inicializar al volver)
    window.addEventListener('focus', () => {
        if (DOM_CACHE.lista_chats_componentes === null) {
            console.log("[Cleanup RAM] Re-inicializando cache DOM al recuperar foco.");
            DOM_CACHE.inicializar_estaticos();
            DOM_CACHE.refrescar_elementos_chat();
        }
    });
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
        // 0. Inicializar caché del DOM
        DOM_CACHE.inicializar_estaticos();

        // 1. Procesos de arranque
        console.log("[Renderer] Obteniendo ID de usuario...");
        const [id_mongo, apodo, correo] = await Promise.all([
            window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO(),
            window.cuenta_usuario.GET_APODO_SESION(),
            window.cuenta_usuario.OBTENER_CORREO_USUARIO()
        ]);
        
        establecer_id_usuario(id_mongo);
        establecer_apodo_usuario(apodo);
        establecer_correo_usuario(correo);

        // --- CHECK SECURITY PIN ---
        console.log("[Renderer] Verificando PIN de seguridad...");
        const hasPin = await window.ajustes_app.TIENE_PIN();
        if (hasPin) {
            const overlay = document.getElementById("overlay-pin-arranque");
            if (overlay) {
                overlay.style.display = "flex";
                const inputPin = document.getElementById("input-pin-arranque");
                const btnPin = document.getElementById("bt-verificar-pin-arranque");
                const errorPin = document.getElementById("error-pin-arranque");
                inputPin.focus();

                await new Promise((resolve) => {
                    const checkPin = async () => {
                        const val = inputPin.value;
                        if (!val) return;
                        btnPin.disabled = true;
                        errorPin.textContent = "Verificando...";
                        errorPin.style.color = "#a855f7";
                        
                        try {
                            const res = await window.ajustes_app.VERIFICAR_PIN(val);
                            if (res.ok) {
                                overlay.style.display = "none";
                                resolve();
                            } else {
                                errorPin.textContent = res.error || "PIN incorrecto";
                                errorPin.style.color = "#ef4444";
                                btnPin.disabled = false;
                                inputPin.value = "";
                                inputPin.focus();
                            }
                        } catch (err) {
                            errorPin.textContent = "Error inesperado";
                            errorPin.style.color = "#ef4444";
                            btnPin.disabled = false;
                        }
                    };
                    btnPin.addEventListener("click", checkPin);
                    inputPin.addEventListener("keydown", (e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            checkPin();
                        }
                    });
                });
            }
        }
        // --- END CHECK ---

        // 1.1 Cargar ajustes visuales
        const ajustes = await window.ajustes_app.OBTENER_AJUSTES_APP() || {}
        aplicar_ajuste_hilos(ajustes.DESACTIVAR_HILOS_VISUALES || false);

        console.log("[Renderer] Lanzando mensaje de bienvenida...");
        mensaje_bienvenida_usuario().catch(e => console.error("Error bienvenida:", e))

        console.log("[Renderer] Cargando lista de chats inicial...");
        await INICIO_CHAT_MENU_PRINCIPAL()
        iniciar_sistema_hover_urls()
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

