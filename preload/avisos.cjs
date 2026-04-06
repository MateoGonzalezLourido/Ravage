const { ipcRenderer } = require('electron');

module.exports={
    ICONO_CARGANDO: (callback) => {
        ipcRenderer.on("icono-cargando", (_, mostrar) => callback(mostrar));
    },
    FALLO_CORREO_MANDAR: (callback) => {
        ipcRenderer.on("fallo-correo-mandar", () => callback());
    },
    CERRANDO_SESION: (callback) => {
        ipcRenderer.on("cerrando-sesion", (_, mostrar) => callback(mostrar));
    }
}