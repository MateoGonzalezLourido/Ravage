const { ipcRenderer } = require('./libs.js');

module.exports = {
    CAMBIAR_PAGINA_SOPORTE: () => ipcRenderer.send("cambiar-pagina-soporte"),
    CAMBIAR_PAGINA_HOME: () => ipcRenderer.send("cambiar-pagina-home"),
    CAMBIAR_PAGINA_SESION: () => ipcRenderer.send("cambiar-pagina-log")
};
