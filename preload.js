const { contextBridge, ipcRenderer } = require('electron');

const startArg = process.argv.find(a => a.startsWith('--start='));
const startPage = startArg?.split('=')[1] ?? 'true'; //esta autologueado

contextBridge.exposeInMainWorld('sesion_usuario', {//funciones de sesion
    LOGIN_USUARIO: (usuario, contraseña, mantener_sesion_iniciada) => {
        return ipcRenderer.invoke('login-usuario', usuario, contraseña, mantener_sesion_iniciada)
        //verificar si existe y esta todo correcto
    },
    REGISTRAR_USUARIO: (apodo, username, password) => {
        return ipcRenderer.invoke('registrar-usuario', apodo, username, password)
    },
    VALIDAR_CODE_REGISTRAR_USUARIO: (correo, code) => {
        return ipcRenderer.invoke('validar-code-registrar-usuario', correo, code)
    },
    VALIDAR_CODE_LOGIN_USUARIO: (username, password) => {
        return ipcRenderer.invoke('validar-code-login-usuario', username, password)
    },
    BORRAR_CODES_VALIDACION_CORREO: (correo) => {
        return ipcRenderer.invoke('borrar-code-registrar-usuario', correo)
    }
})
contextBridge.exposeInMainWorld('boot', {//funciones de inicio de la app
    isLogged: startPage === 'true'
});