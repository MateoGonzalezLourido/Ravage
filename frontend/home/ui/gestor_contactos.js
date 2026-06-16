import { abrir_chat_item, ACTUALIZAR_LISTAS_CHAT, marcar_chat_activo, resolver_menciones_previews } from './gestor_chats.js';
import { escapeHTML, safeIdSelector } from './seguridad_ui.js';
import { chat_componente_lista_estructura_html } from './chat.js';

function _componente_con_chat(chat_id, apodo, contacto_id, chat_raw) {
    const datos = {
        id: chat_id,
        nombre: apodo || "Sin nombre",
        ultimoCambio: chat_raw.ultimoCambio,
        ultimomensaje: chat_raw.ultimomensaje,
        usuarios: [null, null],
        silenciado: chat_raw.silenciado || false,
        bloqueado: chat_raw.bloqueado || false,
    };
    const html = chat_componente_lista_estructura_html(datos);
    return html.replace(
        `data-id="${chat_id}"`,
        `data-id="${chat_id}" data-contacto-id="${contacto_id}" data-apodo="${escapeHTML(apodo || '')}"`
    );
}

function _componente_sin_chat(contacto_id, apodo) {
    return `
    <div data-id="" data-contacto-id="${contacto_id}" data-apodo="${escapeHTML(apodo || '')}" class="chat-componente-lista-chats">
        <div class="nombre-chat-lista-componente">
            <span class="nombre-texto">${escapeHTML(apodo || 'Sin nombre')}</span>
        </div>
        <div class="ultimo-mensaje-chat-lista"><span>Sin chat</span></div>
        <div class="iconos-estado-chat"></div>
    </div>`;
}

export async function CARGAR_LISTA_CONTACTOS(filtro = "") {
    const contenedor = document.getElementById("lista-contactos-componentes");
    if (!contenedor) return;

    try {
        const [contactos, lista_chats, historial] = await Promise.all([
            window.social_usuario.OBTENER_CONTACTOS_USUARIO(),
            window.chats.OBTENER_CHATS_USUARIO(),
            window.social_usuario.OBTENER_HIST_CHATS_CONTACTOS()
        ]);

        const lista_contactos = Array.isArray(contactos) ? contactos : [];
        const lista_chats_arr = Array.isArray(lista_chats) ? lista_chats : [];
        const hist = Array.isArray(historial) ? historial : [];

        const ids_contactos_actuales = new Set(lista_contactos.map(c => c.id));
        const ex_contactos = hist.filter(h => h.chat_id && !ids_contactos_actuales.has(h.usuario_id));

        const lista_filtrada = filtro
            ? lista_contactos.filter(c => (c.apodo || "").toLowerCase().includes(filtro.toLowerCase()))
            : lista_contactos;

        const html_contactos = lista_filtrada.map(c => {
            if (c.chat_id) {
                const chat_raw = lista_chats_arr.find(ch => ch.id === c.chat_id);
                if (chat_raw) return _componente_con_chat(c.chat_id, c.apodo, c.id, chat_raw);
            }
            return _componente_sin_chat(c.id, c.apodo);
        });

        const ex_filtrados = filtro
            ? ex_contactos.filter(ex => (ex.apodo || "").toLowerCase().includes(filtro.toLowerCase()))
            : ex_contactos;

        const html_ex = ex_filtrados
            .filter(ex => lista_chats_arr.some(ch => ch.id === ex.chat_id))
            .map(ex => {
                const chat_raw = lista_chats_arr.find(ch => ch.id === ex.chat_id);
                return _componente_con_chat(ex.chat_id, ex.apodo, "", chat_raw);
            });

        const todo = [...html_contactos, ...html_ex].join("");

        if (!todo.trim()) {
            contenedor.innerHTML = '<div class="contactos-lista-vacia">Sin contactos</div>';
            return;
        }

        contenedor.innerHTML = todo;
        marcar_chat_activo();
        await resolver_menciones_previews(contenedor);
    } catch (e) {
        console.error("[Contactos] Error al cargar:", e);
    }
}

export async function abrir_chat_por_contacto(id_contacto, apodo, chat_id_guardado) {
    try {
        if (chat_id_guardado) {
            await abrir_chat_item(chat_id_guardado);
            return;
        }

        const result = await window.chats.CREAR_CHAT_NUEVO([id_contacto], apodo || "");

        if (result && (result.id || result._id)) {
            const id_nuevo = (result.id || result._id)?.toString();

            // Vincular ANTES de refrescar listas: así el chat queda marcado como
            // chat de contacto y ACTUALIZAR_LISTAS_CHAT lo excluye de "chats"
            // (solo debe aparecer en contactos). Si no se espera, la lista se
            // reconstruye antes del vínculo y el chat se cuela en "chats".
            await window.social_usuario.VINCULAR_CHAT_CONTACTO(id_contacto, id_nuevo).catch(e =>
                console.error("[Contactos] Error al vincular chat:", e)
            );

            const el = document.querySelector(`[data-contacto-id="${id_contacto}"]`);
            if (el) el.dataset.id = id_nuevo;

            await ACTUALIZAR_LISTAS_CHAT();
            await abrir_chat_item(id_nuevo);
        } else if (result?.solicitud) {
            window.pushNotificacion({ prioridad: 1, texto: "Solicitud enviada al contacto", tipo: "info" });
        } else {
            window.pushNotificacion({ prioridad: 0, texto: "No se pudo abrir el chat con este contacto", tipo: "error" });
        }
    } catch (e) {
        console.error("[Contactos] Error al abrir chat:", e);
        window.pushNotificacion({ prioridad: 0, texto: "Error al abrir el chat", tipo: "error" });
    }
}

export function mostrar_menu_contextual_contacto(e, id_contacto, chat_id) {
    document.querySelector(".context-menu-contacto")?.remove();

    const es_ex_contacto = !id_contacto || id_contacto === "";
    const items = [];

    if (!es_ex_contacto) {
        items.push(`<div class="context-menu-item" data-action="eliminar-contacto" style="color:#f87171;">Eliminar Contacto</div>`);
    }
    if (chat_id) {
        if (es_ex_contacto) {
            items.push(`<div class="context-menu-item" data-action="eliminar-chat" style="color:#f87171;">Eliminar Chat</div>`);
        } else {
            items.push(`<div class="context-menu-item" data-action="limpiar-chat">Limpiar Chat</div>`);
        }
    }

    if (items.length === 0) return;

    const menu = document.createElement("div");
    menu.className = "context-menu context-menu-contacto";
    menu.style.cssText = "position:fixed;z-index:1000;";
    menu.innerHTML = items.join("");
    document.body.appendChild(menu);

    menu.style.left = e.clientX + "px";
    menu.style.top = e.clientY + "px";

    const cerrar = (ev) => {
        if (!menu.contains(ev.target)) {
            menu.remove();
            document.removeEventListener("mousedown", cerrar);
        }
    };
    setTimeout(() => document.addEventListener("mousedown", cerrar), 0);

    menu.addEventListener("click", async (ev) => {
        const action = ev.target.dataset.action;
        menu.remove();
        document.removeEventListener("mousedown", cerrar);

        if (action === "eliminar-contacto") {
            const ok = await window.social_usuario.ELIMINAR_CONTACTO(id_contacto);
            if (ok) {
                window.pushNotificacion({ prioridad: 1, texto: "Contacto eliminado", tipo: "success" });
                await CARGAR_LISTA_CONTACTOS();
            } else {
                window.pushNotificacion({ prioridad: 2, texto: "No se pudo eliminar el contacto", tipo: "error" });
            }
        } else if (action === "eliminar-chat") {
            const res = await window.chats.GESTIONAR_ELIMINAR_CHAT(chat_id);
            if (res?.success) {
                window.pushNotificacion({ prioridad: 1, texto: "Chat eliminado", tipo: "success" });
                document.querySelector(`#nav-principal-chat-usuario${safeIdSelector(chat_id)}`)?.remove();
                await ACTUALIZAR_LISTAS_CHAT();
                await CARGAR_LISTA_CONTACTOS();
            } else {
                window.pushNotificacion({ prioridad: 2, texto: "No se pudo eliminar el chat", tipo: "error" });
            }
        } else if (action === "limpiar-chat") {
            const ok = await window.chats.LIMPIAR_MENSAJES_CHAT(chat_id);
            if (ok) {
                window.pushNotificacion({ prioridad: 1, texto: "Chat limpiado", tipo: "success" });
                await ACTUALIZAR_LISTAS_CHAT();
                await CARGAR_LISTA_CONTACTOS();
                if (document.querySelector(`#nav-principal-chat-usuario${safeIdSelector(chat_id)}`)) {
                    await abrir_chat_item(chat_id, true);
                }
            } else {
                window.pushNotificacion({ prioridad: 2, texto: "No se pudo limpiar el chat", tipo: "error" });
            }
        }
    });
}
