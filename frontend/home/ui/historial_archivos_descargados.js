
import { Encontrar_Nombre_Chat_Usuario, Crear_chat_html } from './chat.js'

export async function crear_chat_historial_archivos_descargados(){
    //obtener cache de archivos descargados
    const _cache_archivos_descargados = await window.cache_archivos_descargados.getCacheArchivosDescargados()
    
    const agrupar_chats = [] // [{ id_chat, nombre_chat, archivos: [{ nombre, url_img, descargas, id_archivo }] }]

    if(_cache_archivos_descargados && Array.isArray(_cache_archivos_descargados)){
        for(const entry of _cache_archivos_descargados){
            const { id_chat, nombre, url_img, id_archivo, iv, tag } = entry
            
            let chat_item = agrupar_chats.find(c => c.id_chat === id_chat)
            if(!chat_item){
                const nombre_chat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: id_chat })
                chat_item = {
                    id_chat,
                    nombre_chat,
                    archivos: []
                }
                agrupar_chats.push(chat_item)
            }

            let archivo_item = chat_item.archivos.find(a => a.nombre === nombre)
            if(!archivo_item){
                chat_item.archivos.push({
                    nombre,
                    url_img,
                    descargas: 1,
                    id_archivo,
                    iv,
                    tag
                })
            } else {
                archivo_item.descargas++
                archivo_item.iv = iv // Usar los datos de la última descarga
                archivo_item.tag = tag
            }
        }
    }
    
    let html=``
    if (agrupar_chats.length === 0) {
        html = `<div class="historial-vacio">No hay archivos descargados</div>`
    } else {
        for(const chat of agrupar_chats){
            html+=`
            <div class="chat-historial-bloque" data-id="${chat.id_chat}">
                <div class="chat-historial-header">
                    <span class="chat-historial-name">${chat.nombre_chat}</span>
                </div>
                <div class="chat-historial-archivos">
            `
            for (const archivo of chat.archivos) {
                html += `
                <div class="archivo-historial-wrap">
                    <div class="archivo-historial-item" data-id-archivo="${archivo.id_archivo}" data-id-chat="${chat.id_chat}">
                        <div class="archivo-info-historial">
                            <div class="archivo-info-historial-avatar">
                                <img src="${archivo.url_img}" alt="" onerror="this.src='../recursos/extensionesArchivos/cualquiera.svg'">
                            </div>
                            <div class="archivo-info-historial-details">
                                <span class="archivo-info-historial-name-text">${archivo.nombre}</span>
                                <span class="archivo-info-historial-descargas">${archivo.descargas > 1 ? `Descargado ${archivo.descargas} veces` : 'Descargado una vez'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="archivo-acciones-historial">
                        <button class="bt-descargar-directo-historial" 
                                data-id="${archivo.id_archivo}" 
                                data-nombre="${archivo.nombre}" 
                                data-iv="${archivo.iv || ''}" 
                                data-tag="${archivo.tag || ''}" 
                                data-id-chat="${chat.id_chat}" 
                                title="Volver a descargar">
                            <img src="../recursos/carpeta.svg" alt="Descargar">
                        </button>
                    </div>
                </div>
                `
            }
            html += `
                </div>
            </div>
            `
        }
    }

    const listaContenido = document.querySelector("#historial-lista-contenido")
    if (listaContenido) {
        listaContenido.innerHTML = html
    }

    crear_eventos()
}

function crear_eventos(){
    // Evento limpiar historial
    document.querySelector("#bt-limpiar-historial-completo")?.addEventListener("click", async (e) => {
        e.preventDefault()
        await window.cache_archivos_descargados.setCacheArchivosDescargados()
        crear_chat_historial_archivos_descargados()
    })

    // Click en un archivo para volver al chat
    document.querySelectorAll(".archivo-historial-item").forEach(el=>{
        el.addEventListener("click", async (e)=>{
            e.preventDefault()
            const id_chat = el.dataset.idChat
            const id_archivo = el.dataset.idArchivo
            
            // Ocultar historial, mostrar chat
            document.querySelector("#seccion-historial-archivos").classList.add("ocultar-display")
            const chatUsuario = document.querySelector("#chat-usuario")
            chatUsuario.classList.remove("ocultar-display")
            const infoChatSeccion = document.querySelector("#info-chat-seccion")
            if (infoChatSeccion) infoChatSeccion.classList.remove("ocultar-display")

            // Si el chat ya está cargado y es el mismo, solo scroll
            const navChat = document.querySelector("#nav-prinicpal-chat-usaurio")
            if (navChat && navChat.dataset.id === id_chat) {
                hacer_scroll_a_archivo(id_archivo)
            } else {
                const [datos_chat, id_usuario] = await Promise.all([
                    window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat),
                    window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
                ])
                datos_chat._id = id_chat
                chatUsuario.innerHTML = await Crear_chat_html(datos_chat, id_usuario)
                hacer_scroll_a_archivo(id_archivo)
            }
        })  
    })

    // Evento para descarga directa desde historial
    document.querySelectorAll(".bt-descargar-directo-historial").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault()
            const { id, nombre, iv, tag, idChat } = btn.dataset
            
            const resultado = await window.chats.DESCARGAR_ARCHIVO(id, nombre, iv, tag, idChat)
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
                // Actualizar historial (para que se cuente la descarga si el cache se actualiza)
                // Nota: el cache se actualiza en el listener de descarga de renderer.js, pero ese listener está vinculado a los elementos del chat.
                // Aquí deberíamos actualizarlo manualmente si queremos que aparezca en el historial de inmediato.
                const [url_img] = await url_icono_extension_img(nombre.split(".").pop())
                await window.cache_archivos_descargados.setCacheArchivosDescargados({
                    id_chat: idChat,
                    id_archivo: id,
                    nombre,
                    url_img,
                    iv,
                    tag,
                    fecha: new Date().toISOString()
                })
                crear_chat_historial_archivos_descargados()
            }
        })
    })
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