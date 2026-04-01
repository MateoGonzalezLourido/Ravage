
// Activa la caché de compilación de V8 para que Electron no tenga que
// recompilar el JS cada vez que arrancas (hace que el 2do arranque sea más rápido)
app.commandLine.appendSwitch('v8-cache-options', 'code');

import { app, ipcMain, path } from './backend/utils/libs.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let socket;
let mainWindow;


async function createMainWindowHome(AutoLogin = false) {
    const { BrowserWindow } = await import('./backend/utils/libs.js');

    mainWindow = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        minHeight: 400,
        minWidth: 450,
        title: "RAVAGE",
        backgroundColor: "#1e1e1e",
        autoHideMenuBar: true,
        paintWhenInitiallyHidden: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            additionalArguments: [`--start=${AutoLogin}`],
            spellcheck: false
        },
    });
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'sesion-log', 'sesion.html'));

    mainWindow.maximize();
    mainWindow.show();
    
    const [{ registerSessionHandlers }, { registerValidadoresHandlers }] = await Promise.all([
        import('./backend/ipc/session_ipc.js'),
        import('./backend/ipc/validadores_ipc.js')
    ]);

    registerSessionHandlers(mainWindow);
    registerValidadoresHandlers();


    mainWindow.once('ready-to-show', async () => {


        const [
            { registerChatHandlers },
            { registerSocialHandlers },
            { registerCacheImgExtensionesHandlers },
            { registerCacheArchivosDescargadosHandlers },
            { registerCachePersistentHandlers }
        ] = await Promise.all([
            import('./backend/ipc/chat_ipc.js'),
            import('./backend/ipc/social_ipc.js'),
            import('./backend/ipc/cache_img_extension_ipc.js'),
            import('./backend/ipc/cache_archivos_descargados_ipc.js'),
            import('./backend/ipc/cache_persistent_ipc.js')
        ]);

        registerChatHandlers(mainWindow, socket);
        registerSocialHandlers();
        registerCacheImgExtensionesHandlers();
        registerCacheArchivosDescargadosHandlers();
        registerCachePersistentHandlers();

    });
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
        const pServer = import('./backend/servidores/serverLocalHost.js');
        const pDb = import("./backend/db/mongo.js");
        const pSesion = import('./backend/services/sesionUsuario.js');
        const pStorage = import('./backend/STORAGE/Variables_sesion.js');

        const [{ startServer }, { connectDB }] = await Promise.all([pServer, pDb]);

        socket = await startServer();
        await connectDB();

        const [{ autoLoginUsuario }, { setMainWindow }] = await Promise.all([pSesion, pStorage]);

        const AutoLogin = await autoLoginUsuario();
        createMainWindowHome(AutoLogin?.success || false);
        setMainWindow(mainWindow);
    });
}

app.on('before-quit', async () => {
    try {
        const [dbRes, buzonRes] = await Promise.allSettled([
            import("./backend/db/mongo.js"),
            import('./backend/services/buzon.js')
        ]);

        if (buzonRes.status === 'fulfilled') {
            await buzonRes.value.detenerBuzon();
        }
        if (dbRes.status === 'fulfilled') {
            await dbRes.value.closeDB();
        }
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
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'home', 'home.html'));
});
