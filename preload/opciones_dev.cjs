const { ipcRenderer } = require('electron');

module.exports = {
    contextBridge.exposeInMainWorld('env', {
        isDev: Boolean(process.env.MODO_DEBUG) || false
    });
}