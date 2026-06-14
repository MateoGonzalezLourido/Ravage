const { ipcRenderer } = require('electron');

module.exports = {
    OBTENER_AJUSTES_APP: (nombre) => {
        return ipcRenderer.invoke("obtener-ajustes-app", nombre)
    },
    GUARDAR_AJUSTES_APP: (data) => {
        return ipcRenderer.invoke("guardar-ajustes-app", data)
    },
    EXPORTAR_ENV_A_DESCARGAS: () => {
        return ipcRenderer.invoke("vault:exportar-env")
    },
    EXPORTAR_CLAVE_PRIVADA: () => {
        return ipcRenderer.invoke("exportar-clave-privada")
    },
    IMPORTAR_CLAVE_PRIVADA_ARCHIVO: () => {
        return ipcRenderer.invoke("identity-importar-clave-archivo")
    },
    LISTAR_CLAVES_IDENTIDAD: () => {
        return ipcRenderer.invoke("identity-listar-claves")
    },
    CAMBIAR_CLAVE_PRINCIPAL: (keyId) => {
        return ipcRenderer.invoke("identity-cambiar-principal", keyId)
    },
    ELIMINAR_CLAVE_SOPORTE: (keyId) => {
        return ipcRenderer.invoke("identity-eliminar-soporte", keyId)
    },
    EXPORTAR_CLAVE_POR_ID: (keyId) => {
        return ipcRenderer.invoke("identity-exportar-clave", keyId)
    },
    VERIFICAR_CONTRASENA_ACTUAL: (contraseña) => {
        return ipcRenderer.invoke("verificar-contraseña-actual", contraseña)
    },
    OBTENER_EMAIL_SOPORTE: () => {
        return ipcRenderer.invoke("obtener-email-soporte")
    },
    CONFIGURAR_PIN: (oldPin, newPin) => {
        return ipcRenderer.invoke("configurar-pin-seguridad", oldPin, newPin)
    },
    VERIFICAR_PIN: (pinAttempt) => {
        return ipcRenderer.invoke("verificar-pin-seguridad", pinAttempt)
    },
    TIENE_PIN: () => {
        return ipcRenderer.invoke("tiene-pin-seguridad")
    }
};
