const { ipcRenderer } = require('electron');

module.exports = {
    GET_APODO_SESION: () => {
        return ipcRenderer.invoke("obtener-apodo-sesion")
    },
    OBTENER_CORREO_USUARIO: () => {
        return ipcRenderer.invoke("obtener-correo-usuario")
    },
    OBTENER_ID_MONGODB_USUARIO: () => {
        return ipcRenderer.invoke("obtener-id-mongodb-usuario")
    },
    OBTENER_IDAMIGO_USUARIO: () => {
        return ipcRenderer.invoke("obtener-idamigo-usuario")
    },
    COMPROBAR_CONTRASEÑA: ({ contraseña }) => {
        return ipcRenderer.invoke("comprobar-contraseña-cuenta", contraseña)
    },
    PERMITIR_CAMBIO_DATOS_CUENTA: ({ data = null, tipo, contraseña_actual = null }) => {
        return ipcRenderer.invoke("permitir-cambio-datos-cuenta", data, tipo, contraseña_actual)
    },
    CAMBIAR_DATOS_CUENTA: (contraseña, code, tipo) => {
        return ipcRenderer.invoke("cambiar-datos-usuario", contraseña, code, tipo)
    },
    OBTENER_FECHA_CREACION_CUENTA: () => {
        return ipcRenderer.invoke("obtener-fecha-creacion-cuenta")
    },
    OBTENER_FECHA_BLOQUEO_APODO: () => {
        return ipcRenderer.invoke("obtener-fecha-bloqueo-apodo")
    },
    OBTENER_FECHA_BLOQUEO_CORREO: () => {
        return ipcRenderer.invoke("obtener-fecha-bloqueo-correo")
    },
    OBTENER_FECHA_BLOQUEO_CONTRASEÑA: () => {
        return ipcRenderer.invoke("obtener-fecha-bloqueo-contraseña")
    },
    OBTENER_USUARIOS_BLOQUEADOS: () => {
        return ipcRenderer.invoke("obtener-usuarios-bloqueados")
    },
    OBTENER_USUARIOS_SILENCIADOS: () => {
        return ipcRenderer.invoke("obtener-usuarios-silenciados")
    },
    OBTENER_MOSTRAR_CORREO_USUARIO: () => {
        return ipcRenderer.invoke("obtener-mostrar-correo-usuario")
    },
};
