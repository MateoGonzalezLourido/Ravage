const { ipcRenderer } = require('electron');

module.exports = {
    obtener_previsualizacion_url: (text) => {
        return ipcRenderer.invoke("utilidades-app-previsualizar-url", text)
    }
};
