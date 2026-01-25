const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const { startServer } = require('./backend/server.js')
const { AUTO_LOGIN_USUARIO } = require('./backend/services/users');
const { connectDB, BorrarUsuarioActivo } = require("./backend/db/mongo.js")
const { registerUsuario, loginUsuario, ValidarCodeRegistroUsuario, ValidarCodeLogin } = require('./backend/services/users.js');
const state = require('./backend/STORAGE/Variables_sesion.js')

function createWindow(AutoLogin = false) {
    const winMain = new BrowserWindow({
        show: false, // evita parpadeo
        width: 800,
        height: 600,
        minHeight: 400,
        minWidth: 400,
        title: "RAVAGE",   // cambia el nombre de la ventana
        autoHideMenuBar: true, // oculta menú opciones nativo
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // ruta absoluta
            nodeIntegration: false,
            additionalArguments: [`--start=${AutoLogin}`] // argumentos iniciales para el preload
        },
    })

    winMain.maximize();      // maximiza la ventana
    winMain.show();          // muestra la ventana
    winMain.loadFile(path.join(__dirname, 'frontend', 'home.html')) // carga frontend: (<ruta absoluta>/renderer/home.html)
}

// Ejecuta cuando Electron está listo
app.whenReady().then(async () => {
    await startServer() // iniciar servidor express
    await connectDB()
    const AutoLogin = await AUTO_LOGIN_USUARIO();//true, false
    await createWindow(AutoLogin); // crear ventana
})

/* Finalizar App cuando todas las ventanas estén cerradas */
app.on('window-all-closed', async () => {
    const id = state.getIdSesion()
    await BorrarUsuarioActivo(id)
    if (process.platform !== 'darwin') app.quit()
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
    return await BorrarValidationCodes(correo);
});