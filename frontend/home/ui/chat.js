import { desplegar_menu_añadir_chat } from './añadir_chats_usuarios.js'
import { url_icono_extension_img } from './url_icono_extensiones_archivos.js'
const nombre_defecto = "~no encontrado~"

export const texto_mostrar_fecha_mensajes_bloque = (fecha_param) => {
    //mirar si es hoy
    if (fecha_param.toDateString() === new Date().toDateString()) return "Hoy"
    //mirar si fue ayer
    else if (fecha_param.toDateString() === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()) return "Ayer"
    //mirar si es de la misma semana
    else if (fecha_param.getDay() === new Date().getDay() && (Date.now() - fecha_param.getTime() < 7 * 24 * 60 * 60 * 1000)) return fecha_param.toLocaleString("es-ES", {
        weekday: "long"
    })
    // mirar si es del mismo mes y año
    else if (fecha_param.getMonth() === new Date().getMonth() && fecha_param.getFullYear() === new Date().getFullYear()) {
        //devolver el dia del mes y nombre del dia de la semana
        return fecha_param.toLocaleString("es-ES", {
            weekday: "long"
        }) + " " + fecha_param.getDate() + ", " + fecha_param.toLocaleString("es-ES", {
            month: "long"
        }) + " " + fecha_param.getFullYear()
    }
    else return fecha_param.toDateString()
}

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
        <div class="nombre-chat-lista-componente" style="display: flex; align-items: center; justify-content: space-between;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nombre(datos_usar)}</span>
            ${datos_usar.bloqueado ? '<img src="../recursos/bloqueado.png" style="width: 16px; height: 16px; opacity: 0.6; margin-left: 8px; flex-shrink: 0;" title="Chat bloqueado">' : (datos_usar.silenciado ? '<img src="../recursos/silenciar.png" style="width: 16px; height: 16px; opacity: 0.6; margin-left: 8px; flex-shrink: 0;" title="Chat silenciado">' : '')}
        </div>
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

                html += `<div class="archivo-mensaje-div-archivos" data-id="${archivo.id}" data-nombre="${archivo.nombre}" data-iv="${archivo.iv || ''}" data-tag="${archivo.tag || ''}">
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

let controller_renderizado_activo = null;

async function renderizar_chat_progresivo_plano(datos, id_propio, contactos) {
    try {
        if (controller_renderizado_activo) {
            controller_renderizado_activo.abort = true;
        }
        const controller = { abort: false };
        controller_renderizado_activo = controller;

        const chatContainer = document.querySelector("#cuerpo-mensajes-chat");
        if (!chatContainer) return;

        const mensajes = (datos.mensajes || []).filter(m => m && typeof m === 'object');
        if (mensajes.length === 0) {
            if (datos.mensajes?.length > 0) {
                console.warn("Se recibieron mensajes pero no son objetos válidos. Posible error de carga en backend.");
            }
            return;
        }

        // 1. Pre-obtener todos los nombres en un solo lote (petición grande a DB)
        const uniqueEmitterIds = [...new Set(mensajes.map(m => {
            const emisor = Array.isArray(m.emisor) ? m.emisor[0] : m.emisor;
            return emisor ? emisor.toString() : null;
        }).filter(id => id))];
        
        const data_usuarios = await window.social_usuario.OBTENER_VARIOS_DATOS_USUARIOS_EXTERNOS(uniqueEmitterIds);
        const map_nombres = {};
        const map_contactos = {};

        // Mapear contactos para búsqueda rápida
        contactos.forEach(c => map_contactos[c.id] = c.apodo);

        data_usuarios.forEach(u => {
            const id = u.id || u._id?.toString();
            map_nombres[id] = map_contactos[id] || u.apodo || nombre_defecto;
        });

        // 2. Agrupar mensajes por día
        const mensajes_ordenados = [...mensajes].sort((a, b) => new Date(a.data) - new Date(b.data));
        const grupos_por_dia = [];
        let current_dia = null;

        mensajes_ordenados.forEach(m => {
            const dateStr = new Date(m.data).toDateString();
            if (dateStr !== current_dia) {
                grupos_por_dia.push({ fecha: m.data, mensajes: [] });
                current_dia = dateStr;
            }
            grupos_por_dia[grupos_por_dia.length - 1].mensajes.push(m);
        });

        // 3. Renderizar día a día (de más nuevo a más viejo)
        const dias_reversos = [...grupos_por_dia].reverse();
        let es_primer_dia = true;

        for (const grupo of dias_reversos) {
            if (controller.abort) return;

            // Renderizar mensajes del día en paralelo
            const html_mensajes = await Promise.all(grupo.mensajes.map(async (m) => {
                try {
                    const id_emisor = (Array.isArray(m.emisor) ? m.emisor[0] : m.emisor)?.toString();
                    if (!id_emisor) return "";
                    
                    const propio = id_emisor === id_propio.toString();
                    const esAdmin = datos.usuarios?.length > 2 && datos.admins?.includes(id_emisor);
                    const nombre = map_nombres[id_emisor] || nombre_defecto;

                    return await crear_mensaje_html(m.data, m?.contenido[0]?.asunto || "", m?.contenido[0]?.archivos || [], propio, nombre, esAdmin);
                } catch (err) {
                    console.error("Error al renderizar un mensaje individual:", err, m);
                    return "";
                }
            }));

            const html_dia = `
                <div class="fecha-bloque-mensajes"><span>${texto_mostrar_fecha_mensajes_bloque(new Date(grupo.fecha))}</span></div>
                ${html_mensajes.join('')}
            `;

            if (es_primer_dia) {
                chatContainer.innerHTML = html_dia;
                // Scroll al final al cargar el día más reciente
                chatContainer.scrollTop = chatContainer.scrollHeight;
                es_primer_dia = false;
            } else {
                // Prepend manteniendo el scroll
                const scroll_previo = chatContainer.scrollHeight;
                const top_previo = chatContainer.scrollTop;

                chatContainer.insertAdjacentHTML("afterbegin", html_dia);

                const nuevo_scroll = chatContainer.scrollHeight;
                chatContainer.scrollTop = top_previo + (nuevo_scroll - scroll_previo);
            }

            // Dejar respirar al UI entre días
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    } catch (e) {
        console.error("Error crítico en renderizar_chat_progresivo_plano:", e);
    }
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

    // Iniciar renderizado progresivo en segundo plano
    setTimeout(() => {
        renderizar_chat_progresivo_plano(datos, id_propio, contactos);
    }, 0);

    return `
    <div id="nav-prinicpal-chat-usaurio" data-id="${datos?._id}">
        <div id="nombre-chat-nav"><span>${nombre_chat}</span></div>
    </div>
    
    <div id="cuerpo-mensajes-chat">

    </div>

    <div class="seccion-escritura-mensaje-chat">
        <div id="bt-añadir-archivo-mensaje-escritura">        
            <img src="../recursos/carpeta.svg" alt="">
        </div>
        <textarea id="textarea-mensaje-escritura" placeholder="Escribe un mensaje" maxlength="1000"></textarea>
    </div>
`
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

            const [silenciados, bloqueados] = await Promise.all([
                window.social_usuario.OBTENER_USUARIOS_SILENCIADOS(),
                window.social_usuario.OBTENER_USUARIOS_BLOQUEADOS()
            ])
            const ids_silenciados = (silenciados || []).map(u => typeof u === "string" ? u : u.id || u._id || u);
            const ids_bloqueados = (bloqueados || []).map(u => typeof u === "string" ? u : u.id || u._id || u);

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
                            <span class="info-chat-participante-nombre">
                                ${p.apodo || "Sin apodo"}
                                ${ids_bloqueados.includes(p.id) ? '<img src="../recursos/bloqueado.png" class="icono-bloqueado" style="width: 14px; height: 14px; opacity: 0.6; margin-left: 5px; flex-shrink: 0;" title="Usuario bloqueado">' : (ids_silenciados.includes(p.id) ? '<img src="../recursos/silenciar.png" class="icono-silenciado" style="width: 14px; height: 14px; opacity: 0.6; margin-left: 5px; flex-shrink: 0;" title="Usuario silenciado">' : '')}
                            </span>
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

            const esta_bloqueado = ids_bloqueados.includes(id);
            const esta_silenciado = ids_silenciados.includes(id);

            const texto_bloquear = esta_bloqueado ? "Desbloquear usuario" : "Bloquear usuario";
            const action_bloquear = esta_bloqueado ? "desbloquear" : "bloquear";

            const texto_silenciar = esta_silenciado ? "Desilenciar usuario" : "Silenciar usuario";
            const action_silenciar = esta_silenciado ? "desilenciar" : "silenciar";

            divContent.push(`<div class="context-menu-item" data-action="${action_silenciar}">${texto_silenciar}</div>`);
            divContent.push(`<div class="context-menu-item" data-action="${action_bloquear}">${texto_bloquear}</div>`);

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
                        mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } })
                    }
                }
                else if (action === "hacer-admin") {
                    const resultado = await window.chats.HACER_ADMIN_CHAT(id_chat, id);
                    if (resultado) {
                        mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } })
                    }
                }
                else if (action === "quitar-admin") {
                    const resultado = await window.chats.QUITAR_ADMIN_CHAT(id_chat, id);
                    if (resultado) {
                        mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } })
                    }
                }
                else if (action === "silenciar") {
                    await window.social_usuario.AÑADIR_USUARIO_SILENCIADOS(id, "");
                    mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
                }
                else if (action === "desilenciar") {
                    await window.social_usuario.ELIMINAR_USUARIO_SILENCIADOS(id);
                    mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
                }
                else if (action === "bloquear") {
                    await window.social_usuario.AÑADIR_USUARIO_BLOQUEADOS(id, "");
                    mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
                }
                else if (action === "desbloquear") {
                    await window.social_usuario.ELIMINAR_USUARIO_BLOQUEADO(id);
                    mostrar_datos_chat_usaurios({ currentTarget: { dataset: { id: id_chat } }, preventDefault: () => { } });
                }
                else if (action === "añadir-contacto") { //editar nombre/extension
                    //comprobar si ya es contacto
                    const es_contacto = await Es_Contacto_Usuario(id)
                    if (es_contacto) return;
                    const item = ev.target.closest(".info-chat-participante-item")
                    const id = item.dataset.id
                    const nombre = item.querySelector(".info-chat-participante-nombre").textContent
                    const idamigo = item.dataset.idamigo
                    // Comprobar si es valido el idamigo
                    if (await window.validadores.VALIDAR_IDAMIGO(idamigo)) {
                        await window.social_usuario.AÑADIR_CONTACTO(id, nombre)
                    } else {
                        window.pushNotificacion({ prioridad: 2, texto: "ID de amigo no válido", tipo: "info" })
                    }
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
//COMPROBAR SI ES EL USUARIO DE LA SESION
export async function Es_usuario_Sesion(usuario_comprobar) {
    const id_mio = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
    return usuario_comprobar === id_mio
}