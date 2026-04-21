const { ipcRenderer } = require('electron');

module.exports = {
    OBTENER_CHATS_USUARIO: () => {
        return ipcRenderer.invoke("obtener-chats-usuario")
    },
    OBTENER_DATOS_CHATS_GRUPALES: ({ data, grupales, mensajes }) => {
        return ipcRenderer.invoke("obtener-datos-chats-grupales-usuario", { data, grupales, mensajes })
    },
    OBTENER_DATOS_CHAT_UNICO: (id, datos_buscar = null) => {
        return ipcRenderer.invoke("obtener-datos-chat-unico-usuario", id, datos_buscar)
    },
    OBTENER_MENSAJES_PAGINADOS: (id_chat, limit = 30, cursor_date = null, direction = 'older') => {
        return ipcRenderer.invoke("obtener-mensajes-chat-paginados", id_chat, limit, cursor_date, direction)
    },
    CREAR_CHAT_NUEVO: (ids, nombre, id_chat = null) => {
        return ipcRenderer.invoke("crear-chat-nuevo", ids, nombre, id_chat)
    },
    ENVIAR_MENSAJE: ({ asunto, archivos, id_chat, id_emisor }) => {
        return ipcRenderer.invoke("enviar-mensaje", { asunto, archivos, id_chat, id_emisor })
    },
    SELECCIONAR_ARCHIVOS: () => {
        return ipcRenderer.invoke("seleccionar-archivos")
    },
    DESCARGAR_ARCHIVO: (id, nombre, iv = null, tag = null, id_chat = null, ratchet_info = null, emisor_id = null) => {
        return ipcRenderer.invoke("descargar-archivo", id, nombre, iv, tag, id_chat, ratchet_info, emisor_id)
    },
    OBTENER_DATOS_MENSAJE: (id_chat, id_mensaje) => {
        return ipcRenderer.invoke("obtener-datos-mensaje", id_chat, id_mensaje)
    },
    EXPULSAR_USUARIO_CHAT: (id_usuario, id_chat) => {
        return ipcRenderer.invoke("expulsar-usuario-chat", id_usuario, id_chat)
    },
    RESPONDER_SOLICITUD_AÑADIR: (id_chat, id_mensaje, aceptar) => {
        return ipcRenderer.invoke("responder-solicitud-añadir", id_chat, id_mensaje, aceptar)
    },
    HACER_ADMIN_CHAT: (id_chat, id_usuario) => {
        return ipcRenderer.invoke("hacer-admin-chat", id_chat, id_usuario)
    },
    QUITAR_ADMIN_CHAT: (id_chat, id_usuario) => {
        return ipcRenderer.invoke("quitar-admin-chat", id_chat, id_usuario)
    },
    SILENCIAR_CHAT: (id_chat) => {
        return ipcRenderer.invoke("silenciar-chat", id_chat)
    },
    BLOQUEAR_CHAT: (id_chat) => {
        return ipcRenderer.invoke("bloquear-chat", id_chat)
    },
    GUARDAR_CACHE_CHAT_ACTIVO: (data) => {
        return ipcRenderer.invoke("guardar-cache-chat-activo", data)
    },
    OBTENER_CACHE_CHAT_ACTIVO: (id, bloque) => {
        return ipcRenderer.invoke("obtener-cache-chat-activo", id, bloque)
    },
    OBTENER_MODELO_DATOS_NECESARIOS_CHAT: () => {
        return ipcRenderer.invoke("obtener-modelo-datos-necesarios-chat")
    }
};
