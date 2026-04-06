const { ipcRenderer } = require('electron');

module.exports = {
    LOGIN_USUARIO: (usuario, contraseña, mantener_sesion_iniciada) => {
        return ipcRenderer.invoke('login-usuario', usuario, contraseña, mantener_sesion_iniciada)
    },
    REGISTRAR_USUARIO: (apodo, username, password) => {
        return ipcRenderer.invoke('registrar-usuario', apodo, username, password)
    },
    VALIDAR_CODE_REGISTRAR_USUARIO: (correo, code) => {
        return ipcRenderer.invoke('validar-code-registrar-usuario', correo, code)
    },
    VALIDAR_CODE_LOGIN_USUARIO: (username, password) => {
        return ipcRenderer.invoke('validar-code-login-usuario', username, password)
    },
    BORRAR_CODES_VALIDACION_CORREO: (correo) => {
        return ipcRenderer.invoke('borrar-code-registrar-usuario', correo)
    },
    BORRAR_CODES_VALIDACION_CUENTA: (correo) => {
        return ipcRenderer.invoke('borrar-code-login-usuario', correo)
    },
    CERRAR_SESION: () => {
        return ipcRenderer.invoke('cerrar-sesion-usuario')
    },
    ICONO_CARGANDO: (callback) => {
        ipcRenderer.on("icono-cargando", (_, mostrar) => callback(mostrar));
    },
    FALLO_CORREO_MANDAR: (callback) => {
        ipcRenderer.on("fallo-correo-mandar", () => callback());
    },
    CERRANDO_SESION: (callback) => {
        ipcRenderer.on("cerrando-sesion", (_, mostrar) => callback(mostrar));
    },
};
