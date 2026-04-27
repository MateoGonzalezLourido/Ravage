// === Arranque ===
// Cachea bytecode V8 para arranques posteriores más rápidos
app.commandLine.appendSwitch('v8-cache-options', 'code');
app.commandLine.appendSwitch('no-first-run');

// === GPU / Renderizado ===
// Rasterización por GPU para scroll y animaciones más fluidos
app.commandLine.appendSwitch('enable-gpu-rasterization');
// Evita copias de memoria extra al subir texturas a la GPU
app.commandLine.appendSwitch('enable-zero-copy');

// === Memoria ===
// Limita el heap V8 a 512MB (por defecto puede crecer sin límite)
const HEAP_LIMIT_MB = 512;
app.commandLine.appendSwitch('js-flags', `--max-old-space-size=${HEAP_LIMIT_MB} --expose-gc`);

// === Batería / Background ===
// Reduce prioridad del renderer cuando la ventana está en segundo plano
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// === Red ===
// Precarga DNS para previsualizaciones de URL más rápidas
app.commandLine.appendSwitch('enable-async-dns');
// Desactiva networking en background
app.commandLine.appendSwitch('disable-background-networking');

// === Features — todo agrupado para evitar conflictos ===
app.commandLine.appendSwitch('enable-features', 'IntensiveWakeUpThrottling,VaapiVideoDecoder');
app.commandLine.appendSwitch('disable-features', 'TranslateUI,AutofillServerCommunication,Translate,MediaRouter,DialMediaRouteProvider,OptimizationHints');

// === Chromium innecesario ===
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('metrics-recording-only');
app.commandLine.appendSwitch('no-pings');

import { app, ipcMain, path } from './backend/utils/libs.js';
import { fileURLToPath } from 'url';

if (process.env.MODO_DEBUG === "true") {
    const HEAP_WARN_THRESHOLD = HEAP_LIMIT_MB * 0.8; // alerta al 80%

    setInterval(() => {
        const usage = process.memoryUsage();
        const rss = Math.round(usage.rss / 1024 / 1024);
        const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);
        const heapTotal = Math.round(usage.heapTotal / 1024 / 1024);

        console.log(`[Memory Monitor] RSS: ${rss}MB | Heap: ${heapUsed}/${heapTotal}MB`);

        if (heapUsed > HEAP_WARN_THRESHOLD) {
            console.warn(`[Memory Monitor] ALERTA: Heap al ${Math.round(heapUsed / HEAP_LIMIT_MB * 100)}% (${heapUsed}MB/${HEAP_LIMIT_MB}MB)`);
            if (global.gc) global.gc();
        }
    }, 5000);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let socket;
let mainWindow;
let ipcHandlersRegistered = false;

async function registerAllHandlers(window, sock) {
    if (ipcHandlersRegistered) return;
    ipcHandlersRegistered = true;

    const [
        { registerSessionHandlers },
        { registerValidadoresHandlers },
        { registerChatHandlers },
        { registerSocialHandlers },
        { registerCacheArchivosDescargadosHandlers },
        { registerCachePersistentHandlers },
        { registerEscaneresAppHandlers },
        { getAjustesAppFile, saveAjustesAppFile }
    ] = await Promise.all([
        import('./backend/ipc/session_ipc.js'),
        import('./backend/ipc/validadores_ipc.js'),
        import('./backend/ipc/chat_ipc.js'),
        import('./backend/ipc/social_ipc.js'),
        import('./backend/ipc/cache_archivos_descargados_ipc.js'),
        import('./backend/ipc/cache_persistent_ipc.js'),
        import('./backend/ipc/escaneres_app_ipc.js'),
        import('./backend/services/controladorArchivos.js')
    ]);

    registerSessionHandlers(window);
    registerValidadoresHandlers();
    registerChatHandlers(window, sock);
    registerSocialHandlers();
    registerCacheArchivosDescargadosHandlers();
    registerCachePersistentHandlers();
    registerEscaneresAppHandlers();

    ipcMain.handle("obtener-ajustes-app", async (_, nombre) => {
        return await getAjustesAppFile(nombre);
    });
    ipcMain.handle("guardar-ajustes-app", async (_, data) => {
        return await saveAjustesAppFile({ data, create: false });
    });
}

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
            additionalArguments: [
                `--js-flags=--max-old-space-size=${HEAP_LIMIT_MB}` // Aplicar también al renderizador el limite de memoria
            ],
            spellcheck: false,
            v8CacheOptions: 'bypassHeatCheck',
            backgroundThrottling: true
        }
    });
    const pageToLoad = AutoLogin
        ? path.join(__dirname, 'frontend', 'home', 'home.html')
        : path.join(__dirname, 'frontend', 'sesion-log', 'sesion.html');

    mainWindow.loadFile(pageToLoad);

    mainWindow.maximize();
    mainWindow.show();

    // Registrar handlers una sola vez
    await registerAllHandlers(mainWindow, socket);
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
        await createMainWindowHome(AutoLogin?.success || false);
        setMainWindow(mainWindow);
    });
}

app.on('before-quit', async (event) => {
    event.preventDefault();
    try {
        const [dbRes, buzonRes, poolRes] = await Promise.allSettled([
            import("./backend/db/mongo.js"),
            import('./backend/services/buzonAPI.js'),
            import('./backend/utils/workers/workerPool.js')
        ]);

        // Terminar worker pool primero (operaciones en vuelo)
        if (poolRes.status === 'fulfilled') {
            await poolRes.value.terminarCryptoPool();
        }
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

// Reducir frame rate cuando no está en foco
app.on('browser-window-blur', () => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.setFrameRate(10); // 10fps en segundo plano
    }
});
app.on('browser-window-focus', () => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.setFrameRate(60);
    }
});
//detectores para crash
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (mainWindow) {
        mainWindow.webContents.openDevTools(); // mostrar DevTools
        console.error('HTML del error:', mainWindow.webContents.getHTML());
    }
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    if (mainWindow) {
        mainWindow.webContents.openDevTools();
    }
});
