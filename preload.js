const { contextBridge, ipcRenderer } = require('electron');

const startArg = process.argv.find(a => a.startsWith('--start='));
const startPage = startArg?.split('=')[1] ?? 'true'; //esta autologueado

contextBridge.exposeInMainWorld('api', {
    LOGIN_USUARIO: (usuario, contraseña) => {
        ipcRenderer.invoke('login-usuario', usuario, contraseña)
        //verificar si existe y esta todo correcto
    },
    REGISTRAR_USUARIO: (usuario, contraseña) => {
        ipcRenderer.invoke('registrar-usuario', usuario, contraseña)
        //verificar si existe

        //registrar + crear tablas de datos del usuario nuevo
    }
})
contextBridge.exposeInMainWorld('boot', {
    isLogged: startPage === 'true'
});