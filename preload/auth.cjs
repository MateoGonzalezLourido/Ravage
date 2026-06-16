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
    MARCAR_DISPOSITIVO_CONFIANZA: () => {
        return ipcRenderer.invoke('marcar-dispositivo-confianza')
    },
    REVOCAR_DISPOSITIVO_CONFIANZA: () => {
        return ipcRenderer.invoke('revocar-dispositivo-confianza')
    },
    ESTADO_DISPOSITIVO_CONFIANZA: () => {
        return ipcRenderer.invoke('estado-dispositivo-confianza')
    },
    OBTENER_GESTION_DISPOSITIVOS: () => {
        return ipcRenderer.invoke('obtener-gestion-dispositivos')
    },
    REVOCAR_SESION_DISPOSITIVO: (id_dp_hash) => {
        return ipcRenderer.invoke('revocar-sesion-dispositivo', id_dp_hash)
    },
    REVOCAR_CONFIANZA_DISPOSITIVO: (id_dp_hash) => {
        return ipcRenderer.invoke('revocar-confianza-dispositivo', id_dp_hash)
    },
    BLOQUEAR_DISPOSITIVO: (id_dp_hash) => {
        return ipcRenderer.invoke('bloquear-dispositivo', id_dp_hash)
    },
    DESBLOQUEAR_DISPOSITIVO: (id_dp_hash) => {
        return ipcRenderer.invoke('desbloquear-dispositivo', id_dp_hash)
    }
};
