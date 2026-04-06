//importar componentes js
import { desplegar_menu_añadir_chat, set_callback_actualizar_listas } from './ui/añadir_chats_usuarios.js'
import { url_icono_extension_img } from './ui/url_icono_extensiones_archivos.js'
import { chat_componente_lista_estructura_html, crear_mensaje_html, Crear_chat_html, mostrar_datos_chat_usaurios, Encontrar_Nombre_Chat_Usuario, Es_usuario_Sesion, texto_mostrar_fecha_mensajes_bloque, aplicar_escaneres_asincronos } from './ui/chat.js'
import { Todos_Los_Eventos_Funciones_Ajustes } from './ui/ajustes.js'
import { crear_chat_historial_archivos_descargados, invalidar_cache_historial } from './ui/historial_archivos_descargados.js'
set_callback_actualizar_listas(ACTUALIZAR_LISTAS_CHAT);

let archivos_mensaje = []//{ruta,nombre,extension}
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
    // Cerrar historial si está abierto
    const seccionHistorial = document.querySelector("#seccion-historial-archivos")
    const chatUsuario = document.querySelector("#chat-usuario")
    if (seccionHistorial && !seccionHistorial.classList.contains("ocultar-display")) {
        seccionHistorial.classList.add("ocultar-display")
        if (chatUsuario) chatUsuario.classList.remove("ocultar-display")
    }
}

function scroll_fin_chat() {
    document.querySelector("#cuerpo-mensajes-chat").scrollTo({
        top: document.querySelector("#cuerpo-mensajes-chat").scrollHeight,
        behavior: "smooth"
    })
}
/*
   *@param id: id del chat
   *@proceso:buscar todos los datos en cache->obtener datos faltantes->actualizar caches->devolver datos
*/
async function Get_datos_chat_abrir(id_chat) {
    // 1. Cargas iniciales en paralelo
    const resultados = await Promise.allSettled([
        window.chats.OBTENER_MODELO_DATOS_NECESARIOS_CHAT(),
        window.cache_persistente.getChatCache(id_chat),
        window.chats.OBTENER_CACHE_CHAT_ACTIVO(id_chat)
    ]);

    const res = resultados.map(r => r.status === 'fulfilled' ? r.value : null);
    const [template, cachePer, cacheAct] = res;

    if (!template) return null;
    let datos_necesarios = { ...template };

    // 2. Identificar participantes y datos faltantes
    let ids_usuarios = cachePer?.usuarios || cacheAct?.participantes || null;
    let campos_chat_faltantes = [];

    for (const key of Object.keys(datos_necesarios)) {
        if (cacheAct?.[key]) datos_necesarios[key] = cacheAct[key];
        else if (cachePer?.[key]) datos_necesarios[key] = cachePer[key];
        else if (key !== 'd_usuarios' && key !== 'usuarios') campos_chat_faltantes.push(key);
    }

    // 3. Lanzar peticiones de DB/Externas en paralelo (LA CLAVE DE LA OPTIMIZACIÓN)
    const promesas_opt = [];

    // Si faltan datos del chat (convertir array a string para el backend)
    const campos_str = campos_chat_faltantes.join(" ");
    const indice_chat = campos_chat_faltantes.length > 0 ? promesas_opt.push(window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat, campos_str)) - 1 : -1;

    // Si no tenemos los IDs de usuarios, los pedimos ahora
    const indice_ids = !ids_usuarios ? promesas_opt.push(window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat, 'usuarios')) - 1 : -1;

    // Ejecutar peticiones en paralelo
    const resultados_db = await Promise.all(promesas_opt);

    // Procesar resultados de chat e IDs
    if (indice_chat !== -1 && resultados_db[indice_chat]) {
        Object.assign(datos_necesarios, resultados_db[indice_chat]);
    }
    if (indice_ids !== -1 && resultados_db[indice_ids]?.usuarios) {
        ids_usuarios = resultados_db[indice_ids].usuarios;
    }

    // 4. Ahora que tenemos los IDs (sí o sí), pedimos los datos de cada usuario
    let usuarios_detalles = cacheAct?.d_participantes || null;
    if (!usuarios_detalles && ids_usuarios) {
        usuarios_detalles = await window.social_usuario.OBTENER_VARIOS_DATOS_USUARIOS_EXTERNOS(ids_usuarios, "apodo correo");
    }

    // 5. Consolidar y Guardar
    datos_necesarios.d_usuarios = usuarios_detalles;
    datos_necesarios.usuarios = ids_usuarios;
    datos_necesarios._id = id_chat;

    // Actualizar caches de fondo
    window.cache_persistente.setChatCache(datos_necesarios);
    window.chats.GUARDAR_CACHE_CHAT_ACTIVO({
        _id: id_chat,
        seguridad: datos_necesarios.seguridad,
        usuarios: ids_usuarios,
        admins: datos_necesarios.admins,
        fecha_creacion: datos_necesarios.fecha_creacion,
        n_mensajes: datos_necesarios.mensajes?.length || 0,
        d_participantes: usuarios_detalles
    });

    return datos_necesarios;
}
async function ACTUALIZAR_LISTAS_CHAT(filtro = "") {
    try {
        const lista_chats = await window.chats.OBTENER_CHATS_USUARIO()
        window.chats.LIMPIAR_MENSAJES_CHATS_ANTIGUOS(lista_chats)//!importante: esto hay que hacerlo asincrono porque puede tardar mucho, no importa que el usaurio pueda ver mensajes de hace un año, esto se hace para limpiar el DB

        const datos_chats_grupales = await window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: lista_chats, grupales: null, mensajes: false })

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
                const datos_usar = { id: c.id, ultimoCambio: c.ultimoCambio, usuarios: chatEx.usuarios || [], nombre: nombre, ultimomensaje: c.ultimomensaje, silenciado: c.silenciado || false, bloqueado: c.bloqueado || false }
                return chat_componente_lista_estructura_html(datos_usar)
            })
            .join("")

        document.querySelector("#lista-chats-componentes").innerHTML = html
        
        // LOS EVENTOS SE HAN EXTRAIDO A inicializar_eventos_globales() PARA EVITAR FUGA DE MEMORIA
    }
    catch (e) {
        throw e
    }
}


// ==========================================
// DELEGACIÓN GLOBAL DE EVENTOS (NUEVO SISTEMA)
// ==========================================
function inicializar_eventos_globales() {
    // ----------------------------------------------------
    // EVENTOS PANÉL IZQUIERDO (Lista de Chats)
    // ----------------------------------------------------
    const listaChats = document.querySelector("#lista-chats-componentes")
    if (listaChats) {
        listaChats.addEventListener("click", async (e) => {
            const componente = e.target.closest('.chat-componente-lista-chats')
            if (componente) {
                e.preventDefault()
                abrir_chat_item(componente.dataset.id)
            }
        })

        listaChats.addEventListener("contextmenu", async (e) => {
            const componente = e.target.closest('.chat-componente-lista-chats')
            if (componente) {
                e.preventDefault()
                mostrar_menu_contextual_lista_chats(e, componente.dataset.id)
            }
        })
    }

    // ----------------------------------------------------
    // EVENTOS PANÉL DERECHO (Chat Activo & Inputs)
    // ----------------------------------------------------
    const divChatUsuario = document.querySelector("#chat-usuario")
    if (divChatUsuario) {
        // Clics aislados dentro del visor de chat
        divChatUsuario.addEventListener("click", async (e) => {
            // Aceptar solicitud
            const btnAceptarSol = e.target.closest(".bt-solicitud-aceptar")
            if (btnAceptarSol) {
                e.preventDefault()
                manejar_solicitud_chat(btnAceptarSol, true)
                return
            }
            // Rechazar solicitud
            const btnRechazarSol = e.target.closest(".bt-solicitud-rechazar")
            if (btnRechazarSol) {
                e.preventDefault()
                manejar_solicitud_chat(btnRechazarSol, false)
                return
            }
            // Boton nav ver detalles (top bar)
            if (e.target.closest("#nav-prinicpal-chat-usaurio")) {
                mostrar_datos_chat_usaurios()
                return
            }
            // Abrir ventana añadir archivos
            if (e.target.closest("#bt-añadir-archivo-mensaje-escritura")) {
                abrir_ventana_archivos()
                return
            }
        })

        // Inputs del textarea de mensajes
        divChatUsuario.addEventListener("input", async (e) => {
            if (e.target.id === "textarea-mensaje-escritura") {
                manejar_input_escribiendo(e.target)
            }
        })

        // Keypress (Enviar mensaje)
        divChatUsuario.addEventListener("keypress", async (e) => {
            if (e.target.id === "textarea-mensaje-escritura") {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    enviar_mensaje_chat(e.target)
                }
            }
        })
    }

    // ----------------------------------------------------
    // EVENTOS MENÚ DE ARCHIVOS ADJUNTOS
    // ----------------------------------------------------
    document.querySelector(".seccion-cuerpo-chat")?.addEventListener("click", async (e) => {
        // Cerrar ventana archivos
        if (e.target.closest("#bt-cerrar-archivos-mensaje")) {
            cerrar_ventana_archivos()
            return
        }

        // Añadir nuevos archivos desde PC
        if (e.target.closest("#bt-añadir-archivos-mensaje-escritura")) {
            añadir_archivos_dialogo()
            return
        }

        // Limpiar lista cache de archivos actual
        if (e.target.closest("#bt-limpiar-archivos-mensaje-escritura")) {
            archivos_mensaje = []
            actualizar_html_lista_archivos()
            return
        }
        
        // Hacer clic izquierdo sobre un adjunto (Para mostrar su menú)
        const nombreAdjunto = e.target.closest(".ventana-archivos-mensaje-cuerpo-componente-item-nombre")
        if (nombreAdjunto) {
            e.preventDefault()
            mostrar_menu_contextual_archivo(e, nombreAdjunto)
            return
        }
    })
}

// ==========================================
// BLOQUES MODULARES DE UI EXTRACTADOS
// ==========================================

// 1. ABRIR UN CHAT Y RENDERIZAR
async function abrir_chat_item(id_chat) {
    const [datos_chat, id_usuario] = await Promise.all([
        Get_datos_chat_abrir(id_chat),
        window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()
    ])
    if (!datos_chat) {
        window.pushNotificacion({ prioridad: 0, texto: "No se pudieron cargar los datos", tipo: "error" })
        return;
    }
    
    // Limpiar residuos
    archivos_mensaje = []
    document.querySelector("#chat-usuario").innerHTML = await Crear_chat_html(datos_chat, id_usuario)
    cerrar_paneles_al_abrir_chat()
    scroll_fin_chat()
}

// 2. MENÚ CONTEXTUAL LISTA DE CHATS
async function mostrar_menu_contextual_lista_chats(e, id_chat) {
    document.querySelector(".context-menu-chat")?.remove()

    const lista_chats = await window.chats.OBTENER_CHATS_USUARIO()
    const chatInfo = lista_chats.find(c => (c.id || c._id) === id_chat)
    
    const texto_silenciar = chatInfo?.silenciado ? "Desilenciar" : "Silenciar"
    const texto_bloquear = chatInfo?.bloqueado ? "Desbloquear" : "Bloquear"

    const html = `
        <div class="context-menu context-menu-chat" style="position: fixed; z-index: 1000;">
            <div class="context-menu-item" data-action="silenciar">${texto_silenciar}</div>
            <div class="context-menu-item" data-action="bloquear">${texto_bloquear}</div>
        </div>
    `
    document.body.insertAdjacentHTML("beforeend", html)

    const menu = document.querySelector(".context-menu-chat")
    if (menu) {
        menu.style.left = e.clientX + "px"
        menu.style.top = e.clientY + "px"

        const cerrar = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", cerrar) }}
        setTimeout(() => document.addEventListener("mousedown", cerrar), 0)

        menu.addEventListener("click", async (ev) => {
            const action = ev.target.dataset.action
            if (action === "silenciar") {
                const res = await window.chats.SILENCIAR_CHAT(id_chat)
                if (res?.success) window.pushNotificacion({ prioridad: 1, texto: "Chat alterado", tipo: "success" })
            } else if (action === "bloquear") {
                const res = await window.chats.BLOQUEAR_CHAT(id_chat)
                if (res?.success) {
                    window.pushNotificacion({ prioridad: 1, texto: "Bloqueo alterado", tipo: "success" })
                    if (document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == id_chat) await abrir_chat_item(id_chat)
                }
            }
            await ACTUALIZAR_LISTAS_CHAT()
            menu.remove()
        })
    }
}

// 3. ENVIAR MENSAJES Y FILTROS ESTEGANOGRAFÍA
async function manejar_input_escribiendo(textarea) {
    const id_chat = document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id;
    const result_seguridad = await window.escaneres_seguridad_app.ESCANERES_SEGURIDAD_MENSAJE(id_chat);
    const esteg = result_seguridad.escaneres_seguridad?.ESCANER_ESTEGANOGRAFIA || result_seguridad?.ESCANER_ESTEGANOGRAFIA;

    if (esteg === 3) {
        const r = await window.escaneres_seguridad_app.eliminar_escenografia(textarea.value);
        if (r.cambios) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = r.text;
            textarea.setSelectionRange(start, end);
        }
    }
    if (textarea.value.length > 1000) textarea.value = textarea.value.substring(0, 1000);
    textarea.style.height = "38px"
    textarea.style.height = (textarea.scrollHeight) + "px"
}

async function enviar_mensaje_chat(textarea) {
    let mensaje = textarea.value.trim()
    const id_chat = document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id
    const id_usuario = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO()

    if (!mensaje && archivos_mensaje.length === 0) return;

    const req_seguridad = await window.escaneres_seguridad_app.ESCANERES_SEGURIDAD_MENSAJE(id_chat);
    if ((req_seguridad.escaneres_seguridad?.ESCANER_ESTEGANOGRAFIA || 0) === 3) {
        const resc = await window.escaneres_seguridad_app.eliminar_escenografia(mensaje);
        mensaje = resc.text;
    }

    const esValido = await window.validadores.VALIDAR_MENSAJE(mensaje)
    if (!esValido && archivos_mensaje.length === 0) {
        window.pushNotificacion({ PRIORIDAD: 2, texto: "Mensaje no válido", tipo: "info" }); return;
    }

    const copia_archivos = [...archivos_mensaje]
    archivos_mensaje = [] // Reset instantaneo de UI
    textarea.value = ""
    textarea.style.height = "38px"
    document.querySelectorAll(".ventana-archivos-mensaje")?.forEach(x => x.remove())

    const result = await window.chats.ENVIAR_MENSAJE({ asunto: mensaje, archivos: copia_archivos, id_chat: id_chat, id_emisor: id_usuario })
    if (result) {
        await Actualizar_render_chat({ emisor: id_usuario.toString(), chat: id_chat, mensaje: mensaje, archivos: copia_archivos, fecha: new Date().toISOString() })
    }
}

// 4. SOLICITUDES DE AÑADIDO
async function manejar_solicitud_chat(btn, aceptar) {
    const id_chat_sol = btn.dataset.chat
    const id_mensaje_sol = btn.dataset.mensaje
    
    btn.closest(".solicitud-botones")?.querySelectorAll("button").forEach(b => b.disabled = true)
    
    const res = await window.chats.RESPONDER_SOLICITUD_AÑADIR(id_chat_sol, id_mensaje_sol, aceptar)
    if (res?.success) {
        window.pushNotificacion({ prioridad: 1, texto: aceptar ? "Usuario añadido" : "Rechazado", tipo: "success" })
        await ACTUALIZAR_LISTAS_CHAT()
        await abrir_chat_item(id_chat_sol)
    } else {
        window.pushNotificacion({ prioridad: 0, texto: "Error al procesar", tipo: "error" })
        btn.closest(".solicitud-botones")?.querySelectorAll("button").forEach(b => b.disabled = false)
    }
}

// 5. MANEJADORES DE ARCHIVOS ADJUNTOS
async function render_html_lista_archivos() {
    let html = ``
    for (const activo of archivos_mensaje) {
        const [url, idn] = await url_icono_extension_img(activo.extension)
        html += `
        <div class="info-chat-participante-item ventana-archivos-mensaje-cuerpo-componente-item">
            <div data-indice="${archivos_mensaje.indexOf(activo)}" class="info-chat-participante-info ventana-archivos-mensaje-cuerpo-componente-item-nombre">
                <div class="contenido-item-archivo-lista" style="display: flex; align-items: center; gap: 10px;">
                    <img draggable="false" src="${url}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: contain;">
                    <span class="info-chat-participante-nombre">${idn ? activo.nombre : activo.nombre + "." + activo.extension}</span>
                </div>
            </div>
        </div>`
    }
    return html
}

async function actualizar_html_lista_archivos() {
    const contenedor = document.querySelector(".ventana-archivos-mensaje-cuerpo-componente")
    if (contenedor) contenedor.innerHTML = await render_html_lista_archivos()
}

async function abrir_ventana_archivos() {
    if (document.querySelector(".ventana-archivos-mensaje")) return cerrar_ventana_archivos()
    
    const html_lista = await render_html_lista_archivos()
    const ventana = document.createElement("div")
    ventana.className = "ventana-archivos-mensaje"
    ventana.innerHTML = `
        <div class="info-chat-header">
            <div id="bt-cerrar-archivos-mensaje" class="bt-cerrar-archivos-header"><img src="../recursos/cruz.png"></div>
            <div> <span>Archivos Adjuntos</span></div>
            <div id="bt-añadir-archivos-mensaje-escritura" class="bt-accion-archivos" title="añadir archivo"><img src="../recursos/suma.png"></div>
            <div id="bt-limpiar-archivos-mensaje-escritura" class="bt-accion-archivos bt-accion-archivos-peligro"><img src="../recursos/escoba.png"></div>
        </div>
        <div class="info-chat-cuerpo ventana-archivos-mensaje-cuerpo">
            <div class="info-chat-lista-participantes ventana-archivos-mensaje-cuerpo-componente">${html_lista}</div>
        </div>`

    ventana.style.transition = "none"; ventana.style.width = "0"
    document.querySelector(".seccion-cuerpo-chat").appendChild(ventana)

    // Ocultar modal info si existe
    const infoSec = document.querySelector("#info-chat-seccion")
    if (infoSec && infoSec.classList.contains("abierto")) {
        infoSec.style.transition = "none"; infoSec.classList.remove("abierto"); infoSec.style.width = "0";
        requestAnimationFrame(() => requestAnimationFrame(() => { infoSec.style.transition = ""; infoSec.style.width = "" }))
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
        ventana.style.transition = ""; ventana.style.width = ""; ventana.classList.add("abierto")
    }))
}

function cerrar_ventana_archivos() {
    const ven = document.querySelector(".ventana-archivos-mensaje")
    if (ven) {
        ven.classList.remove("abierto")
        setTimeout(() => ven.remove(), 310)
    }
}

async function añadir_archivos_dialogo() {
    const archivos = await window.chats.SELECCIONAR_ARCHIVOS()
    for (const activo of archivos) {
        const est = activo.includes('\\') ? activo.split('\\') : activo.split('/')
        const fn = est[est.length - 1]
        let parts = fn.split('.'), ext = parts.length > 1 ? parts.pop() : "txt", no = parts.join('.')
        if (!(await window.validadores.VALIDAR_NOMBRE_ARCHIVO(no))) no = "Archivo"
        if (!(await window.validadores.VALIDAR_NOMBRE_ARCHIVO(ext))) ext = "txt"
        archivos_mensaje.push({ nombre: no, extension: ext, ruta: activo })
    }
    actualizar_html_lista_archivos()
}

function mostrar_menu_contextual_archivo(e, clkNode) {
    document.querySelector(".context-menu")?.remove()
    const indice = clkNode.dataset.indice
    const archivo = archivos_mensaje[indice]
    if (!archivo) return;

    const mx = `
        <div class="context-menu" style="position: fixed; z-index: 1000;">
            <div class="context-menu-item" data-action="borrar">Borrar</div>
            <div class="context-menu-item" data-action="editar">Editar Nombre</div>
        </div>`
    document.querySelector(".ventana-archivos-mensaje").insertAdjacentHTML("beforeend", mx)

    const menu = document.querySelector(".context-menu")
    menu.style.left = e.clientX + "px"; menu.style.top = e.clientY + "px";
    
    const cr = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", cr) }}
    setTimeout(() => document.addEventListener("mousedown", cr), 0)

    menu.addEventListener("click", (ev) => {
        const acc = ev.target.dataset.action
        if (acc === "borrar") {
            archivos_mensaje.splice(indice, 1)
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

async function Actualizar_render_chat({ emisor, chat, mensaje = "", archivos = [], fecha, especial = null, data = {} }) {
    //chat, emisor son ids
    //el chat abierto es el del mensaje ?
    if (document.querySelector("#chat-usuario") && document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == chat) {
        const id_emisor = Array.isArray(emisor) ? emisor[0]?.toString() : emisor?.toString()

        // 1. Obtener datos base en paralelo
        const [nombres_contactos, id_propio, info_chat_cache] = await Promise.all([
            window.social_usuario.OBTENER_CONTACTOS_USUARIO(),
            window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO(),
            window.cache_persistente.getChatCache(chat)
        ]).catch(() => [[], null, null])

        let info_chat = await window.chats.OBTENER_CACHE_CHAT_ACTIVO()
        if (info_chat && info_chat._id !== chat && info_chat.id !== chat) {
            info_chat = null;
        }

        if (!info_chat) {
            info_chat = info_chat_cache
        }

        if (!info_chat) {
            info_chat = await window.chats.OBTENER_DATOS_CHAT_UNICO(chat).catch((e) => {
                console.error("Error al obtener datos para renderizar mensaje:", e);
                return null;
            })
        }

        const propio = id_propio && id_emisor == id_propio.toString()
        const esAdmin = info_chat?.usuarios?.length > 2 && info_chat?.admins?.some(admin_id => admin_id.toString() === id_emisor.toString());

        // Obtener el nombre (ahora sí tenemos nombres_contactos)
        const nombre_emisor = await Encontrar_Nombre_Chat_Usuario({ id_buscar: id_emisor, grupal: false, contactos: nombres_contactos });

        // 2. Iniciar la creación del HTML (sin el incorrecto 'new Promise')
        // Esto permite que el HTML se genere mientras hacemos lógica de DOM y fechas
        const result_seguridad = await window.escaneres_seguridad_app.ESCANERES_SEGURIDAD_MENSAJE(chat)
        const escaneres_seguridad = result_seguridad.escaneres_seguridad || result_seguridad;
        const htmlPromise = crear_mensaje_html({ fecha, asunto: mensaje, archivos, propio, nombre_emisor, esAdmin, escaneres_seguridad })

        const chatContainer = document.querySelector("#cuerpo-mensajes-chat");
        if (!chatContainer) return;

        const lastBlock = chatContainer.querySelector(".bloque-dia-chat:last-child");
        const fechaActualText = texto_mostrar_fecha_mensajes_bloque(new Date(fecha));
        let lastBlockDateText = lastBlock ? lastBlock.querySelector(".fecha-bloque-mensajes span")?.innerHTML : null;

        // 3. Resolver el HTML justo antes de insertarlo
        const html = await htmlPromise;

        if (!lastBlock || lastBlockDateText !== fechaActualText) {
            // crear nuevo bloque y añadir ahi
            const nuevoBloqueHTML = `
                <div class="bloque-dia-chat">
                    <div class="fecha-bloque-mensajes"><span>${fechaActualText}</span></div>
                    ${html}
                </div>
            `;
            chatContainer.insertAdjacentHTML("beforeend", nuevoBloqueHTML);
        } else {
            // añadir mensaje al bloque ya existente (Corregido: usar el html resuelto)
            lastBlock.insertAdjacentHTML("beforeend", html);
        }

        // Aplicar escáneres asíncronos al último mensaje añadido
        const nuevoMensaje = chatContainer.querySelector(".mensaje-chat:last-child");
        if (nuevoMensaje) {
            aplicar_escaneres_asincronos(nuevoMensaje, mensaje, escaneres_seguridad);
        }

        scroll_fin_chat()
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
        const [info_chats, lista_usuario] = await Promise.all([
            window.chats.OBTENER_DATOS_CHATS_GRUPALES({ data: [{ id: id_chat }], grupales: null, mensajes: false }),
            window.chats.OBTENER_CHATS_USUARIO()
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
            ultimomensaje: chat_usuario?.ultimomensaje,
            silenciado: chat_usuario?.silenciado || false,
            bloqueado: chat_usuario?.bloqueado || false
        }

        // Generar el nuevo HTML
        const html_nuevo = chat_componente_lista_estructura_html(datos_usar)

        // Actualizar el componente existente sin perder la referencia (para no perder el event listener)
        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = html_nuevo
        const contenido_nuevo = tempDiv.firstElementChild.innerHTML

        componente.innerHTML = contenido_nuevo

        // MOVER AL PRINCIPIO DE LA LISTA
        const lista_contenedor = document.querySelector("#lista-chats-componentes")
        if (lista_contenedor && componente) {
            lista_contenedor.prepend(componente)
        }

        // Si hay notificación, podemos añadir una clase visual
        if (notificacion) {
            componente.classList.add("nuevo-mensaje-notificacion")
        }

    } catch (e) {
        console.error("Error al refrescar componente de chat:", e)
    }
}



//buzon api
//procesar lotes del buzon de manera directa (Backend ya filtró silenciados y bloqueados)
async function procesar_entradas_buzon(entradas) {
    if (!entradas || entradas.length === 0) return;
    try {
        for (const entrada of entradas) {
            await hacer_cambios_buzon(entrada);
        }
    } catch (e) {
        console.error("Error al procesar lote de buzón", e);
    }
}

//realizar cambios en la app segun la entrada del buzon
async function hacer_cambios_buzon(entrada) {
    //TODO: CAMBIO DE NOMBRE CHATGRUPO, AÑADIDO USUARIO A UN GRUPO, ELIMINADO USUARIO DE UN CHAT, MENSAJE ACTUALIZAR APP
    const tp = Number(entrada.tipo)

    const esta_silenciado = entrada.silenciado || false; // Injectado por el backend

    if (tp === 0) { //mensaje chat
        const id_chat = entrada.data?.chat || entrada.chat;
        const id_mensaje = entrada.data?.id_mensaje;

        // 1. Buscar el componente en la lista para actualizar vista previa
        const chatC = Array.from(document.querySelectorAll(".chat-componente-lista-chats")).find(el => el.dataset.id == id_chat);

        // 2. Si el chat está abierto, actualizar mensajes
        if (document.querySelector("#chat-usuario") && document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == id_chat) {
            const respuesta = await window.chats.OBTENER_DATOS_MENSAJE(id_chat, id_mensaje)

            //actualizar chat
            await Actualizar_render_chat({
                emisor: respuesta.emisor,
                chat: id_chat,
                mensaje: respuesta.contenido?.[0]?.asunto || "",
                archivos: respuesta.contenido?.[0]?.archivos || [],
                fecha: respuesta.data
            })
        }

        // 3. Si el componente existe en la lista, refrescarlo (y moverlo arriba)
        if (chatC) {
            const chatAbierto = document.querySelector("#nav-prinicpal-chat-usaurio")?.dataset.id == id_chat;
            await refrescar_componente_lista_chats(id_chat, chatC, !esta_silenciado && !chatAbierto)

            // 4. Notificación desktop si no está abierto y no silenciado
            if (!esta_silenciado && !chatAbierto) {
                const nombre = chatC.querySelector(".nombre-chat-lista-componente span")?.textContent || "nuevo mensaje";
                window.pushNotificacion({
                    prioridad: 0,
                    texto: `Nuevo mensaje de ${nombre}`,
                    tipo: "info"
                })
            }
        }
    }
    else if (tp === 1) {// añadido en un chat existente
        //actualizar componentes lista
        await ACTUALIZAR_LISTAS_CHAT()
        //buscar nombre del chat, como se supone que es grupal pues con buscarlo en mongodb en la tabla de chats globales llega
        const nombreChat = await Encontrar_Nombre_Chat_Usuario({ id_buscar: entrada.data.chat })
        //notificacion
        if (!esta_silenciado) {
            //si el usuario es a quien añadieron
            const mi_id = await window.cuenta_usuario.OBTENER_ID_MONGODB_USUARIO();
            if (entrada.data.usuarios.includes(mi_id)) {
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
                    texto: `${nombreEmisor} añadió a ${nombreAñadido} al grupo${nombreChat ? `\n${nombreChat}` : ``}`,
                    tipo: "info" // "info", "error", "success"
                })
            }
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
        if (!esta_silenciado) {
            window.pushNotificacion({
                prioridad: 0, // menor número = más importante
                texto: `${nombreCreador} ha creado un nuevo chat${nombreChat ? `\n${nombreChat}` : ``}`,
                tipo: "info" // "info", "error", "success"
            })
        }
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
            if (!esta_silenciado) {
                window.pushNotificacion({
                    prioridad: 0,
                    texto: `Has sido expulsado del chat ${chatNombre || ""}`,
                    tipo: "error"
                });
            }
        } else {
            if (!esta_silenciado) {
                window.pushNotificacion({
                    prioridad: 1,
                    texto: `${nombreExpulsado} ha sido expulsado del chat ${chatNombre || ""}`,
                    tipo: "info"
                });
            }
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
    // NOTA: llamar sin argumento devuelve el objeto completo de ajustes
    const [ajustes_app, apodo] = await Promise.all([
        window.ajustes_app.OBTENER_AJUSTES_APP(),
        window.cuenta_usuario.GET_APODO_SESION()
    ])
    //mandar notificacion si es la primera vez
    if (ajustes_app?.MSBienvenida) {
        window.pushNotificacion({
            prioridad: 0,
            texto: `Benvido ${apodo} `,
            tipo: "info"
        })

        //marcar como hecho en ajustes para no volver a mostrarlo
        window.ajustes_app.GUARDAR_AJUSTES_APP({ MSBienvenida: false })
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
    await procesar_entradas_buzon(cambios?.entrada || [])

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

    //evento descargar archivos chat (delegado)
    document.querySelector("#chat-usuario")?.addEventListener("click", async (e) => {
        const el = e.target.closest(".archivo-mensaje-div-archivos")
        if (el) {
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
                    id_chat,
                    id_archivo,
                    nombre: nombre_archivo,
                    url_img,
                    iv,
                    tag,
                    ratchet_info,
                    emisor_id,
                    fecha: new Date().toISOString()
                })
                invalidar_cache_historial()
            }
        }
    });

    //evento ajustes
    document.querySelector("#bt-seccion-menu-cuenta-ajustes").addEventListener("click", Todos_Los_Eventos_Funciones_Ajustes)

    //cargar chat inicial
    INICIO_CHAT_MENU_PRINCIPAL()

    // ACTIVACIÓN RED GLOBAL DE EVENTOS DELEGADOS 
    inicializar_eventos_globales()

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
        const seccionHistorial = document.querySelector("#seccion-historial-archivos-alineador")
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
        await procesar_entradas_buzon(data.entrada)
    });

    window.buzonAPI.onNotificarRender((data) => {
        window.pushNotificacion(data)
    });

})

window.sesion_usuario.CERRANDO_SESION((mostrar) => {
    const clase_sync_bar = "sync-mailbox-bar"
    if (mostrar) {
        if (!document.querySelector(`.${clase_sync_bar}`)) {
            const syncBar = document.createElement("div")
            syncBar.className = clase_sync_bar
            syncBar.innerHTML = `<div class="sync-spinner"></div><span>Cerrando sesión...</span>`
            document.body.appendChild(syncBar)
            requestAnimationFrame(() => syncBar.classList.add("visible"))
        }
    }
    else {
        document.querySelector(`.${clase_sync_bar}`)?.classList.remove("visible")
        setTimeout(() => document.querySelector(`.${clase_sync_bar}`)?.remove(), 450)
    }

})