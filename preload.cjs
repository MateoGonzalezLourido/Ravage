/*
  Puente entre frontend y backend (contextBridge).
  Expone únicamente lo necesario al renderer, sin exponer el backend directamente.
  Cada grupo de funciones representa un dominio lógico de la aplicación.
  OBLIGATORIAMENTE DEBE SER UN CJS (CommonJS)
*/

//por precaucion es mejor usar require(temas de soporte del preload) y no mover estas improtaciones de aqui (porque es muy probable que cargue antes que lib.js)
const { contextBridge, ipcRenderer } = require('electron');

const startArg = process.argv.find(a => a.startsWith('--start='));
const startPage = startArg?.split('=')[1] ?? 'true';

// ─── BOOT ─────────────────────────────────────────────────────────────────────
// Estado inicial de la app al arrancar
contextBridge.exposeInMainWorld('boot', {
    isLogged: startPage === 'true'
});

// ─── SESIÓN ───────────────────────────────────────────────────────────────────
// Login, registro, verificación de códigos y cierre de sesión
contextBridge.exposeInMainWorld('sesion_usuario', {
    LOGIN_USUARIO: (usuario, contraseña, mantener_sesion_iniciada) => {
        return ipcRenderer.invoke('login-usuario', usuario, contraseña, mantener_sesion_iniciada)
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
    }
});

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────
// Cambio de páginas/vistas dentro de la app
contextBridge.exposeInMainWorld('paginas_app', {
    CAMBIAR_PAGINA_SOPORTE: () => ipcRenderer.send("cambiar-pagina-soporte"),
    CAMBIAR_PAGINA_HOME: () => ipcRenderer.send("cambiar-pagina-home"),
    CAMBIAR_PAGINA_SESION: () => ipcRenderer.send("cambiar-pagina-log")
});

// ─── CUENTA DEL USUARIO ───────────────────────────────────────────────────────
// Datos propios del usuario (IDs, correo, apodo) y modificación de cuenta
contextBridge.exposeInMainWorld('cuenta_usuario', {
    // Obtener datos
    GET_APODO_SESION: () => {
        return ipcRenderer.invoke("obtener-apodo-sesion")
    },
    OBTENER_CORREO_USUARIO: () => {
        return ipcRenderer.invoke("obtener-correo-usuario")
    },
    OBTENER_ID_MONGODB_USUARIO: () => {
        return ipcRenderer.invoke("obtener-id-mongodb-usuario")
    },
    OBTENER_IDAMIGO_USUARIO: () => {
        return ipcRenderer.invoke("obtener-idamigo-usuario")
    },
    // Cambio de datos de cuenta
    COMPROBAR_CONTRASEÑA: ({ contraseña }) => {
        return ipcRenderer.invoke("comprobar-contraseña-cuenta", contraseña)
    },
    PERMITIR_CAMBIO_DATOS_CUENTA: ({ data = null, tipo }) => {
        return ipcRenderer.invoke("permitir-cambio-datos-cuenta", data, tipo)
    },
    CAMBIAR_DATOS_CUENTA: (contraseña, code, tipo) => {
        return ipcRenderer.invoke("cambiar-datos-usuario", contraseña, code, tipo)
    },
    // Fechas de bloqueo de cambios (para mostrar en ajustes)
    OBTENER_FECHA_CREACION_CUENTA: () => {
        return ipcRenderer.invoke("obtener-fecha-creacion-cuenta")
    },
    OBTENER_FECHA_BLOQUEO_APODO: () => {
        return ipcRenderer.invoke("obtener-fecha-bloqueo-apodo")
    },
    OBTENER_FECHA_BLOQUEO_CORREO: () => {
        return ipcRenderer.invoke("obtener-fecha-bloqueo-correo")
    },
    OBTENER_FECHA_BLOQUEO_CONTRASEÑA: () => {
        return ipcRenderer.invoke("obtener-fecha-bloqueo-contraseña")
    }
});

// ─── SOCIAL ───────────────────────────────────────────────────────────────────
// Búsqueda de otros usuarios, contactos, bloqueados y silenciados
contextBridge.exposeInMainWorld('social_usuario', {
    ENCONTRAR_USUARIOS_EXTERNOS: (texto, correo = false) => {
        return ipcRenderer.invoke("encontrar-usuario-externo", texto, correo)
    },
    OBTENER_DATOS_USUARIO_EXTERNO: (id, datos = null) => {
        return ipcRenderer.invoke("obtener-datos-usuario-externo", id, datos)
    },
    OBTENER_CONTACTOS_USUARIO: () => {
        return ipcRenderer.invoke("obtener-contactos-usuario")
    },
    OBTENER_USUARIOS_BLOQUEADOS: () => {
        return ipcRenderer.invoke("obtener-usuarios-bloqueados")
    },
    OBTENER_USUARIOS_SILENCIADOS: () => {
        return ipcRenderer.invoke("obtener-usuarios-silenciados")
    },
    AÑADIR_USUARIO_BLOQUEADOS: (id, apodo) => {
        return ipcRenderer.invoke("añadir-usuarios-bloqueados", id, apodo)
    },
    ELIMINAR_USUARIO_BLOQUEADO: (id) => {
        return ipcRenderer.invoke("eliminar-usuarios-bloqueados", id)
    },
    AÑADIR_USUARIO_SILENCIADOS: (id, apodo) => {
        return ipcRenderer.invoke("añadir-usuarios-silenciados", id, apodo)
    },
    ELIMINAR_USUARIO_SILENCIADOS: (id) => {
        return ipcRenderer.invoke("eliminar-usuarios-silenciados", id)
    }
});

// ─── CHATS ────────────────────────────────────────────────────────────────────
// Todo lo relacionado con chats y mensajes
contextBridge.exposeInMainWorld('chats', {
    OBTENER_CHATS_USUARIO: () => {
        return ipcRenderer.invoke("obtener-chats-usuario")
    },
    OBTENER_DATOS_CHATS_GRUPALES: ({ data, grupales, mensajes }) => {
        return ipcRenderer.invoke("obtener-datos-chats-grupales-usuario", { data, grupales, mensajes })
    },
    OBTENER_DATOS_CHAT_UNICO: (id, datos_buscar = null) => {
        return ipcRenderer.invoke("obtener-datos-chat-unico-usuario", id, datos_buscar)
    },
    LIMPIAR_MENSAJES_CHATS_ANTIGUOS: (chatIds) => {
        ipcRenderer.send("limpiar-chats-antiguos-mensajes", chatIds)
    },
    CREAR_CHAT_NUEVO: (ids, nombre, id_chat = null) => {
        return ipcRenderer.invoke("crear-chat-nuevo", ids, nombre, id_chat)
    },
    ENVIAR_MENSAJE: ({ asunto, archivos, id_chat, id_emisor }) => {
        return ipcRenderer.invoke("enviar-mensaje", { asunto, archivos, id_chat, id_emisor })
    },
    SELECCIONAR_ARCHIVOS: () => {
        return ipcRenderer.invoke("seleccionar-archivos")
    },
    DESCARGAR_ARCHIVO: (id, nombre) => {
        return ipcRenderer.invoke("descargar-archivo", id, nombre)
    },
    OBTENER_DATOS_MENSAJE: (id_chat, id_mensaje) => {
        return ipcRenderer.invoke("obtener-datos-mensaje", id_chat, id_mensaje)
    },
    EXPULSAR_USUARIO_CHAT: (id_usuario, id_chat) => {
        return ipcRenderer.invoke("expulsar-usuario-chat", id_usuario, id_chat)
    },
    RESPONDER_SOLICITUD_AÑADIR: (id_chat, id_mensaje, aceptar) => {
        return ipcRenderer.invoke("responder-solicitud-añadir", id_chat, id_mensaje, aceptar)
    },
    HACER_ADMIN_CHAT: (id_chat, id_usuario) => {
        return ipcRenderer.invoke("hacer-admin-chat", id_chat, id_usuario)
    },
    QUITAR_ADMIN_CHAT: (id_chat, id_usuario) => {
        return ipcRenderer.invoke("quitar-admin-chat", id_chat, id_usuario)
    }


});

// ─── AJUSTES DE LA APP ───────────────────────────────────────────────────────
// Obtener y guardar ajustes de la app
contextBridge.exposeInMainWorld('ajustes_app', {
    OBTENER_AJUSTES_APP: (nombre) => {
        return ipcRenderer.invoke("obtener-ajustes-app", nombre)
    },
    GUARDAR_AJUSTES_APP: (data) => {
        return ipcRenderer.invoke("guardar-ajustes-app", data)
    }
});
//socket buzon
contextBridge.exposeInMainWorld("buzonAPI", {
    REVISAR_BUZON: () => {//iniciar el buzon(el socket ya esta hecho de antemano con el server)
        return ipcRenderer.invoke("revisar-buzon");
    },
    INICIAR_BUZON: () => {//iniciar el buzon(el socket ya esta hecho de antemano con el server)
        ipcRenderer.send("iniciar-buzon");
    },
    onNuevaNotificacion: (callback) => {//esto es para enviar los cambios del socket(backend) al renderer(frontend)
        ipcRenderer.on("nueva-notificacion", (event, data) => callback(data));
    }
});