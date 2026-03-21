//importar componentes js
import { desplegar_menu_añadir_chat } from './ui/añadir_chats_usuarios.js'
import { url_icono_extension_img } from './ui/url_icono_extensiones_archivos.js'
import { chat_componente_lista_estructura_html, crear_mensaje_html, Crear_chat_html, mostrar_datos_chat_usaurios, Encontrar_Nombre_Chat_Usuario,Es_usuario_Sesion, texto_mostrar_fecha_mensajes_bloque } from './ui/chat.js'
import { Todos_Los_Eventos_Funciones_Ajustes } from './ui/ajustes.js'
import { crear_chat_historial_archivos_descargados, invalidar_cache_historial } from './ui/historial_archivos_descargados.js'

let archivos_mensaje = []//{ruta,nombre,extension}
let archivo_cambiando_nombre; //es para guardar el archivo que se esta editando ya
//chat

function cerrar_paneles_al_abrir_chat() {
    // Cerrar #info-chat-seccion si está abierto
    const infoSeccion = document.querySelector("#info-chat-seccion")
    if (infoSeccion && infoSeccion.classList.contains("abierto")) {
        infoSeccion.classList.remove("abierto")
    }
    // Cerrar .ventana-archivos-mensaje si está abierta
    const ventanaArchivos = document.querySelector(".ventana-archivos-mensaje")
    if (ventanaArchivos) {
        ventanaArchivos.classList.remove("abierto")
        setTimeout(() => ventanaArchivos.remove(), 310)
    }
}
function scroll_fin_chat() {
    document.querySelector("#cuerpo-mensajes-chat").scrollTo({
        top: document.querySelector("#cuerpo-mensajes-chat").scrollHeight,
        behavior: "smooth"
    })
}
async function ACTUALIZAR_LISTAS_CHAT(filtro = "") {
    try {
        archivo_cambiando_nombre = null
        const [lista_chats, lista_contactos] = await Promise.all([
            window.chats.OBTENER_CHATS_USUARIO(),
            window.social_usuario.OBTENER_CONTACTOS_USUARIO()
        ])
        window.chats.LIMPIAR_MENSAJES_CHATS_ANTIGUOS(lista_chats)//!importante: esto hay que hacerlo asincrono porque puede tardar mucho, no importa que el usaurio pueda ver mensajes de hace un año, esto se hace para limpiar el DB

        const [datos_chats_grupales, id_propio] = await Promise.all([
            window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: lista_chats, grupales: null, mensajes: false }),
            window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
        ])

        //crear html lista chats
        const map_grupales = {}
        if (Array.isArray(datos_chats_grupales)) {
            datos_chats_grupales.forEach(chat => {
                if (chat) map_grupales[chat.id || chat._id] = chat
            })
        }

        // ORDENAR LOS CHATS POR ULTIMO CAMBIO (El más reciente arriba)
        const lista_chats_ordenada = [...lista_chats].sort((a, b) => {
            return new Date(b.ultimoCambio) - new Date(a.ultimoCambio)
        })

        // Filtrar por concordancia de nombre si hay filtro
        const lista_filtrada = filtro 
            ? lista_chats_ordenada.filter(c => {
                const chatEx = map_grupales[c.id] || {}
                const nombre = chatEx.nombre || "Chat sin nombre"
                return nombre.toLowerCase().includes(filtro.toLowerCase())
            })
            : lista_chats_ordenada

        const html = lista_filtrada
            .map(c => {
                const chatEx = map_grupales[c.id] || {}
                const nombre = chatEx.nombre || "Chat sin nombre"
                const datos_usar = { id: c.id, ultimoCambio: c.ultimoCambio, usuarios: chatEx.usuarios || [], nombre: nombre, ultimomensaje: c.ultimomensaje }
                return chat_componente_lista_estructura_html(datos_usar)
            })
            .join("")

        document.querySelector("#lista-chats-componentes").innerHTML = html
        
        //eventos doom
        document.querySelectorAll(".chat-componente-lista-chats").forEach(componente => {
            componente.addEventListener("click", async (e) => {
                e.preventDefault()
                // OBTENER LA INFORMACION DEL CHAT Y CREAR EL CHAT EN EL HTML 
                const id = e.currentTarget.dataset.id
                //obtener info de ese chat
                //TODO: AÑADIR METODO DE GUARDADO EN CACHE DE ALGUNOS CHATS USADOS
                const [datos_chat, id_usuario] = await Promise.all([
                    window.chats.OBTENER_DATOS_CHAT_UNICO(id),
                    window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
                ])

                // El nombre ya viene resuelto por el backend
                datos_chat._id = id
                //limpiar residuos de otros chats
                archivos_mensaje = []
                document.querySelector("#chat-usuario").innerHTML = await Crear_chat_html(datos_chat, id_usuario)
                //cerrar paneles laterales si están abiertos
                cerrar_paneles_al_abrir_chat()

                // Eventos de botones de solicitud (añadir usuario a chat de 2)
                document.querySelectorAll(".bt-solicitud-aceptar, .bt-solicitud-rechazar").forEach(btn => {
                    btn.addEventListener("click", async (ev) => {
                        ev.preventDefault()
                        const id_chat_sol = ev.target.dataset.chat
                        const id_mensaje_sol = ev.target.dataset.mensaje
                        const aceptar = ev.target.classList.contains("bt-solicitud-aceptar")

                        // Deshabilitar botones para evitar doble click
                        const contenedor_botones = ev.target.closest(".solicitud-botones")
                        if (contenedor_botones) contenedor_botones.querySelectorAll("button").forEach(b => b.disabled = true)

                        const resultado = await window.chats.RESPONDER_SOLICITUD_AÑADIR(id_chat_sol, id_mensaje_sol, aceptar)
                        if (resultado?.success) {
                            window.pushNotificacion({
                                prioridad: 1,
                                texto: aceptar ? "Usuario añadido al chat" : "Solicitud rechazada",
                                tipo: aceptar ? "success" : "info"
                            })
                            // Recargar el chat y la lista
                            await ACTUALIZAR_LISTAS_CHAT()
                            const [datos_chat_nuevo, id_usr] = await Promise.all([
                                window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat_sol),
                                window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
                            ])
                            datos_chat_nuevo._id = id_chat_sol
                            document.querySelector("#chat-usuario").innerHTML = await Crear_chat_html(datos_chat_nuevo, id_usr)
                        } else {
                            window.pushNotificacion({
                                prioridad: 0,
                                texto: resultado?.message || "Error al procesar la solicitud",
                                tipo: "error"
                            })
                            // Rehabilitar botones
                            if (contenedor_botones) contenedor_botones.querySelectorAll("button").forEach(b => b.disabled = false)
                        }
                    })
                })

                //scroll al final
                scroll_fin_chat()
                //otros eventos
                document.querySelector("#nav-prinicpal-chat-usaurio")?.addEventListener("click", mostrar_datos_chat_usaurios)
                //cambio altura del textarea del mensaje , segun lo grande que sea el mensaje, para facilitar su lectura y escritura
                const textarea_msg = document.querySelector("#textarea-mensaje-escritura")
                if (textarea_msg) {
                    // Crecimiento dinámico
                    textarea_msg.addEventListener("input", function () {
                        if (this.value.length > 1000) {
                            this.value = this.value.substring(0, 1000);
                        }
                        this.style.height = "38px" // Vuelve al tamaño mínimo base para recalcular la caída recta
                        this.style.height = (this.scrollHeight) + "px"
                    })

                    textarea_msg.addEventListener("keypress", async (e) => {
                        // Enviar con Enter, pero permitir salto de línea con Shift+Enter
                        if (e.key == "Enter" && !e.shiftKey) {
                            e.preventDefault() // Evitar salto de línea artificial al enviar
                            const mensaje = textarea_msg.value.trim()
                            const id_chat = document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id
                            const id_usuario = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()

                            // Si el mensaje está vacío y no hay archivos, evitar enviar nada
                            if (!mensaje && archivos_mensaje.length === 0) return;

                            // Validar mensaje antes de enviar
                        const esValido = await window.validadores.VALIDAR_MENSAJE(mensaje)
                        if (!esValido && archivos_mensaje.length === 0) {
                            window.pushNotificacion({ PRIORIDAD: 2, texto: "Mensaje no válido", tipo: "info" })
                            return;
                        }

                        const result = await window.chats.ENVIAR_MENSAJE({ asunto: mensaje, archivos: archivos_mensaje, id_chat: id_chat, id_emisor: id_usuario })
                            if (result) {//limpiar seccion mensaje escritura
                                const copia_archivos = archivos_mensaje
                                archivos_mensaje = []
                                textarea_msg.value = ""
                                textarea_msg.style.height = "38px" // Restaurar tamaño original base
                                document.querySelectorAll(".ventana-archivos-mensaje").forEach(x => x.remove())

                                //reactualizar chat (render)
                                await Actualizar_render_chat({ emisor: id_usuario.toString(), chat: id_chat, mensaje: mensaje, archivos: copia_archivos, fecha: new Date().toISOString() })
                            }
                        }
                    })
                }
                //guardar archivos(al hacer click mostrar una ventana para subir archivos)
                document.querySelector("#bt-añadir-archivo-mensaje-escritura")?.addEventListener("click", async () => {
                    //si existe cerrarla con animación
                    const existente = document.querySelector(".ventana-archivos-mensaje")
                    if (existente) {
                        existente.classList.remove("abierto")
                        setTimeout(() => existente.remove(), 310)
                        return;
                    }
                    //crear ventana
                    async function mostrar_lista_archivos(archivos) {
                        let html = ``
                        for (const archivo of archivos) {
                            const [url, identificado] = await url_icono_extension_img(archivo.extension)

                            html += `
                            <div class="info-chat-participante-item ventana-archivos-mensaje-cuerpo-cuerpo-item">
                                <div data-indice="${archivos.indexOf(archivo)}" class="info-chat-participante-info ventana-archivos-mensaje-cuerpo-cuerpo-item-nombre">
                                    <div class="contenido-item-archivo-lista" style="display: flex; align-items: center; gap: 10px;">
                                        <img draggable="false" src="${url}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: contain;">
                                        <span class="info-chat-participante-nombre">${identificado ? archivo.nombre : archivo.nombre + "." + archivo.extension}</span>
                                    </div>
                                </div>
                            </div>
                            `
                        }
                        return html
                    }
                    const html_lista_archivos = await mostrar_lista_archivos(archivos_mensaje)
                    const ventana = document.createElement("div")
                    ventana.className = "ventana-archivos-mensaje"
                    // HTML Structure mimicking #info-chat-seccion
                    ventana.innerHTML = `
                    <div class="info-chat-header">
                        <div id="bt-cerrar-archivos-mensaje" class="bt-cerrar-archivos-header">
                            <img src="../recursos/cruz.png" alt="cerrar">
                        </div>
                        <div> <span>Archivos Adjuntos</span></div>
                        <div id="bt-añadir-archivos-mensaje-escritura" class="bt-accion-archivos"title="añadir-archivo">
                            <img src="../recursos/suma.png" alt="añadir">
                        </div>
                        <div  id="bt-limpiar-archivos-mensaje-escritura" class="bt-accion-archivos bt-accion-archivos-peligro">
                            <img src="../recursos/escoba.png" alt="limpiar">
                        </div>
                    </div>
                    
                    <div class="info-chat-cuerpo ventana-archivos-mensaje-cuerpo">
                        <div class="info-chat-lista-participantes ventana-archivos-mensaje-cuerpo-cuerpo">
                            ${html_lista_archivos}
                        </div>
                    </div>`

                    // Insertar en DOM con transición y ancho bloqueados en inline style
                    ventana.style.transition = "none"
                    ventana.style.width = "0"
                    document.querySelector(".seccion-cuerpo-chat").appendChild(ventana)

                    // Cerrar el panel de info si está abierto (snap sin animación)
                    const infoSeccion = document.querySelector("#info-chat-seccion")
                    if (infoSeccion && infoSeccion.classList.contains("abierto")) {
                        infoSeccion.style.transition = "none"
                        infoSeccion.classList.remove("abierto")
                        infoSeccion.style.width = "0"
                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            infoSeccion.style.transition = ""
                            infoSeccion.style.width = "" // Limpiar inline para que el CSS controle
                        }))
                    }

                    // Doble rAF: el navegador pinta a width:0, luego borramos los
                    // inline styles y añadimos .abierto para que la transición CSS anime a 350px
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            ventana.style.transition = ""
                            ventana.style.width = ""  // CLAVE: limpiar inline, la clase .abierto ya define 350px
                            ventana.classList.add("abierto")
                        })
                    })

                    // Event to close this menu
                    document.querySelector("#bt-cerrar-archivos-mensaje").addEventListener("click", () => {
                        ventana.classList.remove("abierto")
                        setTimeout(() => ventana.remove(), 310)
                    })
                    //eventos
                    //contextmenu de cada archivo(borrar, editar nombre/extension)
                    document.querySelectorAll(".ventana-archivos-mensaje-cuerpo-cuerpo").forEach(el => {
                        el.addEventListener("click", (e) => {
                            e.preventDefault()

                            // Obtener el item específico clicado para sacar su índice y el elemento del DOM
                            const itemClicado = e.target.closest(".ventana-archivos-mensaje-cuerpo-cuerpo-item-nombre")
                            if (!itemClicado) return

                            const indice = itemClicado.dataset.indice
                            const archivo = archivos_mensaje[indice]

                            if (!archivo) {
                                //marcarlo en rojo para que el usuario vea que esta fallando ese archivo
                                itemClicado.style.color = "orange"
                                itemClicado.style.fontStyle = "italic"
                                itemClicado.style.textDecoration = "line-through";
                                return;
                            }

                            // Eliminar menú previo si existe para evitar duplicados
                            document.querySelector(".context-menu")?.remove()

                            const html_contextMenu = `
                                <div class="context-menu" style="position: fixed; z-index: 1000;">
                                    <div class="context-menu-item" data-action="borrar"> Borrar</div>
                                    <div class="context-menu-item" data-action="editar">Editar</div>
                                </div>
                            `

                            const ventanaContenedor = document.querySelector(".ventana-archivos-mensaje")
                            ventanaContenedor.insertAdjacentHTML("beforeend", html_contextMenu)

                            const menu = ventanaContenedor.querySelector(".context-menu")
                            if (menu) {
                                menu.style.left = e.clientX + "px"
                                menu.style.top = e.clientY + "px"

                                // Cerrar al hacer click fuera
                                const cerrarMenuClickFuera = (event) => {
                                    if (!menu.contains(event.target)) {
                                        menu.remove()
                                        document.removeEventListener("mousedown", cerrarMenuClickFuera)
                                    }
                                }
                                document.addEventListener("mousedown", cerrarMenuClickFuera)
                            }

                            menu.addEventListener("click", (ev) => {
                                const action = ev.target.dataset.action
                                if (action === "borrar") {
                                    //borar de la lista de datos
                                    archivos_mensaje.splice(indice, 1)
                                    //borrar del html (el item padre)
                                    itemClicado.closest(".ventana-archivos-mensaje-cuerpo-cuerpo-item").remove()
                                    //actualizar indices
                                    let indice_actual = -1
                                    for (el_item of document.querySelectorAll(".ventana-archivos-mensaje-cuerpo-cuerpo-item-nombre")) {
                                        indice_actual++
                                        if (indice_actual >= indice) {
                                            el_item.dataset.indice = indice_actual
                                        }
                                    }
                                }
                                else if (action === "editar") { //editar nombre/extension
                                    const name_textarea_class = "seccion-cambiar-nombre-archivo-mensaje"

                                    // Si ya hay uno editándose en otro lado, lo cerramos
                                    if (archivo_cambiando_nombre) {
                                        const prevTextarea = document.querySelector(`.${name_textarea_class}`)
                                        if (prevTextarea) {
                                            const nuevoNombre = prevTextarea.value.trim()
                                            const prevIndice = archivo_cambiando_nombre.dataset.indice
                                            if (archivos_mensaje[prevIndice]) archivos_mensaje[prevIndice].nombre = nuevoNombre

                                            const span = archivo_cambiando_nombre.querySelector("span")
                                            if (span) {
                                                span.innerHTML = nuevoNombre
                                                span.style.display = "flex"
                                            }
                                            prevTextarea.remove()
                                        }
                                    }

                                    // Guardar el item actual que se está editando
                                    archivo_cambiando_nombre = itemClicado

                                    const spanActual = itemClicado.querySelector("span")
                                    if (spanActual) spanActual.style.display = "none"

                                    const textarea = document.createElement("textarea")
                                    textarea.className = name_textarea_class
                                    textarea.value = archivo.nombre
                                    itemClicado.querySelector(".contenido-item-archivo-lista").appendChild(textarea)
                                    textarea.focus()
                                    textarea.addEventListener("keypress", async (event) => {
                                        if (event.key == "Enter" && !event.shiftKey) {
                                            event.preventDefault()
                                            let nombre_nuevo = textarea.value.trim()
                                            
                                            // Regla especial de archivo
                                            const esNombreValido = await window.validadores.VALIDAR_NOMBRE_ARCHIVO(nombre_nuevo)
                                            if (!esNombreValido) {
                                                nombre_nuevo = "Archivo"
                                            }

                                            archivo.nombre = nombre_nuevo
                                            if (spanActual) {
                                                spanActual.innerHTML = nombre_nuevo
                                                spanActual.style.display = "flex"
                                            }
                                            textarea.remove()
                                            archivo_cambiando_nombre = null
                                        }
                                    })
                                }
                                menu.remove()
                            })
                        })
                    })

                    //añadir archivos
                    document.querySelector("#bt-añadir-archivos-mensaje-escritura").addEventListener("click", async () => {
                        const archivos = await window.chats.SELECCIONAR_ARCHIVOS()//[ruta]
                        //añadir archivos a la lista
                        for (const archivo of archivos) {
                            try {
                                const estructura = archivo.includes('\\') ? archivo.split('\\') : archivo.split('/')
                                const fullFilename = estructura[estructura.length - 1]
                                let parts = fullFilename.split('.')
                                let extension = parts.length > 1 ? parts.pop() : "txt"
                                let nombre = parts.join('.')

                                // Validaciones y reglas especiales
                                if (!(await window.validadores.VALIDAR_NOMBRE_ARCHIVO(nombre))) {
                                    nombre = "Archivo"
                                }
                                if (!(await window.validadores.VALIDAR_NOMBRE_ARCHIVO(extension))) { // Reutilizamos el validador de nombre para la extensión
                                    extension = "txt"
                                }

                                archivos_mensaje.push({
                                    nombre: nombre,
                                    extension: extension,
                                    ruta: archivo
                                })
                            }
                            catch (e) {// MOSTRAR ERROR PANTALLA
                                console.error(e)
                                window.pushNotificacion({
                                    prioridad: 1,        // menor número = más importante
                                    texto: `Error al añadir archivo${archivo.nombre + archivo.extension} \nRuta: ${archivo.ruta} `,
                                    tipo: "error"      // "info", "error", "success"
                                })
                            }
                        }
                        //actualizar vista seccion archivos
                        document.querySelector(".ventana-archivos-mensaje-cuerpo-cuerpo").innerHTML = await mostrar_lista_archivos(archivos_mensaje)
                    })
                    //limpiar arhivos
                    document.querySelector("#bt-limpiar-archivos-mensaje-escritura").addEventListener("click", async () => {
                        archivos_mensaje = []//limpiar
                        //actualziar seccion
                        document.querySelector(".ventana-archivos-mensaje-cuerpo-cuerpo").innerHTML = await mostrar_lista_archivos(archivos_mensaje)
                    })
                })
                //descargar archivos mensaje
                document.querySelectorAll(".archivo-mensaje-div-archivos").forEach(el => {
                    el.addEventListener("click", async (e) => {
                        e.preventDefault()
                        // COJER ID DEL ARCHIVO, PEDIR A MONGO LOS DATOS DE ESE ARCHIVO Y GUARDARLO EN LA UBICACION ESTABLECIDA
                        const id_archivo = el.dataset.id
                        const nombre_archivo = el.dataset.nombre
                        const iv = el.dataset.iv
                        const tag = el.dataset.tag
                        const id_chat = document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id
                        const resultado = await window.chats.DESCARGAR_ARCHIVO(id_archivo, nombre_archivo, iv, tag, id_chat)
                        if (!resultado) {// fallo al descargar:notificar
                            window.pushNotificacion({
                                prioridad: 1,        // menor número = más importante
                                texto: `Fallo al cargar archivo: ${nombre_archivo}`,
                                tipo: "error"
                            })
                        } else {
                            window.pushNotificacion({
                                prioridad: 1,        // menor número = más importante
                                texto: `Descarga completa: ${nombre_archivo}`,
                                tipo: "success"
                            })
                            // AÑADIR AL CACHE DE ARCHIVOS DESCARGADOS
                            const extension = nombre_archivo.includes(".") ? nombre_archivo.split(".").pop() : "txt"
                            const [url_img] = await url_icono_extension_img(extension)
                            await window.cache_archivos_descargados.setCacheArchivosDescargados({
                                id_chat,
                                id_archivo,
                                nombre: nombre_archivo,
                                url_img,
                                iv,
                                tag,
                                fecha: new Date().toISOString()
                            })
                            invalidar_cache_historial()
                        }
                    })
                })
            })
        })
    }
    catch (e) {
        throw e
    }
}

async function Actualizar_render_chat({ emisor, chat, mensaje = "", archivos = [], fecha, especial = null, data = {} }) {
    //chat, emisor son ids
    //el chat abierto es el del mensaje ?
    if (document.querySelector("#chat-usuario") && document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == chat) {
        const [nombres_contactos, id_propio] = await Promise.all([
            window.social_usuario.OBTENER_CONTACTOS_USUARIO(),
            window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
        ])

        const id_emisor = Array.isArray(emisor) ? emisor[0]?.toString() : emisor?.toString()
        const propio = id_emisor == id_propio.toString()
        const nombre_emisor = await Encontrar_Nombre_Chat_Usuario({ id_buscar: id_emisor, grupal: false, contactos: nombres_contactos })

        // Verificar si el emisor es admin en este chat (solo para grupos > 2)
        const info_chat = await window.chats.OBTENER_DATOS_CHAT_UNICO(chat);
        const esAdmin = info_chat?.usuarios?.length > 2 && info_chat?.admins?.some(admin_id => admin_id.toString() === id_emisor.toString());

        //crear mensaje
        const html = await crear_mensaje_html(fecha, mensaje, archivos, propio, nombre_emisor, esAdmin)
        
        const chatContainer = document.querySelector("#cuerpo-mensajes-chat");
        const lastBlock = chatContainer.querySelector(".bloque-dia-chat:last-child");
        const fechaActualText = texto_mostrar_fecha_mensajes_bloque(new Date(fecha));

        let lastBlockDateText = lastBlock ? lastBlock.querySelector(".fecha-bloque-mensajes span")?.innerHTML : null;
        
        if (!lastBlock || lastBlockDateText !== fechaActualText) {
            // crear nuevo bloque  y añadir ahi
            const nuevoBloqueHTML = `
                <div class="bloque-dia-chat">
                    <div class="fecha-bloque-mensajes"><span>${fechaActualText}</span></div>
                    ${html}
                </div>
            `;
            chatContainer.insertAdjacentHTML("beforeend", nuevoBloqueHTML);
        } else {
            // añadir mensaje al bloque ya existente
            lastBlock.insertAdjacentHTML("beforeend", html);
        }
        scroll_fin_chat()
    }
    else {
        console.log("dasda")
    }
}

async function INICIO_CHAT_MENU_PRINCIPAL() {
    try {
        await ACTUALIZAR_LISTAS_CHAT()
    }
    catch (e) {
        throw e
    }
}

async function refrescar_componente_lista_chats(id_chat, componente, notificacion = false) {
    try {
        // Obtener datos globales del chat (nombre, usuarios, etc)
        // El usuario pide usar obtener_datos_chats (vía bridge OBTENER_DATOS_CHATS_GRUPALES)
        const [info_chats, lista_usuario, id_propio, lista_contactos] = await Promise.all([
            window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: [{ id: id_chat }], grupales: null, mensajes: false }),
            window.chats.OBTENER_CHATS_USUARIO(),
            window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO(),
            window.social_usuario.OBTENER_CONTACTOS_USUARIO()
        ])

        const info_chat = info_chats[0]
        if (!info_chat) return

        // Obtener la entrada específica de este chat para el usuario (ultimoCambio, ultimomensaje)
        const chat_usuario = lista_usuario.find(c => (c.id || c._id) == id_chat)

        // Construir objeto de datos para la estructura HTML
        const datos_usar = {
            id: id_chat,
            ultimoCambio: chat_usuario?.ultimoCambio,
            usuarios: info_chat.usuarios,
            nombre: info_chat.nombre, // Ya viene resuelto por el backend
            ultimomensaje: chat_usuario?.ultimomensaje
        }

        // Generar el nuevo HTML
        const html_nuevo = chat_componente_lista_estructura_html(datos_usar)

        // Actualizar el componente existente sin perder la referencia (para no perder el event listener)
        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = html_nuevo
        const contenido_nuevo = tempDiv.firstElementChild.innerHTML

        componente.innerHTML = contenido_nuevo

        // Si hay notificación, podemos añadir una clase visual (ej: brillo o punto azul)
        if (notificacion) {
            componente.classList.add("nuevo-mensaje-notificacion")
            // Opcional: quitar la clase tras unos segundos o al hacer click
        }

    } catch (e) {
        console.error("Error al refrescar componente de chat:", e)
    }
}



//buzon api
//realizar cambios en la app segun la entrada del buzon
async function hacer_cambios_buzon(entrada) {
    //TODO: CAMBIO DE NOMBRE CHATGRUPO, AÑADIDO USUARIO A UN GRUPO, ELIMINADO USUARIO DE UN CHAT, MENSAJE ACTUALIZAR APP
    const tp = Number(entrada.tipo)
    if (tp === 0) { //mensaje chat
        /*Mirar si el usuario tiene abierto ese chat:
        si es asi actualizar chat
        sino mostrar notificacion e icono en el componente de la lista de chats de ese chat */
        /*entrada= { tipo, data: { id_chat, id_mensaje }}*/
        if (document.querySelector("#chat-usuario") && document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == entrada.data.chat) {
            const respuesta = await window.chats.OBTENER_DATOS_MENSAJE(entrada.data.chat, entrada.data.id_mensaje)
            console.log([entrada, respuesta])

            //actualizar chat
            await Actualizar_render_chat({
                emisor: respuesta.emisor,
                chat: entrada.data.chat,
                mensaje: respuesta.contenido?.[0]?.asunto || "",
                archivos: respuesta.contenido?.[0]?.archivos || [],
                fecha: respuesta.data
            })
        }
        else {
            //cojer nombre del chat
            for (const chatC of document.querySelectorAll(".chat-componente-lista-chats")) {
                if (chatC.dataset.id == entrada.chat) {
                    const nombre = chatC.querySelector(".nombre-chat-lista-componente span").textContent
                    //refrescar componente chat
                    refrescar_componente_lista_chats(entrada.chat, chatC, true)

                    //notificacion
                    window.pushNotificacion({
                        prioridad: 0, // menor número = más importante
                        texto: `Nuevo mensaje de ${nombre}`,
                        tipo: "info" // "info", "error", "success"
                    })
                }
            }
        }
    }
    else if (tp === 1) {// añadido en un chat existente
        //actualizar componentes lista
        await ACTUALIZAR_LISTAS_CHAT()
        //buscar nombre del chat, como se supone que es grupal pues con buscarlo en mongodb en la tabla de chats globales llega
        const nombreChat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat })
        //notificacion
        //si el usuario es a quien añadieron
        if (entrada.data.usuarios.includes(await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO())) {
            window.pushNotificacion({
                prioridad: 0, // menor número = más importante
                texto: `Te has unido a un nuevo chat${nombreChat ? `\n${nombreChat}` : ``}`,
                tipo: "info" // "info", "error", "success"
            })
        }
        else {
            const nombreEmisor = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.emisor })
            const nombreAñadido = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.añadido })
            window.pushNotificacion({
                prioridad: 0, // menor número = más importante
                texto: `${nombreEmisor} añadio a ${nombreAñadido} al grupo${nombreChat ? `\n${nombreChat}` : ``}`,
                tipo: "info" // "info", "error", "success"
            })
        }
        //actualizar chat
        await Actualizar_render_chat({
            emisor: entrada.data.emisor,
            chat: entrada.data.chat,
            fecha: entrada.data.data,
            especial: 1,
            data: entrada.data
        })
    }
    else if (tp === 2) {//chat nuevo
        //actualizar componentes lista
        await ACTUALIZAR_LISTAS_CHAT()
        //buscar nombre del chat, puede ser no grupal
        const nombreChat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat })
        const nombreCreador = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.creador })
        //notificacion
        window.pushNotificacion({
            prioridad: 0, // menor número = más importante
            texto: `${nombreCreador} ha creado un nuevo chat${nombreChat ? `\n${nombreChat}` : ``}`,
            tipo: "info" // "info", "error", "success"
        })
    }
    else if (tp === 3) {//cambio nombre chat

    }
    else if (tp === 4) {//expulsado de un chat
        const expulsadoId = entrada.data.expulsado;
        const isMe = await Es_usuario_Sesion(expulsadoId);
        const nombreExpulsado = isMe ? "Te" : await Encontrar_Nombre_Chat_Usuario({ id_buscar: expulsadoId });
        const chatNombre = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat });

        if (isMe) {
            await ACTUALIZAR_LISTAS_CHAT();
            if (document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == entrada.data.chat) {
                document.querySelector("#chat-usuario").innerHTML = "";
            }
            window.pushNotificacion({
                prioridad: 0,
                texto: `Has sido expulsado del chat ${chatNombre || ""}`,
                tipo: "error"
            });
        } else {
            window.pushNotificacion({
                prioridad: 1,
                texto: `${nombreExpulsado} ha sido expulsado del chat ${chatNombre || ""}`,
                tipo: "info"
            });
        }
        //actualizar chat
        await Actualizar_render_chat({
            emisor: entrada.data.emisor,
            chat: entrada.data.chat,
            fecha: entrada.data.data,
            especial: 1,
            data: entrada.data
        })
    }
    else if (tp === 5) {//actualizar app

    }
}
async function mensaje_bienvenida_usuario() {
    // Obtener ajuste que guarda si se ha enviado el mensaje de bienvenida y apodo simultáneamente
    const [ajustes_app, apodo] = await Promise.all([
        window.ajustes_app.OBTENER_AJUSTES_APP("MSBienvenida"),
        window.cuenta_usuario.GET_APODO_SESION()
    ])
    //mandar notificacion si es la primera vez
    if (ajustes_app.MSBienvenida) {
        window.pushNotificacion({
            prioridad: 0,
            texto: `Benvido ${apodo} `,
            tipo: "info"
        })

        //marcar como hecho en ajustes para no volver a mostrarlo
        ajustes_app.MSBienvenida = false
        window.ajustes_app.GUARDAR_AJUSTES_APP(ajustes_app)
    }
}

async function iniciar_buzonAPI() {
    // Preparar aviso de sincronización
    const syncBar = document.createElement("div")
    syncBar.className = "sync-mailbox-bar"
    syncBar.innerHTML = `<div class="sync-spinner"></div><span>Sincronizando buzón...</span>`

    // Solo mostrar si tarda más de 1 segundo (evita parpadeos en cargas rápidas)
    const mostrarSync = setTimeout(() => {
        document.body.appendChild(syncBar)
        requestAnimationFrame(() => syncBar.classList.add("visible"))
    }, 1000)

    const cambios = await window.buzonAPI.REVISAR_BUZON()
    for (const entrada of cambios.entrada) await hacer_cambios_buzon(entrada)

    await window.buzonAPI.INICIAR_BUZON()

    // Cancelar el temporizador o cerrar la barra si llegó a mostrarse
    clearTimeout(mostrarSync)
    if (syncBar.parentNode) {
        syncBar.classList.remove("visible")
        setTimeout(() => syncBar.remove(), 450)
    }
}
//cargar eventos de la pagina
document.addEventListener("DOMContentLoaded", async () => {
    //mensaje bienvenida (solo si es la primera vez que se une)
    mensaje_bienvenida_usuario().catch(e => console.error("Error al cargar mensaje de bienvenida", e))

    //cargar eventos doom

    //evento ajustes
    document.querySelector("#bt-seccion-menu-cuenta-ajustes").addEventListener("click", Todos_Los_Eventos_Funciones_Ajustes)

    //cargar chat
    INICIO_CHAT_MENU_PRINCIPAL()

    //añadir chat
    document.querySelector("#bt-añadir-chat").addEventListener("click", (e) => desplegar_menu_añadir_chat({ e, mostrar: true }))

    //filtro buscador chats
    const input_buscar_chat = document.querySelector("#input-buscar-chat")
    if (input_buscar_chat) {
        input_buscar_chat.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                const filtro = input_buscar_chat.value.trim()
                ACTUALIZAR_LISTAS_CHAT(filtro)
            }
        })
    }

    //historial archivos descargados
    document.querySelector("#bt-seccion-historial-archivos").addEventListener("click", () => {
        const seccionHistorial = document.querySelector("#seccion-historial-archivos")
        const chatUsuario = document.querySelector("#chat-usuario")
        const infoChatSeccion = document.querySelector("#info-chat-seccion")

        if (seccionHistorial.classList.contains("ocultar-display")) {
            // Mostrar historial, ocultar chat
            seccionHistorial.classList.remove("ocultar-display")
            chatUsuario.classList.add("ocultar-display")
            if (infoChatSeccion) infoChatSeccion.classList.add("ocultar-display")
            
            // Cargar contenido historial
            crear_chat_historial_archivos_descargados()
        } else {
            // Ocultar historial, volver al chat (si lo hay)
            seccionHistorial.classList.add("ocultar-display")
            chatUsuario.classList.remove("ocultar-display")
            if (infoChatSeccion) infoChatSeccion.classList.remove("ocultar-display")
        }
    })

    //iniciar buzón api
    iniciar_buzonAPI().catch(e => console.error("Error al iniciar buzón api", e))
    //buzon API
    window.buzonAPI.onNuevaNotificacion(async (data) => {
        //realizar cambios en la app segun la entrada del buzon
        for (const entrada of data.entrada) await hacer_cambios_buzon(entrada)
    });

})