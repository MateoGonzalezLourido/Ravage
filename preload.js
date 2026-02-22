/*aqui todo se usa como puente para mandar "llamadas de funciones" o "valores de variables" entre frontend y backend para no exponer el backend en el fronted
Es decir, puedes mandar datos entre fronted y backend ,y llamar funciones para que interactuen frontend y backend y la app funcione correctamente
*/

const { contextBridge, ipcRenderer } = require('electron');

const startArg = process.argv.find(a => a.startsWith('--start='));//coger argumentos de la ventana añadidos
const startPage = startArg?.split('=')[1] ?? 'true'; //esta autologueado: argumento de autolog de la ventana

//estas funciones son llamamientos desde el render que crean llamadas para que desde el main se ejecuten las funciones y codigo correspondiente que no puede ir/no pertenece  al render y preload
//los nombres de exposeInMainWorld('name) es el que quermos darle a ese grupo de funciones; pueden haber muchos grupos de funciones.
contextBridge.exposeInMainWorld('boot', {//funciones de inicio de la app
    isLogged: startPage === 'true'
});
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
    },
    CERRAR_SESION: () => {
        return ipcRenderer.invoke('cerrar-sesion-usuario')
    },
    PERMITIR_CAMBIO_DATOS_CUENTA: ({ data = null, tipo }) => {
        return ipcRenderer.invoke("permitir-cambio-datos-cuenta", data, tipo)
    },
    CAMBIAR_DATOS_CUENTA: (contraseña, code, tipo) => {
        return ipcRenderer.invoke("cambiar-datos-usuario", contraseña, code, tipo)
    },
    GET_APODO_SESION: () => {
        return ipcRenderer.invoke("obtener-apodo-sesion")
    },
    COMPROBAR_CONTRASEÑA: ({ contraseña }) => {
        return ipcRenderer.invoke("comprobar-contraseña-cuenta", contraseña)
    }
})
contextBridge.exposeInMainWorld('paginas_app', {//funciones de cambio paginas
    CAMBIAR_PAGINA_SOPORTE: () => {
        ipcRenderer.send("cambiar-pagina-soporte");
    },
    CAMBIAR_PAGINA_HOME: () => {
        ipcRenderer.send("cambiar-pagina-home");
    },
    CAMBIAR_PAGINA_SESION: () => {
        ipcRenderer.send("cambiar-pagina-log");
    }
})
contextBridge.exposeInMainWorld('ajustes_app', {//funciones de ajustes
    OBTENER_FECHA_CREACION_CUENTA: () => {
        return ipcRenderer.invoke("obtener-fecha-creacion-cuenta");
    },
    OBTENER_FECHA_BLOQUEO_APODO: () => {
        return ipcRenderer.invoke("obtener-fecha-bloqueo-apodo")
    },
    OBTENER_FECHA_BLOQUEO_CORREO: () => {
        return ipcRenderer.invoke("obtener-fecha-bloqueo-correo")
    },
    OBTENER_FECHA_BLOQUEO_CONTRASEÑA: () => {
        return ipcRenderer.invoke("obtener-fecha-bloqueo-contraseña")
    },
    OBTENER_USUARIOS_BLOQUEADOS: () => {
        return ipcRenderer.invoke("obtener-usuarios-bloqueados")
    },
    OBTENER_USUARIOS_SILENCIADOS: () => {
        return ipcRenderer.invoke("obtener-usuarios-silenciados")
    },
    ELIMINAR_USUARIO_BLOQUEADO: (id) => {
        return ipcRenderer.invoke("eliminar-usuarios-bloqueados", id)
    },
    ELIMINAR_USUARIO_SILENCIADOS: (id) => {
        return ipcRenderer.invoke("eliminar-usuarios-silenciados", id)
    },
    AÑADIR_USUARIO_SILENCIADOS: (id, apodo) => {
        return ipcRenderer.invoke("añadir-usuarios-silenciados", id, apodo)
    },
    AÑADIR_USUARIO_BLOQUEADOS: (id, apodo) => {
        return ipcRenderer.invoke("añadir-usuarios-bloqueados", id, apodo)
    }
})

contextBridge.exposeInMainWorld('datos_usuario', {//funciones de ajustes
    OBTENER_CHATS_USUARIO: () => {
        return ipcRenderer.invoke("obtener-chats-usuario")
    },
    OBTENER_DATOS_CHATS_GRUPALES: ({ data, grupales, mensajes }) => {
        return ipcRenderer.invoke("obtener-datos-chats-grupales-usuario", { data, grupales, mensajes })
    },
    OBTENER_DATOS_CHAT_UNICO: (id) => {
        return ipcRenderer.invoke("obtener-datos-chats-grupales-usuario", id)
    },
    LIMPIAR_MENSAJES_CHATS_ANTIGUOS: (chatIds) => {
        ipcRenderer.send("limpiar-chats-antiguos-mensajes", chatIds)
    },
    OBTENER_ID_MONGODB_USUARIO: () => {
        return ipcRenderer.invoke("obtener-id-mongodb-usuario")
    },
    OBTENER_DATOS_USUARIO_EXTERNO: (id, datos = null) => {
        return ipcRenderer.invoke("obtener-datos-usuario-externo", id, datos)
    },
    ENCONTRAR_USARIOS_EXTERNOS: (texto, correo = false) => {
        return ipcRenderer.invoke("encontrar-usuario-externo", texto, correo)
    },
    CREAR_CHAT_NUEVO: (ids, nombre) => {
        return ipcRenderer.invoke("crear-chat-nuevo", ids, nombre)
    }

})