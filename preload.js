/*aqui todo se usa como puente para mandar "llamadas de funciones" o "valores de variables" entre frontend y backend para no exponer el backend en el fronted
Es decir, puedes mandar datos entre fronted y backend ,y llamar funciones para que interactuen frontend y backend y la app funcione correctamente
*/

const { contextBridge, ipcRenderer } = require('electron');

const startArg = process.argv.find(a => a.startsWith('--start='));//coger argumentos de la ventana añadidos
const startPage = startArg?.split('=')[1] ?? 'true'; //esta autologueado: argumento de autolog de la ventana

//estas funciones son llamamientos desde el render que crean llamadas para que desde el main se ejecuten las funciones y codigo correspondiente que no puede ir/no pertenece  al render y preload
//los nombres de exposeInMainWorld('name) es el que quermos darle a ese grupo de funciones; pueden haber muchos grupos de funciones.
contextBridge.exposeInMainWorld('sesion_usuario', {//funciones de sesion
    LOGIN_USUARIO: (usuario, contraseña, mantener_sesion_iniciada) => {//funcion que se llama desde el render con window.sesion_usuario.funcion(parametros)
        return ipcRenderer.invoke('login-usuario', usuario, contraseña, mantener_sesion_iniciada)
        //ipcrenderer.invoke hace el llamamiento al main para que ese ejecute el codigo
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
    },
    BORRAR_CODES_VALIDACION_CUENTA: (correo) => {
        return ipcRenderer.invoke('borrar-code-login-usuario', correo)
    }
})

contextBridge.exposeInMainWorld('boot', {//funciones de inicio de la app
    isLogged: startPage === 'true'
});