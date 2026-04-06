import { url_icono_extension_img } from './url_icono_extensiones_archivos.js'
import { invalidar_cache_historial } from './chat.js'

export async function manejar_descarga_archivo(e) {
    const el = e.target.closest(".archivo-mensaje-div-archivos")
    if (!el) return

    e.preventDefault()
    const id_archivo = el.dataset.id
    const nombre_archivo = el.dataset.nombre
    const iv = el.dataset.iv
    const tag = el.dataset.tag
    const emisor_id = el.dataset.emisor
    const ratchet_info = el.dataset.ratchet ? JSON.parse(decodeURIComponent(el.dataset.ratchet)) : null
    const id_chat = document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id
    
    const resultado = await window.chats.DESCARGAR_ARCHIVO(id_archivo, nombre_archivo, iv, tag, id_chat, ratchet_info, emisor_id)
    
    if (!resultado) {
        window.pushNotificacion({ prioridad: 1, texto: `Fallo al cargar archivo: ${nombre_archivo}`, tipo: "error" })
    } else {
        const extension = nombre_archivo.includes(".") ? nombre_archivo.split(".").pop() : "txt"
        const [url_img] = await url_icono_extension_img(extension)
        await window.cache_archivos_descargados.setCacheArchivosDescargados({
            id_chat, id_archivo, nombre: nombre_archivo, url_img, iv, tag, ratchet_info, emisor_id, fecha: new Date().toISOString()
        })
        invalidar_cache_historial()
    }
}
