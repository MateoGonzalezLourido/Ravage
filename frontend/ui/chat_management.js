export let contactos_añadir = [];

export async function desplegar_menu_añadir_chat({ e, mostrar }) {
    if (e) e.preventDefault()
    const el = document.querySelector("#seccion-menu-añadir-chats")
    if (mostrar) {
        el.classList.remove("ocultar-display")
        el.classList.add("flex-display")
        //limpiar inputs
        document.querySelector("#texto-buscar-chat-añadir").value = ""
        document.querySelector("#seccion-lista-usuarios-añadir").innerHTML = ""
        contactos_añadir = []
        actualizar_lista_contactos_añadir()
    }
    else {
        el.classList.remove("flex-display")
        el.classList.add("ocultar-display")
    }
}

export function actualizar_lista_contactos_añadir() {
    const contenedor = document.querySelector("#seccion-lista-contactos-añadir")
    contenedor.innerHTML = ""
    if (contactos_añadir.length === 0) {
        contenedor.innerHTML = "<p>No hay contactos añadidos</p>"
    }
    else {
        for (const item of contactos_añadir) {
            const item_el = document.createElement("div")
            item_el.classList.add("item-lista-flotante-ajustes")
            item_el.innerHTML = `
                <span>${item.apodo}</span>
                <button class="bt-accion-lista-flotante" data-id="${item.id}">Quitar</button>
            `
            contenedor.appendChild(item_el)

            item_el.querySelector("button").addEventListener("click", (e) => {
                const id = e.target.dataset.id
                contactos_añadir = contactos_añadir.filter(x => x.id !== id)
                actualizar_lista_contactos_añadir()
            })
        }
    }
}

export async function buscar_ususario_añadir_chat(e) {
    const texto = document.querySelector("#texto-buscar-chat-añadir").value
    if (texto.length < 3) return
    
    document.querySelector("#seccion-lista-usuarios-añadir").innerHTML = '<div class="spinner"></div>'
    
    const usuarios = await window.social_usuario.ENCONTRAR_USUARIO_EXTERNO(texto)
    const contenedor = document.querySelector("#seccion-lista-usuarios-añadir")
    contenedor.innerHTML = ""
    
    if (usuarios.length === 0) {
        contenedor.innerHTML = "<p>No se han encontrado usuarios</p>"
    }
    else {
        for (const user of usuarios) {
            const el = document.createElement("div")
            el.className = "item-lista-flotante-ajustes"
            el.innerHTML = `
                <span>${user.apodo}</span>
                <button class="bt-accion-lista-flotante" data-id="${user.id}">Añadir</button>
            `
            contenedor.appendChild(el)
            
            el.querySelector("button").addEventListener("click", () => {
                if (!contactos_añadir.find(x => x.id === user.id)) {
                    contactos_añadir.push(user)
                    actualizar_lista_contactos_añadir()
                }
            })
        }
    }
}

export async function crear_chat_nuevo() {
    if (contactos_añadir.length === 0) return
    
    const ids = contactos_añadir.map(x => x.id)
    const nombre = document.querySelector("#nombre-grupo-nuevo")?.value || ""
    
    const result = await window.chats.CREAR_CHAT_NUEVO(ids, nombre)
    if (result.success) {
        desplegar_menu_añadir_chat({ mostrar: false })
        // Callback to refresh chat list in renderer
        if (window.refrescar_listas_chat) window.refrescar_listas_chat()
    } else {
        window.pushNotificacion({ prioridad: 1, texto: result.message || "Error al crear chat", tipo: "error" })
    }
}
