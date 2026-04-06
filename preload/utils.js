const { ipcRenderer } = require('./libs.js');

module.exports = {
    obtener_previsualizacion_url: (text) => {
        return ipcRenderer.invoke("utilidades-app-previsualizar-url", text)
    }
};
