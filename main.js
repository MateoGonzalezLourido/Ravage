import { app, BrowserWindow, ipcMain, path } from './backend/utils/libs.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// carga variables de entorno
import 'dotenv/config';

import { startServer } from './backend/servidores/serverLocalHost.js';
import { connectDB, closeDB } from "./backend/db/mongo.js";
import { autoLoginUsuario } from './backend/services/sesionUsuario.js';

// Import modular IPC handlers
import { registerSessionHandlers } from './backend/ipc/session_ipc.js';
import { registerChatHandlers } from './backend/ipc/chat_ipc.js';
import { registerSocialHandlers } from './backend/ipc/social_ipc.js';

let socket;
let mainWindow;

function createMainWindowHome(AutoLogin = false) {
    mainWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        minHeight: 400,
        minWidth: 450,
        title: "RAVAGE",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            additionalArguments: [`--start=${AutoLogin}`]
        },
    });

    mainWindow.maximize();
    mainWindow.show();
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'sesion-log', 'sesion.html'));
    
    // Register IPC handlers
    registerSessionHandlers(mainWindow);
    registerChatHandlers(mainWindow, socket);
    registerSocialHandlers();
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        socket = await startServer();
        await connectDB();
        const AutoLogin = await autoLoginUsuario();
        createMainWindowHome(AutoLogin.success);
    });
}

app.on('before-quit', async (e) => {
    try {
        await closeDB();
    } catch (err) {
        console.error(err);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Navigation handlers (kept here as they directly affect main window)
ipcMain.on("cambiar-pagina-soporte", () => {
    mainWindow.setTitle("RAVAGE-Soporte");
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'soporte', 'soporte.html'));
});

ipcMain.on("cambiar-pagina-home", () => {
    mainWindow.setTitle("RAVAGE-Home");
    mainWindow.loadFile(path.join(__dirname, 'frontend','home', 'home.html'));
});
