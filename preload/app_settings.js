const { ipcRenderer } = require('./libs.js');

module.exports = {
    OBTENER_AJUSTES_APP: (nombre) => {
        return ipcRenderer.invoke("obtener-ajustes-app", nombre)
    },
    GUARDAR_AJUSTES_APP: (data) => {
        return ipcRenderer.invoke("guardar-ajustes-app", data)
    }
};
