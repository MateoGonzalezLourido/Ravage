const { ipcRenderer } = require('electron');

module.exports = {
    OBTENER_AJUSTES_APP: (nombre) => {
        return ipcRenderer.invoke("obtener-ajustes-app", nombre)
    },
    GUARDAR_AJUSTES_APP: (data) => {
        return ipcRenderer.invoke("guardar-ajustes-app", data)
    },
    // Exporta los .env cifrados del baúl a la carpeta Descargas del usuario
    EXPORTAR_ENV_A_DESCARGAS: () => {
        return ipcRenderer.invoke("vault:exportar-env")
    }
};
