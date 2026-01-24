const { contextBridge, ipcRenderer } = require('electron');

const startArg = process.argv.find(a => a.startsWith('--start='));
const startPage = startArg?.split('=')[1] ?? 'true'; //esta autologueado

contextBridge.exposeInMainWorld('sesion_usuario', {//funciones de sesion
    LOGIN_USUARIO: (usuario, contraseña) => {
        return ipcRenderer.invoke('login-usuario', usuario, contraseña)
        //verificar si existe y esta todo correcto
    },
    REGISTRAR_USUARIO: (apodo, username, password) => {
        return ipcRenderer.invoke('registrar-usuario', apodo, username, password)
    },
    VALIDAR_CODE_REGISTRAR_USUARIO: (correo, code) => {
        return ipcRenderer.invoke('validar-code-registrar-usuario', correo, code)
    }
})
contextBridge.exposeInMainWorld('boot', {//funciones de inicio de la app
    isLogged: startPage === 'true'
});