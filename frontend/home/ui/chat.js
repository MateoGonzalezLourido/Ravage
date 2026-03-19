import { desplegar_menu_añadir_chat } from './añadir_chats_usuarios.js'
const nombre_defecto = "~no encontrado~"

export const chat_componente_lista_estructura_html = (datos_usar) => {
    //recuperar nombre del chat
    const nombre = (datos_usar) => { return datos_usar?.nombre || `<<no encontrado>>` }
    //recuperar numero de integrantes
    const usuarios = (datos_usar) => {
        if (datos_usar.usuarios.length > 2 && datos_usar.usuarios.length) return (`<div class="numero-integrantes-chat-lista"><span>${[...new Set(datos_usar?.usuarios)]?.length || 0} integrantes</span></div>`)
        else return ``
    }
    //recuperar ultima vez
    const ultima_vez = (datos_usar) => {
        if (datos_usar.usuarios.length <= 2 && datos_usar.ultimoCambio) {

            const fecha = new Date(datos_usar.ultimoCambio);
            const ahora = new Date();

            const hora = fecha.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            });

            // 🔹 Normalizamos fechas a medianoche para comparar días
            const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
            const fechaComparar = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

            const diferenciaDias = (hoy - fechaComparar) / (1000 * 60 * 60 * 24);

            let resultado;

            if (diferenciaDias === 0) {
                resultado = `Hoy, ${hora}`;
            }
            else if (diferenciaDias === 1) {
                resultado = `Ayer, ${hora}`;
            }
            else {
                const dia = fecha.getDate();
                const mes = fecha.toLocaleString("es-ES", {
                    month: "short"
                }).replace(".", "");

                resultado = `${hora}, ${dia} ${mes}`;
            }

            return `<div class="numero-integrantes-chat-lista"><span>${resultado}</span></div>`;
        }
        else {
            return ``;
        }
    }
    //recuperar ultimo mensaje
    const ultimo_mensaje = (datos_usar) => {
        if (datos_usar.usuarios.length == 2 && datos_usar.ultimomensaje) return (`<div class="ultimo-mensaje-chat-lista"><span>${datos_usar.ultimomensaje}</span></div>`)
        else return ``
    }
    let html = `
    <div data-id="${datos_usar.id}" class="chat-componente-lista-chats">
        <div class="nombre-chat-lista-componente"><span>${nombre(datos_usar)}</span></div>
        ${usuarios(datos_usar)}
        ${ultimo_mensaje(datos_usar)}
        ${ultima_vez(datos_usar)}
    </div>`

    return html
}
export const crear_mensaje_html = async (fecha, asunto = "", archivos = [], propio = false, nombre_emisor, esAdmin = false) => {
    const class_mensajes = ["soy-emisor", "soy-receptor"]

    //funciones de componentes
    const emisor_mensaje = (propio) => {
        return propio ? class_mensajes[0] : class_mensajes[1]
    }
    const asunto_mensaje = (asunto) => {
        return asunto ? `<div class="asunto-mensaje-chat">${asunto}</div> ` : ``
    }
    const nombre_emisor_mensaje = (nombre, propio, esAdmin) => {
        if (propio) return ``

        return `<div class="nombre-mensaje-chat-usuario"><span>${nombre}${esAdmin ? " <span style='font-size: 0.9em; opacity: 0.7;'>·Admin</span>" : ""}</span></div>`
    }
    const hora_mandado = (fecha) => {
        const fechaTraducida = new Date(fecha);
        const hora = fechaTraducida.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
        return `<div class="hora-mensaje-chat"><span>${hora}</span></div>`
    }
    const archivos_mensaje = async (archivos) => {
        if (archivos?.length > 0) {
            let html = `<div class="mensaje-div-archivos">`
            for (const archivo of archivos) {
                const extension = archivo?.extension || archivo.nombre?.includes(".") ? archivo.nombre.split(".").pop() : null
                const [url, identificado] = await url_icono_extension_img(extension)
                const nombre_mostrar = identificado ? (archivo.nombre?.includes(".") ? archivo.nombre.substring(0, archivo.nombre.lastIndexOf(".")) : archivo.nombre) : archivo.nombre

                html += `<div class="archivo-mensaje-div-archivos" data-id="${archivo.id}" data-nombre="${archivo.nombre}">
                <div><img src="${url}"><span>${nombre_mostrar}</span></div>
                </div> `
            }
            html += "</div>"
            return html
        }
        else return ``
    }

    return (`
    <div class="mensaje-chat ${emisor_mensaje(propio)}">
        ${nombre_emisor_mensaje(nombre_emisor, propio, esAdmin)}
        ${asunto_mensaje(asunto)}
        ${await archivos_mensaje(archivos)}
        ${hora_mandado(fecha)}
    </div> `)

}
export async function Encontrar_Nombre_Chat_Usuario({ id_buscar, grupal = true, contactos = null }) {
    //si grupal: false->es un usuario, true->puede ser un chat grupal
    if (grupal) {
        //buscar en tabla general de chats
        const chat_grupal = await window.chats.OBTENER_DATOS_CHAT_UNICO(id_buscar, "nombre")
        if (chat_grupal?.nombre) return chat_grupal.nombre
        //como no existe, puede ser un usuario
    }

    //1ºbuscar en contactos apodo, 2º buscar en usuarios su nombre
    //se puede enviar contactos ya directamente si se tiene, para reducir llamadas a ipc al buscar el nombre de todos los usuarios del chat
    const nombres_contactos = contactos || await window.social_usuario.OBTENER_CONTACTOS_USUARIO()
    const indice_contacto = nombres_contactos.findIndex(x => x.id == id_buscar)

    if (indice_contacto === -1) {
        // Si no es contacto, intentamos obtener su apodo externo
        const data_externo = await window.social_usuario.OBTENER_DATOS_USUARIO_EXTERNO(id_buscar, "apodo")
        return data_externo?.apodo || nombre_defecto
    }
    else return nombres_contactos[indice_contacto].apodo
}

export async function Crear_chat_html(datos, id_propio) {
    
    const [nombre_chat, contactos] = await Promise.all([
        Encontrar_Nombre_Chat_Usuario({ id_buscar: datos?._id, grupal: true }),
        window.social_usuario.OBTENER_CONTACTOS_USUARIO()
    ])

    //nav principal
    let html = ""
    //crear html mensajes
    const todo_chat = async () => {
        let html = ""
        if (!datos?.mensajes) return html

        // Ordenar mensajes por fecha (de más antiguo a más reciente),en la base de datos se guardan segun lleguen no por fecha
        const mensajes_ordenados = [...datos.mensajes].sort((a, b) => {
            return new Date(a.data) - new Date(b.data)
        })
        let fecha_ultimo;//para guardar la fecha del ultimo mensaje procesado, para los bloques de fechas de mensajes
        for (const m of mensajes_ordenados) {
            //TODO:QUE AL DEJAR DE TENER ESTO DE LA FECHA EN LA PANTALLA APAREZCA FIXED ARRIBA DEL CHAT (LA FECHA QUE PERTEZCA AL BLOQUE QUE ESTAMOS VIENDO)
            //comparar si son del mismo dia
            const fecha_actual = new Date(m.data)
            const fecha_comparar = new Date(fecha_ultimo)
            const texto_mostrar_fecha_mensajes_bloque = (fecha_ultimo) => {
                //mirar si es hoy
                if (fecha_ultimo.toDateString() === new Date().toDateString()) return "Hoy"
                //mirar si fue ayer
                else if (fecha_ultimo.toDateString() === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()) return "Ayer"
                //mirar si es de la misma semana
                else if (fecha_ultimo.getDay() === new Date().getDay()) return fecha_ultimo.toLocaleString("es-ES", {
                    weekday: "long"
                })
                // mirar si es del mismo mes y año
                else if (fecha_ultimo.getMonth() === new Date().getMonth() && fecha_ultimo.getFullYear() === new Date().getFullYear()) {
                    //devolver el dia del mes y nombre del dia de la semana
                    return fecha_ultimo.toLocaleString("es-ES", {
                        weekday: "long"
                    }) + " " + fecha_ultimo.getDate() + ", " + fecha_ultimo.toLocaleString("es-ES", {
                        month: "long"
                    }) + " " + fecha_ultimo.getFullYear()
                }
                else return fecha_ultimo.toDateString()
            }
            if (fecha_actual.toDateString() !== fecha_comparar.toDateString() || !fecha_ultimo) {
                html += `<div class="fecha-bloque-mensajes"><span>${texto_mostrar_fecha_mensajes_bloque(fecha_actual)}</span></div> `
            }
            fecha_ultimo = m.data
            
            // Manejar mensajes especiales (sistema)
            if (m.especial && m.especial.tipo !== undefined) {
                const tipo = m.especial.tipo

                // tipo 0: usuario añadido
                if (tipo === 0) {
                    const nombre_emisor_esp = await Encontrar_Nombre_Chat_Usuario({ id_buscar: m.especial.emisor, grupal: false, contactos: contactos })
                    const nombre_añadido = await Encontrar_Nombre_Chat_Usuario({ id_buscar: m.especial.añadido, grupal: false, contactos: contactos })
                    const esYo_emisor = m.especial.emisor == id_propio
                    const esYo_añadido = m.especial.añadido == id_propio

                    let texto
                    if (esYo_emisor) texto = `Has añadido a <b>${nombre_añadido}</b> al chat`
                    else if (esYo_añadido) texto = `<b>${nombre_emisor_esp}</b> te ha añadido al chat`
                    else texto = `<b>${nombre_emisor_esp}</b> añadió a <b>${nombre_añadido}</b>`

                    html += `<div class="mensaje-especial mensaje-especial-añadido"><span class="icono-especial">👤+</span> <span>${texto}</span></div>`
                    continue
                }

                // tipo 1: usuario expulsado
                if (tipo === 1) {
                    const nombre_emisor_esp = await Encontrar_Nombre_Chat_Usuario({ id_buscar: m.especial.emisor, grupal: false, contactos: contactos })
                    const nombre_expulsado = await Encontrar_Nombre_Chat_Usuario({ id_buscar: m.especial.expulsado, grupal: false, contactos: contactos })
                    const esYo_emisor = m.especial.emisor == id_propio
                    const esYo_expulsado = m.especial.expulsado == id_propio

                    let texto
                    if (esYo_emisor) texto = `Has expulsado a <b>${nombre_expulsado}</b> del chat`
                    else if (esYo_expulsado) texto = `<b>${nombre_emisor_esp}</b> te ha expulsado del chat`
                    else texto = `<b>${nombre_emisor_esp}</b> expulsó a <b>${nombre_expulsado}</b>`

                    html += `<div class="mensaje-especial mensaje-especial-expulsado"><span class="icono-especial">👤−</span> <span>${texto}</span></div>`
                    continue
                }

                // tipo 2: solicitud añadir usuario (requiere confirmación en chats de 2)
                if (tipo === 2) {
                    const nombre_emisor_sol = await Encontrar_Nombre_Chat_Usuario({ id_buscar: m.especial.emisor, grupal: false, contactos: contactos })
                    const nombre_candidato = await Encontrar_Nombre_Chat_Usuario({ id_buscar: m.especial.candidato, grupal: false, contactos: contactos })
                    const estado = m.especial.estado || "pendiente"
                    const esSolicitante = m.especial.emisor == id_propio
                    const id_mensaje = m._id || m.id

                    let contenido_solicitud = ""
                    if (estado === "pendiente") {
                        if (esSolicitante) {
                            contenido_solicitud = `<span>Has solicitado añadir a <b>${nombre_candidato}</b>. Esperando confirmación...</span>`
                        } else {
                            contenido_solicitud = `
                                <span><b>${nombre_emisor_sol}</b> quiere añadir a <b>${nombre_candidato}</b> al chat</span>
                                <div class="solicitud-botones">
                                    <button class="bt-solicitud-aceptar" data-chat="${datos._id}" data-mensaje="${id_mensaje}">Aceptar</button>
                                    <button class="bt-solicitud-rechazar" data-chat="${datos._id}" data-mensaje="${id_mensaje}">Rechazar</button>
                                </div>`
                        }
                    } else if (estado === "aceptada") {
                        contenido_solicitud = `<span><b>${nombre_candidato}</b> fue añadido al chat</span>`
                    } else if (estado === "rechazada") {
                        contenido_solicitud = `<span>Solicitud para añadir a <b>${nombre_candidato}</b> fue rechazada</span>`
                    }

                    html += `<div class="mensaje-especial mensaje-solicitud-añadir estado-${estado}">${contenido_solicitud}</div>`
                    continue
                }

                // tipo desconocido: fallback genérico
                html += `<div class="mensaje-especial"><span>Mensaje del sistema</span></div>`
                continue
            }

            const id_emisor = Array.isArray(m.emisor) ? m.emisor[0] : m.emisor
            const nombre = Encontrar_Nombre_Chat_Usuario({ id_buscar: id_emisor, grupal: false, contactos: contactos })
            const propio = id_emisor == id_propio
            const asunto = m?.contenido[0]?.asunto || ""
            const fecha = m.data
            const archivos = m?.contenido[0]?.archivos || []
            const esAdmin = datos.usuarios?.length > 2 && datos.admins?.includes(id_emisor?.toString())
            html += (await crear_mensaje_html(fecha, asunto, archivos, propio, nombre, esAdmin))
        }

        return html
    }
    html += `
    <div id="nav-prinicpal-chat-usaurio" data-id="${datos?._id}">
        <div id="nombre-chat-nav"><span>${nombre_chat}</span></div>
    </div>
    
    <div id="cuerpo-mensajes-chat">
        ${await todo_chat()}
    </div>

    <div class="seccion-escritura-mensaje-chat">
        <div id="bt-añadir-archivo-mensaje-escritura">        
            <img src="../recursos/carpeta.svg" alt="">
        </div>
        <textarea id="textarea-mensaje-escritura" placeholder="Escribe un mensaje"></textarea>
    </div>
`

    return html
}

export async function mostrar_datos_chat_usaurios(e) {
    e.preventDefault()
    // MOSTRAR DATOS DEL USUARIO Y DEL CHAT
    const id_chat = e.currentTarget.dataset.id || document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id
    const info_chat = await window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat)
    const infoSeccion = document.querySelector("#info-chat-seccion")

    //crear html de la seccion
    const nombre_chat = document.querySelector("#nombre-chat-nav span")?.textContent || nombre_defecto
    const integrantes_chat = () => {
        return `<div> ${[...new Set(info_chat?.usuarios)]?.length || 0} integrantes</div> `
    }

    const fecha_formateada = info_chat?.fecha_creacion
        ? new Date(info_chat.fecha_creacion).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : "*No disponible";

    let html = `
    <div class="info-chat-header">
        <div id="bt-cerrar-info-chat">
            <img src="../recursos/cruz.png" alt="cerrar">
        </div>
        <span>Información del chat</span>
    </div>

    <div class="info-chat-cuerpo">
        <div class="info-chat-perfil">
            <div class="info-chat-nombre">
                <span>${nombre_chat}</span>
            </div>
            <div class="info-chat-subtitulo">
                ${integrantes_chat()}
            </div>
        </div>

        <div class="info-chat-detalles">
            <div class="info-chat-item">
                <span class="info-chat-label">Mensajes</span>
                <span class="info-chat-valor">${info_chat?.mensajes?.length || 0}</span>
            </div>
            <div class="info-chat-item">
                <span class="info-chat-label">Creado el</span>
                <span class="info-chat-valor">${fecha_formateada}</span>
            </div>
        </div>

        <div class="div-botones-info-chat">
            <button id="bt-ver-archivos-chat">
                Ver Archivos
            </button>
        </div>

        ${await (async () => {
            const id_mio = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
            let participantes_ids = [...new Set(info_chat.usuarios)]//quitar repetidos
            participantes_ids = participantes_ids.filter(id => id !== id_mio)//quitar el id propio

            // Obtener datos de todos los participantes en paralelo
            const participantes_promesas = participantes_ids.map(id => window.social_usuario.OBTENER_DATOS_USUARIO_EXTERNO(id))
            const participantes_datos = await Promise.all(participantes_promesas)

            let lista_html = `
            <div class="info-chat-lista-participantes">
                <div class="info-chat-lista-titulo">Participantes (${participantes_datos.length + 1}) <div id="bt-anadir-participante-chat">+</div></div>
                <div class="info-chat-lista-items">
                <div class="info-chat-participante-item">
                    <div class="info-chat-participante-info">
                        <span class="info-chat-participante-nombre">Tú</span>
                        <span class="info-chat-participante-correo">${await window.cuenta_usuario.OBTENER_CORREO_USUARIO()}</span>
                        ${info_chat.admins?.includes(id_mio) ? `<span class="info-chat-participante-admin" style="color: gray; font-size: 11px;">Admin</span>` : ""}
                    </div>
                </div>
            `
            participantes_datos.forEach(p => {
                if (p) {
                    lista_html += `
                    <div class="info-chat-participante-item" data-id="${p.id}"data-idamigo="${p.idamigo}">
                        <div class="info-chat-participante-info">
                            <span class="info-chat-participante-nombre">${p.apodo || "Sin apodo"}</span>
                            <span class="info-chat-participante-correo">${p.correo || ""}</span>
                            ${info_chat.admins?.includes(p.id) ? `<span class="info-chat-participante-admin" style="color: gray; font-size: 11px;">Admin</span>` : ""}
                        </div>
                    </div>
                    `
                }
            })
            lista_html += `</div></div>`
            return lista_html
        })()}
    </div>
`
    infoSeccion.innerHTML = html

    // Eventos de la sección de información
    document.querySelector("#bt-cerrar-info-chat")?.addEventListener("click", () => {
        infoSeccion.classList.remove("abierto")
    })

    document.querySelector("#bt-ver-archivos-chat")?.addEventListener("click", () => {
        // TODO: Implementar el menú de archivos mandados
    })

    document.querySelector("#bt-anadir-participante-chat")?.addEventListener("click", (e) => {
        e.preventDefault()
        // TODO: Implementar el menú de añadir participante
        desplegar_menu_añadir_chat({ mostrar: true, id_chat: id_chat })

    })
    // Eventos de los participantes
    for (const item of document.querySelectorAll(".info-chat-participante-item")) {
        item.addEventListener("click", async (e) => {
            e.preventDefault()
            const id = e.currentTarget.dataset.id
            //si es el propio usuario-> no mostrar menu contextual
            if (await Es_usuario_Sesion(id)) return;

            //menu contextual participantes
            const soyAdmin = info_chat.admins?.includes(await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO());
            const targetEsAdmin = info_chat.admins?.includes(id);

            let html_contextMenu = `
                                    <div class="context-menu context-menu-participantes" style="position: fixed; z-index: 1000;">
                                        ${await Es_Contacto_Usuario(id) ? `<div class="context-menu-item" data-action="añadir-contacto">Añadir Contacto</div>` : ``}
                                    </div>
                                `
            // Inyectar opciones de admin
            const divContent = [];
            if (soyAdmin) {
                divContent.push(`<div class="context-menu-item" data-action="expulsar">Expulsar</div>`);
                if (targetEsAdmin) {
                    divContent.push(`<div class="context-menu-item" data-action="quitar-admin">Quitar Admin</div>`);
                } else {
                    divContent.push(`<div class="context-menu-item" data-action="hacer-admin">Hacer Admin</div>`);
                }
            }

            if (divContent.length > 0) {
                 html_contextMenu = html_contextMenu.replace('</div>\n                                `', `${divContent.join('')}\n                                    </div>\n                                `);
            }

            const ventanaContenedor = document.querySelector(".info-chat-cuerpo")
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

            menu.addEventListener("click", async (ev) => {
                const action = ev.target.dataset.action
                if (action === "expulsar") {
                    const resultado = await window.chats.EXPULSAR_USUARIO_CHAT(id, id_chat)
                    if (resultado) {
                        // actualizar seccion info chat
                        mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => {} })
                    }
                }
                else if (action === "hacer-admin") {
                    const resultado = await window.chats.HACER_ADMIN_CHAT(id_chat, id);
                    if (resultado) {
                        mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => {} })
                    }
                }
                else if (action === "quitar-admin") {
                    const resultado = await window.chats.QUITAR_ADMIN_CHAT(id_chat, id);
                    if (resultado) {
                        mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => {} })
                    }
                }
                else if (action === "añadir-contacto") { //editar nombre/extension
                    //comprobar si ya es contacto
                    const es_contacto = await Es_Contacto_Usuario(id)
                    if (es_contacto) return;
                    const idamigo = ev.target.closest(".info-chat-participante-item").dataset.idamigo
                    //TODO: Comprobar si es valido el idamigo
                    await Añadir_Contacto(idamigo)
                }
            })
        })
    }
    //mostrar seccion + cambiar css secciones

    if (infoSeccion) {
        // Toggle the info section
        infoSeccion.classList.toggle("abierto")
        // If it's now open, close the attachment menu if it exists (abruptly snap)
        if (infoSeccion.classList.contains("abierto")) {
            const ventanaArchivos = document.querySelector(".ventana-archivos-mensaje")
            if (ventanaArchivos) {
                // Snap close instantly without animation
                ventanaArchivos.style.transition = "none"
                ventanaArchivos.style.width = "0"
                ventanaArchivos.classList.remove("abierto")
                ventanaArchivos.remove()
            }
        }
    }
}
async function Expulsar_Usuario_Chat(id_usuario, id_chat) {
    await window.chats.EXPULSAR_USUARIO_CHAT(id_usuario, id_chat)
}
//COMPROBAR SI ES UN CONTACTO DEL USUARIO
async function Es_Contacto_Usuario(usuario_comprobar) {
    //obtener contactos usuario
    const contactos = await window.social_usuario.OBTENER_CONTACTOS_USUARIO()
    return contactos.includes(usuario_comprobar)
}