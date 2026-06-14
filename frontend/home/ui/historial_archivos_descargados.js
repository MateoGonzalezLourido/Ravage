import { Encontrar_Nombre_Chat_Usuario, Crear_chat_html } from './chat.js'
import { ID_USUARIO_MONGO, DOM_CACHE } from '../caches_datos.js'
import { url_icono_extension_img } from './url_icono_extensiones_archivos.js'
import { escapeHTML } from './seguridad_ui.js';
import { abrir_chat_item } from './gestor_chats.js';


let cache_grupos_historial = null

export function invalidar_cache_historial() {
    cache_grupos_historial = null
}


export async function crear_chat_historial_archivos_descargados() {
    let agrupar_chats = []

    // Comprobar si la caché es válida en RAM
    if (cache_grupos_historial) {
        agrupar_chats = cache_grupos_historial
        invalidar_cache_historial()
    } else {
        // Obtener cache de archivos descargados desde el backend
        const _cache_archivos_descargados = await window.cache_archivos_descargados.getCacheArchivosDescargados()

        if (_cache_archivos_descargados && Array.isArray(_cache_archivos_descargados)) {
            for (const entry of _cache_archivos_descargados) {
                const { id_chat, nombre, id_archivo, iv, tag, ratchet_info, emisor_id } = entry
                // Recomputar la imagen siempre por si el cache almacenaba una ruta fallida/defectuosa anterior
                const ext = nombre.includes(".") ? nombre.split(".").pop() : "txt"
                const [actual_url_img] = await url_icono_extension_img(ext)

                let chat_item = agrupar_chats.find(c => c.id_chat === id_chat)
                if (!chat_item) {
                    const nombre_chat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: id_chat })
                    chat_item = {
                        id_chat,
                        nombre_chat,
                        archivos: []
                    }
                    agrupar_chats.push(chat_item)
                }

                let archivo_item = chat_item.archivos.find(a => a.nombre === nombre)
                if (!archivo_item) {
                    chat_item.archivos.push({
                        nombre,
                        url_img: actual_url_img,
                        descargas: 1,
                        id_archivo,
                        iv,
                        tag,
                        ratchet_info,
                        emisor_id
                    })
                } else {
                    archivo_item.descargas++
                    archivo_item.iv = iv
                    archivo_item.tag = tag
                    archivo_item.ratchet_info = ratchet_info
                    archivo_item.emisor_id = emisor_id
                }
            }
        }

        // Guardar en caché directamente (la limpieza se delega al backend)
        if (agrupar_chats.length > 500) {
            agrupar_chats = agrupar_chats.slice(0, 500);
        }
        cache_grupos_historial = agrupar_chats
    }

    const html = []
    if (agrupar_chats.length === 0) {
        html.push(`<div class="historial-vacio">No hay archivos descargados</div>`)
    } else {
        for (const chat of agrupar_chats) {
            html.push(`
            <div class="chat-historial-bloque" data-id="${chat.id_chat}">
                <div class="chat-historial-header">
                    <span class="chat-historial-name">${escapeHTML(chat.nombre_chat)}</span>
                </div>

                <div class="chat-historial-archivos">
            `)
            for (const archivo of chat.archivos) {
                html.push(`
                <div class="archivo-historial-wrap">
                    <div class="archivo-historial-item" data-id-archivo="${archivo.id_archivo}" data-id-chat="${chat.id_chat}">
                        <div class="archivo-info-historial">
                            <div class="archivo-info-historial-avatar">
                                <img src="${archivo.url_img}" alt="" class="img-historial-archivo" data-fallback="../recursos/extensionesArchivos/cualquiera.svg" loading="lazy" decoding="async">

                            </div>
                            <div class="archivo-info-historial-details">
                                <span class="archivo-info-historial-name-text">${escapeHTML(archivo.nombre)}</span>
                                <span class="archivo-info-historial-descargas">${archivo.descargas > 1 ? `Descargado ${archivo.descargas} veces` : 'Descargado una vez'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="archivo-acciones-historial">
                        <button class="bt-descargar-directo-historial" 
                                data-id="${archivo.id_archivo}" 
                                data-nombre="${escapeHTML(archivo.nombre)}" 
                                data-iv="${archivo.iv || ''}" 
                                data-tag="${archivo.tag || ''}" 
                                data-emisor="${archivo.emisor_id || ''}"
                                data-ratchet="${archivo.ratchet_info ? encodeURIComponent(JSON.stringify(archivo.ratchet_info)) : ''}"

                                data-id-chat="${chat.id_chat}" 
                                title="Volver a descargar">
                            <img src="../recursos/descargar.png" alt="Descargar" loading="lazy" decoding="async">
                        </button>
                    </div>
                </div>
                `)
            }
            html.push(`
                </div>
            </div>
            `)
        }
    }

    const listaContenido = DOM_CACHE.lista_contenido_historial
    if (listaContenido) listaContenido.innerHTML = html.join('')


    crear_eventos()
}

async function crear_eventos() {
    // Evento limpiar historial
    const btnLimpiar = DOM_CACHE.btn_limpiar_historial
    if (btnLimpiar) {
        btnLimpiar.onclick = async (e) => {
            e.preventDefault()
            await window.cache_archivos_descargados.setCacheArchivosDescargados()
            invalidar_cache_historial()
            crear_chat_historial_archivos_descargados()
        }
    }

    // Click en un archivo para volver al chat
    DOM_CACHE.lista_contenido_historial?.addEventListener("click", async e => {
        e.preventDefault()
        const el = e.target.closest(".archivo-historial-item")
        if (!el) return
        const id_chat = el.dataset.idChat
        const id_archivo = el.dataset.idArchivo

        // Ocultar historial, mostrar chat
        DOM_CACHE.seccion_historial_archivos?.classList.add("ocultar-display")
        const chatUsuario = DOM_CACHE.chat_usuario
        chatUsuario?.classList.remove("ocultar-display")
        const infoChatSeccion = DOM_CACHE.info_chat_seccion
        if (infoChatSeccion) infoChatSeccion.classList.remove("ocultar-display")

        // Si el chat ya está cargado y es el mismo, solo scroll
        const navChat = document.querySelector("#nav-principal-chat-usuario")
        if (navChat && navChat.dataset.id === id_chat) {
            hacer_scroll_a_archivo(id_archivo)
        } else {
            const lista_chats = await window.cuenta_usuario.getListaChats()

            //se mira usando los chats del usuario y no los participantes del grupo porque si es expulsado del grupo el usuario puede seguir viendo el chat hasta ese momento
            const chat_encontrado = lista_chats.find(chat => chat.id_chat === id_chat)
            if (!chat_encontrado) return; //no redireccionar porque el usuario no pertenece a ese chat

            // abrir_chat_item carga los mensajes, refresca DOM_CACHE y registra el scroll
            await abrir_chat_item(id_chat)

            // Pequeño delay para que los mensajes se rendericen en el DOM antes de hacer scroll
            setTimeout(() => hacer_scroll_a_archivo(id_archivo), 300)
        }
    })


    // Evento para descarga directa desde historial
    DOM_CACHE.lista_contenido_historial?.addEventListener("click", async (e) => {
        e.preventDefault()
        const btn = e.target.closest(".bt-descargar-directo-historial")
        if (!btn) return
        if (btn.disabled) return;
        btn.disabled = true;
        btn.style.opacity = "0.5";

        try {
            const { id, nombre, iv, tag, idChat, emisor, ratchet } = btn.dataset
            const ratchet_info = ratchet ? JSON.parse(decodeURIComponent(ratchet)) : null

            const resultado = await window.chats.DESCARGAR_ARCHIVO(id, nombre, iv, tag, idChat, ratchet_info, emisor)
            if (!resultado) {
                window.pushNotificacion({
                    prioridad: 1,
                    texto: `Fallo al cargar archivo: ${nombre}`,
                    tipo: "error"
                })
            } else {
                window.pushNotificacion({
                    prioridad: 1,
                    texto: `Archivo guardado en: ${resultado}`,
                    tipo: "success"
                })
                // Actualizar historial
                const [url_img] = await url_icono_extension_img(nombre.split(".").pop())
                await window.cache_archivos_descargados.setCacheArchivosDescargados({
                    id_chat: idChat,
                    id_archivo: id,
                    nombre,
                    url_img,
                    iv,
                    tag,
                    ratchet_info,
                    emisor_id: emisor,
                    fecha: new Date().toISOString()
                })
                crear_chat_historial_archivos_descargados()
            }
        } finally {
            btn.disabled = false;
            btn.style.opacity = "1";
        }
    })

    // Listener global para errores de imagen (fallback) - Evita inline handlers (CSP)
    DOM_CACHE.lista_contenido_historial?.addEventListener("error", (e) => {
        if (e.target.classList.contains("img-historial-archivo") && e.target.dataset.fallback) {
            e.target.src = e.target.dataset.fallback;
            delete e.target.dataset.fallback; // Evitar loop infinito
        }
    }, true);
}



function hacer_scroll_a_archivo(id_archivo) {
    if (!id_archivo) return

    // Buscar el elemento del archivo en el chat
    // En chat.js, los archivos tienen data-id="${archivo.id}"
    const selector = `.archivo-mensaje-div-archivos[data-id="${id_archivo}"]`
    const el_archivo = document.querySelector(selector)

    if (el_archivo) {
        el_archivo.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Efecto visual para resaltar
        el_archivo.style.backgroundColor = 'rgba(255, 255, 0, 0.3)'
        setTimeout(() => {
            el_archivo.style.backgroundColor = ''
        }, 2000)
    }
}