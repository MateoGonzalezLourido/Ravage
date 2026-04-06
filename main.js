
// Activa la caché de compilación de V8 para que Electron no tenga que
// recompilar el JS cada vez que arrancas (hace que el 2do arranque sea más rápido)
app.commandLine.appendSwitch('v8-cache-options', 'code');

// Mejorar el rendimiento de animaciones y scroll
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// Reducir la memoria (Memory footprint)
// Desactiva el aislamiento estricto de sitios para reducir la cantidad de procesos de Chromium
// (Solo usar esto si NO cargas sitios web externos inseguros
app.commandLine.appendSwitch('disable-site-isolation-trials');

// Optimiza el uso de memoria de Chromium siendo más agresivo con la recolección
app.commandLine.appendSwitch('memory-pressure-off');

//Limitar y optimizar la memoria de V8 (Node.js)
// max-old-space-size: Limita la RAM máxima que puede usar Node.js (ej. 512MB). Evita que Chromium/Node traguen RAM infinita.
// expose-gc: Permite llamar a `global.gc()` manualmente en tu código si necesitas liberar memoria en momentos clave.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048 --expose-gc');

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
        icon: path.join(__dirname, 'frontend/recursos/RavageIcono.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.bundle.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            additionalArguments: [`--start=${AutoLogin}`],
            spellcheck: false,
            v8CacheOptions: 'bypassHeatCheck',
            backgroundThrottling: false
        }
    });
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'sesion-log', 'sesion.html'));

    mainWindow.maximize();
    mainWindow.show();

    const [
        { registerSessionHandlers },
        { registerValidadoresHandlers },
        { getAjustesAppFile, saveAjustesAppFile }
    ] = await Promise.all([
        import('./backend/ipc/session_ipc.js'),
        import('./backend/ipc/validadores_ipc.js'),
        import('./backend/services/controladorArchivos.js')
    ]);

    registerSessionHandlers(mainWindow);
    registerValidadoresHandlers();

    // Registrar ajustes ANTES de que cargue la página para evitar race condition con el renderer
    ipcMain.handle("obtener-ajustes-app", async (_, nombre) => {
        return await getAjustesAppFile(nombre)
    })
    ipcMain.handle("guardar-ajustes-app", async (_, data) => {
        return await saveAjustesAppFile({ data, create: false })
    })


    mainWindow.once('ready-to-show', async () => {


        const [
            { registerChatHandlers },
            { registerSocialHandlers },
            { registerCacheImgExtensionesHandlers },
            { registerCacheArchivosDescargadosHandlers },
            { registerCachePersistentHandlers },
            { registerEscaneresAppHandlers }
        ] = await Promise.all([
            import('./backend/ipc/chat_ipc.js'),
            import('./backend/ipc/social_ipc.js'),
            import('./backend/ipc/cache_img_extension_ipc.js'),
            import('./backend/ipc/cache_archivos_descargados_ipc.js'),
            import('./backend/ipc/cache_persistent_ipc.js'),
            import('./backend/ipc/escaneres_app_ipc.js')
        ]);

        registerChatHandlers(mainWindow, socket);
        registerSocialHandlers();
        registerCacheImgExtensionesHandlers();
        registerCacheArchivosDescargadosHandlers();
        registerCachePersistentHandlers();
        registerEscaneresAppHandlers();
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

app.on('before-quit', async (event) => {
    event.preventDefault();
    try {
        const [dbRes, buzonRes] = await Promise.allSettled([
            import("./backend/db/mongo.js"),
            import('./backend/services/buzonAPI.js')
        ]);

        if (buzonRes.status === 'fulfilled') {
            await buzonRes.value.detenerBuzon();
        }
        if (dbRes.status === 'fulfilled') {
            await dbRes.value.closeDB();
        }
    } catch (err) {
        console.error("Error durante el cierre:", err);
    } finally {
        app.exit(0);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on("cambiar-pagina-soporte", () => {
    mainWindow.setTitle("RAVAGE-Soporte");
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'soporte', 'soporte.html'));
});

ipcMain.on("cambiar-pagina-home", () => {
    mainWindow.setTitle("RAVAGE-Home");
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'home', 'home.html'));
});
