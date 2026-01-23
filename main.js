const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const { startServer } = require('./backend/server.js')
const { AUTO_LOGIN_USUARIO } = require('./backend/services/users');
const { connectDB } = require('../db/mongo.js')

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
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

/*FUNCIONES DEL PRELOAD */
const { registerUsuario, loginUsuario } = require('./backend/services/users');

ipcMain.handle('login-usuario', async (_, username, password) => {
    return await loginUsuario(username, password);
});

ipcMain.handle('registrar-usuario', async (_, username, password) => {
    return await registerUsuario(username, password);
});