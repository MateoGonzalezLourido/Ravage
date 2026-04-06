const { ipcRenderer } = require('./libs.js');

module.exports = {
    ESCANERES_SEGURIDAD_MENSAJE: (id_chat) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-mensaje", id_chat)
    },
    detectar_escenografia: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-detectar-escenografia", text)
    },
    eliminar_escenografia: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-eliminar-escenografia", text)
    },
    detectar_url: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-detectar-url", text)
    },
    eliminar_url: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-eliminar-url", text)
    },
    detectar_url_maliciosa: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-detectar-url-maliciosa", text)
    },
    detectar_xss: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-detectar-xss", text)
    },
    detectar_codigo: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-detectar-codigo", text)
    },
    detectar_zalgo: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-detectar-zalgo", text)
    },
    eliminar_zalgo: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-eliminar-zalgo", text)
    },
    detectar_comandos_terminal: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-detectar-comandos-terminal", text)
    },
    detectar_crypto_billeteras: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-detectar-crypto-billeteras", text)
    },
    detectar_direcciones_ip: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-detectar-direcciones-ip", text)
    },
    detectar_homoglifos: (text) => {
        return ipcRenderer.invoke("escaneres-seguridad-app-detectar-homoglifos", text)
    }
};
