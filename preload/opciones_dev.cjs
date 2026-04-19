const { ipcRenderer } = require('electron');

module.exports = {
    isDev: process.env.MODO_DEBUG === "true"
}