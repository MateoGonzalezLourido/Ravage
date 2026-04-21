import { url_icono_extension_img } from './url_icono_extensiones_archivos.js'
import { escapeHTML } from './seguridad_ui.js';
import { cache_archivos_adjuntos, establecer_cache_archivos_adjuntos } from '../caches_datos.js';


export function limpiar_archivos_mensaje() {
    establecer_cache_archivos_adjuntos([]);
}

export function obtener_archivos_mensaje() {
    return [...cache_archivos_adjuntos];
}

export async function render_html_lista_archivos() {
    const html = []
    //crear una cache que ayude a renderizar mas rapido
    const cache_propia_url_iconos = {}
    let guardados = 0
    for (let i = 0; i < cache_archivos_adjuntos.length; i++) {
        const activo = cache_archivos_adjuntos[i]
        let [url, idn] = [cache_propia_url_iconos[activo.extension] || null, true]
        if (!url) {
            [url, idn] = await url_icono_extension_img(activo.extension)
            cache_propia_url_iconos[activo.extension] = url
            guardados++
        }
        //borrar ultimo si guardados>=200
        if (guardados >= 200) {
            delete cache_propia_url_iconos[Object.keys(cache_propia_url_iconos)[0]]
            guardados--
        }
        html.push(`
        <div data-indice="${i}" class="info-chat-participante-item ventana-archivos-mensaje-cuerpo-componente-item">
            <div class="info-chat-participante-info ventana-archivos-mensaje-cuerpo-componente-item-nombre">
                <div class="contenido-item-archivo-lista" style="display: flex; align-items: center; gap: 10px;">
                    <img draggable="false" src="${url}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: contain;">
                    <span class="info-chat-participante-nombre">${idn ? escapeHTML(activo.nombre) : escapeHTML(activo.nombre) + "." + escapeHTML(activo.extension)}</span>
                </div>

            </div>
        </div>`)
    }
    return html.join("")
}

export async function actualizar_html_lista_archivos() {
    const contenedor = document.querySelector(".ventana-archivos-mensaje-cuerpo-componente")
    if (contenedor) contenedor.innerHTML = await render_html_lista_archivos()
}

export async function abrir_ventana_archivos() {
    if (document.querySelector(".ventana-archivos-mensaje")) return cerrar_ventana_archivos()

    const html_lista = await render_html_lista_archivos()
    const ventana = document.createElement("div")
    ventana.className = "ventana-archivos-mensaje"
    ventana.innerHTML = `
        <div class="info-chat-contenedor-fijo">
            <div class="info-chat-header">
                <div id="bt-cerrar-archivos-mensaje" class="bt-cerrar-archivos-header"><img src="../recursos/cruz.png"></div>
                <div> <span>Archivos Adjuntos</span></div>
                <div id="bt-añadir-archivos-mensaje-escritura" class="bt-accion-archivos" title="añadir archivo"><img src="../recursos/suma.png"></div>
                <div id="bt-limpiar-archivos-mensaje-escritura" class="bt-accion-archivos bt-accion-archivos-peligro"><img src="../recursos/escoba.png"></div>
            </div>
            <div class="info-chat-cuerpo ventana-archivos-mensaje-cuerpo">
                <div class="info-chat-lista-participantes ventana-archivos-mensaje-cuerpo-componente">${html_lista}</div>
            </div>
        </div>`

    ventana.classList.add("panel-lateral-ajustable")
    ventana.style.width = "0"
    document.querySelector(".seccion-cuerpo-chat").appendChild(ventana)

    // Ocultar modal info si existe
    const infoSec = document.querySelector("#info-chat-seccion")
    if (infoSec && infoSec.classList.contains("abierto")) {
        // Animación simultánea: cerramos info mientras abrimos archivos
        infoSec.classList.remove("abierto")
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
        ventana.style.width = "" // Permitir que CSS controle el ancho (350px en .abierto)
        ventana.classList.add("abierto")
        
        const cuerpoChat = document.querySelector(".seccion-cuerpo-chat")
        if (cuerpoChat) cuerpoChat.classList.add("panel-lateral-abierto")
    }))
}

export function cerrar_ventana_archivos() {
    const ven = document.querySelector(".ventana-archivos-mensaje")
    if (ven) {
        ven.classList.remove("abierto")
        
        // Solo quitamos la clase de ajuste de chat si NO hay otros paneles abiertos (como info)
        const infoSec = document.querySelector("#info-chat-seccion")
        const algunOtroAbierto = infoSec && infoSec.classList.contains("abierto")
        
        if (!algunOtroAbierto) {
            const cuerpoChat = document.querySelector(".seccion-cuerpo-chat")
            if (cuerpoChat) cuerpoChat.classList.remove("panel-lateral-abierto")
        }
        
        setTimeout(() => ven.remove(), 310)
    }
}

export async function añadir_archivos_dialogo() {
    const archivos = await window.chats.SELECCIONAR_ARCHIVOS()
    for (const activo of archivos) {
        const est = activo.includes('\\') ? activo.split('\\') : activo.split('/')
        const fn = est[est.length - 1]
        let parts = fn.split('.'), ext = parts.length > 1 ? parts.pop() : "txt", no = parts.join('.')
        if (!(await window.validadores.VALIDAR_NOMBRE_ARCHIVO(no))) no = "Archivo"
        if (!(await window.validadores.VALIDAR_NOMBRE_ARCHIVO(ext))) ext = "txt"
        cache_archivos_adjuntos.push({ nombre: no, extension: ext, ruta: activo })
    }
    actualizar_html_lista_archivos()
}

export function mostrar_menu_contextual_archivo(e, clkNode) {
    document.querySelector(".context-menu")?.remove()
    const indice = clkNode.dataset.indice
    const archivo = cache_archivos_adjuntos[indice]
    if (!archivo) return;

    const mx = `
        <div class="context-menu" style="position: fixed; z-index: 1000;">
            <div class="context-menu-item" data-action="borrar">Borrar</div>
            <div class="context-menu-item" data-action="editar">Editar Nombre</div>
        </div>`
    document.body.insertAdjacentHTML("beforeend", mx)

    const menu = document.querySelector(".context-menu")
    menu.style.left = e.clientX + "px"; menu.style.top = e.clientY + "px";

    const cr = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", cr) } }
    setTimeout(() => document.addEventListener("mousedown", cr), 0)

    menu.addEventListener("click", (ev) => {
        const acc = ev.target.dataset.action
        if (acc === "borrar") {
            cache_archivos_adjuntos.splice(indice, 1)
            actualizar_html_lista_archivos()
        } else if (acc === "editar") {
            // Edición inline simplificada
            const span = clkNode.querySelector("span")
            span.style.display = "none"
            const tx = document.createElement("input")
            tx.className = "seccion-cambiar-nombre-archivo-mensaje"
            tx.value = archivo.nombre
            tx.addEventListener("keypress", async (evt) => {
                if (evt.key === "Enter") {
                    let nn = tx.value.trim()
                    if (!(await window.validadores.VALIDAR_NOMBRE_ARCHIVO(nn))) nn = "Archivo"
                    archivo.nombre = nn
                    actualizar_html_lista_archivos()
                }
            })
            tx.addEventListener("blur", () => {
                // Si pulsa fuera (blur), se cancela la edición restaurando el HTML original
                actualizar_html_lista_archivos()
            })
            clkNode.querySelector(".contenido-item-archivo-lista").appendChild(tx)
            tx.focus()
        }
        menu.remove()
    })
}
