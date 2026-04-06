const { ipcRenderer } = require('electron');

module.exports = {
    VALIDAR_CORREO: (correo) => ipcRenderer.invoke('validar-correo', correo),
    VALIDAR_APODO: (apodo) => ipcRenderer.invoke('validar-apodo', apodo),
    VALIDAR_CONTRASEÑA: (contraseña) => ipcRenderer.invoke('validar-contraseña', contraseña),
    VALIDAR_IDAMIGO: (idAmigo) => ipcRenderer.invoke('validar-idamigo', idAmigo),
    VALIDAR_CODIGO: (codigo) => ipcRenderer.invoke('validar-codigo', codigo),
    VALIDAR_MENSAJE: (mensaje) => ipcRenderer.invoke('validar-mensaje', mensaje),
    VALIDAR_NOMBRE_ARCHIVO: (nombre) => ipcRenderer.invoke('validar-nombre-archivo', nombre)
};
