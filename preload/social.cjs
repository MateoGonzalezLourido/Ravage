const { ipcRenderer } = require('electron');

module.exports = {
    ENCONTRAR_USUARIOS_EXTERNOS: (texto, correo = false) => {
        return ipcRenderer.invoke("encontrar-usuario-externo", texto, correo)
    },
    OBTENER_DATOS_USUARIO_EXTERNO: (id, datos = null) => {
        return ipcRenderer.invoke("obtener-datos-usuario-externo", id, datos)
    },
    OBTENER_VARIOS_DATOS_USUARIOS_EXTERNOS: (ids, datos = null) => {
        return ipcRenderer.invoke("obtener-varios-usuarios-externos", ids, datos)
    },
    OBTENER_CONTACTOS_USUARIO: () => {
        return ipcRenderer.invoke("obtener-contactos-usuario")
    },
    OBTENER_USUARIOS_BLOQUEADOS: () => {
        return ipcRenderer.invoke("obtener-usuarios-bloqueados")
    },
    OBTENER_USUARIOS_SILENCIADOS: () => {
        return ipcRenderer.invoke("obtener-usuarios-silenciados")
    },
    AÑADIR_CONTACTO: (id, apodo) => {
        return ipcRenderer.invoke("añadir-contacto", id, apodo)
    },
    AÑADIR_USUARIO_BLOQUEADOS: (id, apodo) => {
        return ipcRenderer.invoke("añadir-usuarios-bloqueados", id, apodo)
    },
    ELIMINAR_USUARIO_BLOQUEADO: (id) => {
        return ipcRenderer.invoke("eliminar-usuarios-bloqueados", id)
    },
    AÑADIR_USUARIO_SILENCIADOS: (id, apodo) => {
        return ipcRenderer.invoke("añadir-usuarios-silenciados", id, apodo)
    },
    ELIMINAR_USUARIO_SILENCIADOS: (id) => {
        return ipcRenderer.invoke("eliminar-usuarios-silenciados", id)
    },
    TOGGLE_INVISIBLE_USUARIO: () => {
        return ipcRenderer.invoke("toggle-invisible-usuario")
    },
    TOGGLE_MOSTRAR_CORREO_USUARIO: () => {
        return ipcRenderer.invoke("toggle-mostrar-correo-usuario")
    },
    GUARDAR_VARIOS_DATOS_USUARIOS_EXTERNOS: (usuarios) => {
        return ipcRenderer.invoke("guardar-varios-usuarios-externos", usuarios)
    }
};
