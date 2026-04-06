const { ipcRenderer } = require('./libs.js');

module.exports = {
    REVISAR_BUZON: () => {
        return ipcRenderer.invoke("revisar-buzon");
    },
    INICIAR_BUZON: () => {
        ipcRenderer.send("iniciar-buzon");
    },
    onNuevaNotificacion: (callback) => {
        ipcRenderer.on("nueva-notificacion", (_, data) => callback(data));
    },
    onNotificarRender: (callback) => {
        ipcRenderer.on("notificar-render", (_, data) => callback(data));
    }
};
