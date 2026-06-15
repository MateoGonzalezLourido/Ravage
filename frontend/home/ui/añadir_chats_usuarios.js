import { CORREO_USUARIO, _cache_lista_usuarios_añadir, establecer_cache_lista_usuarios_añadir, DOM_CACHE } from '../caches_datos.js';

import { escapeHTML } from './seguridad_ui.js';

const clase_cp_lista_contactos_añadidos = "componente-lista-contactos-añadidos-chat-crear"

let _callback_actualizar_listas = null;
export function set_callback_actualizar_listas(cb) {
    _callback_actualizar_listas = cb;
}


// Handlers a nivel de módulo para que removeEventListener funcione con la misma referencia
function _evento_cerrar_menu() {
    desplegar_menu_añadir_chat({ mostrar: false })
}

async function _anadir_chat_buscar_usuario(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        await buscar_usuario_añadir_chat(e)
    }
}

function _mostrar_sugerencias_historial(sugerencias) {
    const $resultados = DOM_CACHE.resultados_busqueda_usuarios;
    $resultados.classList.remove("empty-state");

    let html = '<div class="sugerencias-historial-container">';
    html += '<span class="sugerencias-titulo">Sugerencias del historial:</span>';
    sugerencias.forEach(s => {
        html += `<div class="sugerencia-item" data-dato="${escapeHTML(s.datoUsadoBuscar)}">
                    <img src="../recursos/reciente.png" class="sugerencia-icon" alt="reciente">
                    <span>${escapeHTML(s.datoUsadoBuscar)}</span>
                 </div>`;
    });
    html += '</div>';

    $resultados.innerHTML = html;

    $resultados.querySelectorAll(".sugerencia-item").forEach(item => {
        item.addEventListener("click", async (e) => {
            const dato = e.currentTarget.dataset.dato;
            const $inputBuscar = DOM_CACHE.input_buscar_usuario_añadir;
            if ($inputBuscar) {
                $inputBuscar.value = dato;
                await buscar_usuario_añadir_chat({ key: "Enter", preventDefault: () => { } })
            }
        });
    });
}

async function _manejar_input_sugerencias(e) {
    const texto = e.target.value.trim().toLowerCase();
    const $resultados = DOM_CACHE.resultados_busqueda_usuarios;

    if (texto.length < 2) {
        $resultados.innerHTML = "<span>* Sin resultados</span>";
        $resultados.classList.add("empty-state");
        return;
    }

    try {
        const history = await window.cache_persistente.obtenerHistorialBusquedas();
        if (history && history.datos) {
            const filtrados = history.datos.filter(d =>
                d.datoUsadoBuscar.toLowerCase().includes(texto)
            ).slice(0, 5);

            if (filtrados.length > 0) {
                _mostrar_sugerencias_historial(filtrados);
            } else {
                $resultados.innerHTML = "<span>* Sin resultados</span>";
                $resultados.classList.add("empty-state");
            }
        }
    } catch (err) {
        console.error("Error al obtener sugerencias:", err);
    }
}

function _activar_eventos_menu() {
    const $btnCerrar = document.getElementById("bt-cerrar-menu-añadir-chats");
    const $inputBuscar = DOM_CACHE.input_buscar_usuario_añadir;
    const $btnAgregar = DOM_CACHE.btn_crear_chat_nuevo;
    $btnCerrar?.addEventListener("click", _evento_cerrar_menu)
    $inputBuscar?.addEventListener("keydown", _anadir_chat_buscar_usuario)
    $inputBuscar?.addEventListener("input", _manejar_input_sugerencias)
    $btnAgregar?.addEventListener("click", crear_chat_nuevo)
}

function _desactivar_eventos_menu() {
    const $btnCerrar = document.getElementById("bt-cerrar-menu-añadir-chats");
    const $inputBuscar = DOM_CACHE.input_buscar_usuario_añadir;
    const $btnAgregar = DOM_CACHE.btn_crear_chat_nuevo;
    $btnCerrar?.removeEventListener("click", _evento_cerrar_menu)
    $inputBuscar?.removeEventListener("keydown", _anadir_chat_buscar_usuario)
    $inputBuscar?.removeEventListener("input", _manejar_input_sugerencias)
    $btnAgregar?.removeEventListener("click", crear_chat_nuevo)
}

export function desplegar_menu_añadir_chat({ e = null, mostrar = true, id_chat = "" }) {
    if (e) e.preventDefault()

    const menu_añadir_chat = DOM_CACHE.menu_añadir_chat;
    const $btnAgregar = DOM_CACHE.btn_crear_chat_nuevo;

    if (mostrar) {
        //cancelar limpiar cache historial busquedas
        window.cache_persistente.cancelarLimpiezaVariableCacheHistorial().catch(e => console.error(e));

        if (menu_añadir_chat) {
            menu_añadir_chat.classList.remove("ocultar-display")
            menu_añadir_chat.classList.add("flex-display")
        }

        if ($btnAgregar) $btnAgregar.dataset.id_chat = id_chat || ""

        DOM_CACHE.input_buscar_usuario_añadir?.focus()
        _activar_eventos_menu()
    }
    else {
        if (menu_añadir_chat) {
            menu_añadir_chat.classList.remove("flex-display")
            menu_añadir_chat.classList.add("ocultar-display")
        }

        const $inputBuscar = DOM_CACHE.input_buscar_usuario_añadir;
        const $resultados = DOM_CACHE.resultados_busqueda_usuarios;
        const $contactosGrupo = DOM_CACHE.lista_contactos_añadir_grupo;

        //limpiar datos y html
        actualizar_lista_usuarios_añadir({ clean: true })
        if ($inputBuscar) $inputBuscar.value = ""
        if ($resultados) $resultados.innerHTML = "<span>*Sin resultados</span>"
        if ($contactosGrupo) $contactosGrupo.innerHTML = "<span>*Agregar usuarios para el chat</span>"
        if (DOM_CACHE.input_nombre_chat_nuevo) DOM_CACHE.input_nombre_chat_nuevo.value = ""

        //limpiar eventos
        _desactivar_eventos_menu()
        //limpiar cache
        actualizar_cache_listas_usuarios_añadir(null, true)
        window.cache_persistente.limpiarVariableCacheHistorial().catch(e => console.error(e))
    }
}

function actualizar_lista_usuarios_añadir({ conjunto = null, remove = false, clean = false }) {
    const clase_span_lista_contactos_añadidos = ".span-text-contactos-añadir"
    const $lista_contactos_añadir = DOM_CACHE.lista_contactos_añadir_grupo
    const $span_text_contactos_añadidos = $lista_contactos_añadir?.querySelector(clase_span_lista_contactos_añadidos) || null
    const $bt_agregar_contacto_nuevo = DOM_CACHE.btn_crear_chat_nuevo

    if (clean) $lista_contactos_añadir.replaceChildren()
    else if (remove) remove.currentTarget.remove()
    else if (Array.isArray(conjunto) && conjunto.length > 0) {
        //borrar
        $lista_contactos_añadir.replaceChildren()
        //añadir contacto a la lista
        conjunto.forEach(c => {
            $lista_contactos_añadir.innerHTML += `<div class="${clase_cp_lista_contactos_añadidos}" data-id="${c.id}">${escapeHTML(c.nombre)}</div>`
        })
    }
    else {

        //añadir contacto a la lista
        $lista_contactos_añadir.innerHTML = `<div class="${clase_cp_lista_contactos_añadidos}" data-id="${conjunto.id}">${escapeHTML(conjunto.nombre)}</div>`
    }


    //cambiar textos concorde a los contactos en la lista
    const contactos_añadir = mirar_usuarios_añadir_lista()
    if (contactos_añadir.length == 1) {
        $bt_agregar_contacto_nuevo.innerHTML = "Crear Chat"
    }
    else if (contactos_añadir.length > 1) {
        $bt_agregar_contacto_nuevo.innerHTML = "Crear Grupo"
    }
    else {
        $lista_contactos_añadir.innerHTML = `<span class="${clase_span_lista_contactos_añadidos}">*Agrega contactos</span>`
        $bt_agregar_contacto_nuevo.innerHTML = "Agregar"
    }

    //eventos doom
    document.querySelectorAll(`.${clase_cp_lista_contactos_añadidos}`)?.forEach((c) => {
        c.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id
            quitar_usuarios_lista_añadir(id)
            //actualizar html
            actualizar_lista_usuarios_añadir({ remove: e })

        })
    })
}

function actualizar_cache_listas_usuarios_añadir(data, clean = false) {
    if (clean) {
        establecer_cache_lista_usuarios_añadir(null);
        return;
    }
    const MAX_CONTACTOS_CACHE = 5000; // limitar cache

    if (_cache_lista_usuarios_añadir != data && (!data || data.length <= MAX_CONTACTOS_CACHE)) {
        establecer_cache_lista_usuarios_añadir(data);
    }
    else if (_cache_lista_usuarios_añadir != data) {
        establecer_cache_lista_usuarios_añadir(null); // si la cache supera el limite es inutil guardar los datos, mejor limpiarla
    }
}
function mirar_usuarios_añadir_lista() {
    /*funcion para recuperar la lista de usuarios para añadir del html
    para no usar variables globales que consuman memoria se recogeran del html los datos de los contactos*/

    //mirar si hay cache guardado
    if (_cache_lista_usuarios_añadir) return _cache_lista_usuarios_añadir

    //buscar en el html los usuarios añadir
    const lista_contactos_añadir = []
    document.querySelectorAll(`.${clase_cp_lista_contactos_añadidos}`)?.forEach(c => {
        lista_contactos_añadir.push({ id: c.dataset.id, nombre: c.textContent })
    })


    //no se guarda la cache aqui, se guarda al añadir y quitar contactos, para no actualizarla 2veces sin necesidad
    return lista_contactos_añadir
}
function añadir_usuarios_lista_añadir(e) {
    const id = e.currentTarget.dataset.id
    const nombre = e.currentTarget.dataset.nombre
    const lista_contactos_añadir = mirar_usuarios_añadir_lista()

    if (lista_contactos_añadir.findIndex(x => x.id == id) == -1) {
        const data = { id, nombre }
        actualizar_cache_listas_usuarios_añadir([...lista_contactos_añadir, data])
        return data
    }
}
function quitar_usuarios_lista_añadir(id) {
    let lista_contactos_añadir = mirar_usuarios_añadir_lista()
    lista_contactos_añadir = lista_contactos_añadir.filter(x => x.id != id)

    actualizar_cache_listas_usuarios_añadir(lista_contactos_añadir)
}

async function buscar_usuario_añadir_chat(e) {
    const clase_cp_posible_usuario_añadir = "componente-posible-usuario-añadir"

    async function buscar_y_procesar_cache(dato, esCorreo) {
        try {
            const history = await window.cache_persistente.obtenerHistorialBusquedas();
            const hit = history?.datos?.find(d => d.datoUsadoBuscar === dato);
            if (hit) {
                const user = await window.social_usuario.OBTENER_DATOS_USUARIO_EXTERNO(hit._id, null);
                if (user && user.apodo) {
                    window.cache_persistente.anadirHistorialBusquedas(hit._id, dato).catch(e => console.error(e));
                    return { id: hit._id, nombre: user.apodo };
                }
            }
            const res = await window.social_usuario.ENCONTRAR_USUARIOS_EXTERNOS(dato, esCorreo);
            if (res) {
                window.cache_persistente.anadirHistorialBusquedas(res.id, dato).catch(e => console.error(e));
                return res;
            }
        } catch (e) { console.error(e); }
        return null;
    }

    //buscar
    const texto_buscar = DOM_CACHE.input_buscar_usuario_añadir?.value.trim() || ""
    let resultado;
    if (/[@]/.test(texto_buscar)) {//es correo
        // Comprobar si el correo es válido para reducir llamadas al DB
        const esValido = await window.validadores.VALIDAR_CORREO(texto_buscar)
        if (!esValido) {
            window.pushNotificacion({ prioridad: 2, texto: "Formato de correo no válido", tipo: "info" })
            return null
        }
        const correo_usuario = CORREO_USUARIO
        if (texto_buscar === correo_usuario) return null
        else resultado = await buscar_y_procesar_cache(texto_buscar, true)
    }
    else if (/[#]/.test(texto_buscar)) {//id amigo
        const idLimpio = texto_buscar.replace("#", "")
        // Comprobar si es un ID válido
        const esValido = await window.validadores.VALIDAR_IDAMIGO(idLimpio)
        if (!esValido) {
            window.pushNotificacion({ prioridad: 2, texto: "Formato de ID de amigo no válido", tipo: "info" })
            return null
        }
        const idamigo_usuario = await window.cuenta_usuario.OBTENER_IDAMIGO_USUARIO()
        if (texto_buscar === idamigo_usuario) return null
        else resultado = await buscar_y_procesar_cache(idLimpio, false)
    }

    //excluir usuarios ya existentes si es añadir usuario a un chat existente
    const id_chat = DOM_CACHE.btn_crear_chat_nuevo?.dataset.id_chat || null
    if (id_chat && resultado) {
        const info_chat = await window.chats.OBTENER_DATOS_CHAT_UNICO(id_chat, "usuarios")
        if (info_chat?.usuarios?.includes(resultado.id)) resultado = null
    }

    const $resultados_busqueda_usuarios = DOM_CACHE.resultados_busqueda_usuarios
    if (resultado) {
        $resultados_busqueda_usuarios.innerHTML = `<div class="${clase_cp_posible_usuario_añadir}" data-id="${resultado.id}" data-nombre="${escapeHTML(resultado.nombre)}">${escapeHTML(resultado.nombre)}</div>`
        crear_eventos()
    }
    else {
        $resultados_busqueda_usuarios.innerHTML = `*No hay resultados`
        return;//evitar eventos doom
    }

    //eventos doom
    function crear_eventos() {
        document.querySelectorAll(`.${clase_cp_posible_usuario_añadir}`).forEach(c => {
            c.addEventListener("click", (e) => {
                e.preventDefault()
                const data = añadir_usuarios_lista_añadir(e)
                actualizar_lista_usuarios_añadir({ conjunto: data })
            })
        })
    }
}
async function crear_chat_nuevo(e) {
    e.preventDefault()

    const contactos_añadir = mirar_usuarios_añadir_lista()
    //hay usuarios para crear chat??
    if (contactos_añadir.length === 0) return null

    //conseguir id del chat (si es para añadir usuarios a un chat existente)
    const id_chat = DOM_CACHE.btn_crear_chat_nuevo?.dataset.id_chat

    //nombre del chat
    let nombre = DOM_CACHE.input_nombre_chat_nuevo?.value.trim() || ""
    // Comprobar si el nombre es válido
    if (nombre !== "") {
        const esNombreValido = await window.validadores.VALIDAR_NOMBRE_ARCHIVO(nombre)
        if (!esNombreValido) {
            window.pushNotificacion({ prioridad: 2, texto: "Nombre de chat no válido (caracteres no permitidos)", tipo: "info" })
            return null
        }
    }

    if (nombre == "" && contactos_añadir.length != 1) nombre = "ChatGrupalSinNombre"
    else if (nombre == "") nombre = contactos_añadir[0].nombre

    //sacar el id de los usuarios, asegurando que son válidos
    const ids = contactos_añadir
        .map(c => c.id)
        .filter(id => id && id != "" && id != "undefined");

    if (ids.length === 0) {
        console.warn("No hay IDs de contacto válidos para crear el chat");
        return null;
    }

    try {
        const result = await window.chats.CREAR_CHAT_NUEVO(ids, nombre, id_chat)
        if (result) {
            //actualizar html
            desplegar_menu_añadir_chat({ mostrar: false })
            if (_callback_actualizar_listas) await _callback_actualizar_listas()
            else console.warn("_callback_actualizar_listas no está definida aún")

            // Verificar si fue una solicitud (chat de 2 personas)
            if (result.solicitud) {
                window.pushNotificacion({
                    prioridad: 1,
                    texto: "Solicitud enviada al otro participante del chat",
                    tipo: "info"
                })
            } else {
                window.pushNotificacion({
                    prioridad: 1,
                    texto: id_chat ? "Usuarios añadidos al chat" : "Chat creado con éxito",
                    tipo: "success"
                })
            }
        } else {
            console.warn("Fallo al crear chat/añadir usuarios")
            window.pushNotificacion({
                prioridad: 0,
                texto: "Fallo al crear chat/añadir usuarios",
                tipo: "error"
            })
        }
    } catch (err) {
        console.error("Fallo al crear chat/añadir usuarios")
        window.pushNotificacion({
            prioridad: 0,
            texto: "Error al crear el chat. Consulta la consola para más detalles.",
            tipo: "error"
        })
    }
}