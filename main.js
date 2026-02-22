const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const { startServer } = require('./backend/server.js')
const { connectDB, BorrarUsuarioActivo, closeDB, BorrarCuentaVC, BorrarVC, eliminarUsuariosBloqueados, eliminarUsuariosSilenciados, añadirUsuariosBloqueados, añadirUsuariosSilenciados, obtener_datos_chats, limpiar_mensajes_chats_antiguos, obtener_datos_chat_unico, obtener_datos_usuario, encontrar_usuario } = require("./backend/db/mongo.js")
const { autoLoginUsuario, registerUsuario, loginUsuario, ValidarCodeRegistroUsuario, ValidarCodeLogin, cerrarSesionUsuario, comprobar_contraseña_cuenta } = require('./backend/services/sesionUsuario.js');
const { getCorreoSesion, getApodoSesion, getFechaCreacionCuenta, getFechaBloqueoApodo, getFechaBloqueoCorreo, getFechaBloqueoContraseña, getUsuariosSilence, getUsuariosBloqueados, getListaChats, getIDMongodbUsuario } = require('./backend/STORAGE/Variables_sesion.js')
const { permitirCambioContraseñaUsuario, ValidarCodeCambioDatosCuenta, permitirCambioCorreoUsuario, permitirCambioApodoUsuario } = require('./backend/services/Usuario.js')
let winMain;//variable que almacena la ventana
function createMainWindowHome(AutoLogin = false) {
    winMain = new BrowserWindow({
        show: false, // evita parpadeo
        width: 800,
        height: 600,
        minHeight: 400,
        minWidth: 450,
        title: "RAVAGE",   // cambia el nombre de la ventana
        autoHideMenuBar: true, // oculta menú opciones nativo
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // ruta absoluta
            nodeIntegration: false,//evita que el render tenga acceso a require ...
            additionalArguments: [`--start=${AutoLogin}`] // argumentos iniciales para el preload
        },
    })

    winMain.maximize();      // maximiza la ventana
    winMain.show();          // muestra la ventana
    winMain.loadFile(path.join(__dirname, 'frontend', 'sesion-log', 'sesion.html')) // carga frontend: (<ruta absoluta>/renderer/home.html)
}
//evitar mas de una ventana/instancia
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
}
else {
    app.on('second-instance', () => {
        if (winMain) {
            if (winMain.isMinimized()) winMain.restore();
            winMain.focus();
        }
    });
    // Ejecuta cuando Electron está listo
    app.whenReady().then(async () => {
        await startServer() // iniciar servidor express
        await connectDB()
        const AutoLogin = await autoLoginUsuario();//true, false
        createMainWindowHome(AutoLogin.success); // crear ventana
    })
}


/* Finalizar App cuando todas las ventanas estén cerradas */
app.on('before-quit', async (e) => {//se ejecuta antes de cerrar (cubre cualquier cierre)
    try {
        await BorrarUsuarioActivo();
        await closeDB()
    } catch (err) {
        console.error(err);
    }
})
app.on('window-all-closed', async () => {//solo cubre el cierre por ventana
    if (process.platform !== 'darwin') app.quit()
})

//cambiar pagina
ipcMain.on("cambiar-pagina-soporte", () => {
    winMain.setTitle("RAVAGE-Soporte")//cambiar titulo ventana
    winMain.loadFile(path.join(__dirname, 'frontend', 'soporte', 'soporte.html')) // cargar nuevo frontend
})
ipcMain.on("cambiar-pagina-home", () => {
    winMain.setTitle("RAVAGE-Home")//cambiar titulo ventana
    winMain.loadFile(path.join(__dirname, 'frontend', 'home.html'))// cargar nuevo frontend
})
ipcMain.on("cambiar-pagina-log", () => {
    app.relaunch();   // prepara relanzamiento
    app.exit(0);
})
/*FUNCIONES DEL PRELOAD */
ipcMain.handle('login-usuario', async (_, username, password, mantener_sesion_iniciada) => {
    return await loginUsuario({ username: username, contraseña: password, mantener_sesion_iniciada: mantener_sesion_iniciada });
});

ipcMain.handle('registrar-usuario', async (_, apodo, username, password) => {
    return await registerUsuario({ apodo: apodo, correo: username, password: password });
    //(no se hizo el registro aun, queda verificar el correo) 
});
ipcMain.handle('validar-code-registrar-usuario', async (_, correo, code) => {
    return await ValidarCodeRegistroUsuario({ correo: correo, code: code });
});
ipcMain.handle('validar-code-login-usuario', async (_, correo, password) => {
    return await ValidarCodeLogin({ correo: correo, code: password });
});
ipcMain.handle('borrar-code-registrar-usuario', async (_, correo) => {
    return await BorrarVC(correo);
});
ipcMain.handle('borrar-code-login-usuario', async (_, correo) => {
    return await BorrarCuentaVC(correo);
});
ipcMain.handle('cerrar-sesion-usuario', async () => {
    const correo = getCorreoSesion()
    await cerrarSesionUsuario(correo);
    app.relaunch();   // prepara relanzamiento
    app.exit(0);
});
ipcMain.handle("permitir-cambio-datos-cuenta", async (_, data, tipo) => {
    if (tipo === "contraseña") {
        return await permitirCambioContraseñaUsuario(data)
    }
    if (tipo === "correo") {
        return await permitirCambioCorreoUsuario(data)
    }
    if (tipo === "apodo") {
        return await permitirCambioApodoUsuario(data)
    }
})
ipcMain.handle("cambiar-datos-usuario", async (_, data, code, tipo) => {
    return await ValidarCodeCambioDatosCuenta({ data: data, code: code, tipo: tipo })
})
ipcMain.handle("obtener-apodo-sesion", () => {
    return getApodoSesion()
})
ipcMain.handle("obtener-fecha-creacion-cuenta", () => {
    return getFechaCreacionCuenta()
})
ipcMain.handle("obtener-fecha-bloqueo-apodo", () => {
    return getFechaBloqueoApodo()
})

ipcMain.handle("obtener-fecha-bloqueo-correo", () => {
    return getFechaBloqueoCorreo()
})

ipcMain.handle("obtener-fecha-bloqueo-contraseña", () => {
    return getFechaBloqueoContraseña()
})
ipcMain.handle("comprobar-contraseña-cuenta", async (_, contraseña) => {
    return await comprobar_contraseña_cuenta(contraseña)
})

ipcMain.handle("obtener-usuarios-silenciados", () => {
    return getUsuariosSilence()
})
ipcMain.handle("obtener-usuarios-bloqueados", () => {
    return getUsuariosBloqueados()
})
ipcMain.handle("eliminar-usuarios-bloqueados", async (_, id) => {
    return await eliminarUsuariosBloqueados(id)
})
ipcMain.handle("eliminar-usuarios-silenciados", async (_, id) => {
    return await eliminarUsuariosSilenciados(id)
})
ipcMain.handle("añadir-usuarios-bloqueados", async (_, id, apodo) => {
    return await añadirUsuariosBloqueados(id, apodo)
})
ipcMain.handle("añadir-usuarios-silenciados", async (_, id, apodo) => {
    return await añadirUsuariosSilenciados(id, apodo)
})
ipcMain.handle("obtener-chats-usuario", async () => {
    return await getListaChats()
})

ipcMain.handle("obtener-datos-chats-grupales-usuario", async (_, { data, grupales, mensajes }) => {
    return await obtener_datos_chats({ data, grupales, mensajes })
})
ipcMain.handle("obtener-datos-chat-unico", async (_, id) => {
    return await obtener_datos_chat_unico(id)
})
ipcMain.on("limpiar-chats-antiguos-mensajes", async (_, chatIds) => {
    await limpiar_mensajes_chats_antiguos(chatIds)
})
ipcMain.handle("obtener-id-mongodb-usuario", async () => {
    return await getIDMongodbUsuario()
})
ipcMain.handle("obtener-datos-usuario-externo", async (_, id, datos) => {
    return await obtener_datos_usuario(_, id, datos)
})
ipcMain.handle("encontrar-usuario-externo", async (_, texto, correo = false) => {
    return await encontrar_usuario(_, texto, correo)
})