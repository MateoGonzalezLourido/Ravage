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

import { app, ipcMain, path, dialog, fs } from './backend/utils/libs.js';
import { fileURLToPath } from 'url';
const fs_promises = fs.promises;

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
let isQuitting = false;

// ── Tray singleton ─────────────────────────────────────────────────────────
// En Linux, Tray.destroy() dentro de su propio callback causa un error GTK
// nativo que no es interceptable desde JS. La solución es mantener el Tray
// vivo durante toda la sesión y alternar entre el icono real y una imagen
// vacía para simular mostrar/ocultar sin jamás destruir el widget GTK.
let _tray = null;
let _trayVisible = false;
let _trayIconPath = null;
let _TrayClass = null;
let _MenuClass = null;

async function _initTrayClasses() {
    if (_TrayClass) return;
    const mod = await import('./backend/utils/libs.js');
    _TrayClass      = mod.Tray;
    _MenuClass      = mod.Menu;
    _trayIconPath   = path.join(__dirname, 'frontend/recursos/RavageIcono.png');
}

async function showTray() {
    await _initTrayClasses();

    // Crear siempre una instancia nueva (la anterior fue destruida)
    _tray = new _TrayClass(_trayIconPath);
    _tray.setContextMenu(_MenuClass.buildFromTemplate([
        { label: 'Abrir Ravage', click: () => mostrarVentana() },
        { label: 'Salir',        click: () => { isQuitting = true; app.quit(); } }
    ]));
    _tray.setToolTip('Ravage (Segundo plano)');
    _tray.on('click', () => mostrarVentana());

    _trayVisible = true;
}

function hideTray() {
    if (!_tray || !_trayVisible) return;
    const t = _tray;
    _tray = null;
    _trayVisible = false;

    // Esperar 300ms para que GTK termine de procesar el evento de click
    // antes de destruir el widget — evita el assertion GTK nativo en Linux
    setTimeout(() => {
        try { t.destroy(); } catch { /* warning GTK ignorado */ }
    }, 300);
}


function mostrarVentana() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
    }
    // hideTray() se llama también desde el evento 'show' de la ventana
}


async function limpiarRecursosSegundoPlano() {
    console.log('[Cleanup] Liberando recursos para liberar RAM...');
    try {
        const [poolRes, cacheChatRes, cacheArchivosRes] = await Promise.allSettled([
            import('./backend/utils/workers/workerPool.js'),
            import('./backend/STORAGE/CACHE/_cache_chat_activo.js'),
            import('./backend/STORAGE/CACHE/_cache_archivos_descargados.js')
        ]);

        if (poolRes.status === 'fulfilled') {
            await poolRes.value.terminarCryptoPool();
            await poolRes.value.terminarEscanerPool();
        }
        if (cacheChatRes.status === 'fulfilled') {
            cacheChatRes.value.borrarCacheChatActivo();
        }
        if (cacheArchivosRes.status === 'fulfilled') {
            await cacheArchivosRes.value.clearCacheArchivosDescargados();
        }

        // Notificar al Frontend para limpiar sus caches de RAM
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('limpiar-ram-frontend');
        }

        if (global.gc) {
            global.gc();
            console.log('[Cleanup] Garbage Collector ejecutado.');
        }
    } catch (err) {
        console.error('[Cleanup] Error durante la limpieza:', err);
    }
}


async function registerAllHandlers(window, sock) {
    if (ipcHandlersRegistered) return;
    ipcHandlersRegistered = true;

    // Escribe al log en userData para poder verlo sin terminal
    const _logFile = path.join(app.getPath('userData'), 'ipc-debug.log');
    const _log = (msg) => {
        const line = `[${new Date().toISOString()}] ${msg}\n`;
        console.error(line.trimEnd());
        try { fs.appendFileSync(_logFile, line); } catch { /* */ }
    };
    _log(`=== registerAllHandlers inicio | resourcesPath=${process.resourcesPath} | __dirname_libs incluye asar: ${_log._asarCheck ?? 'n/a'}`);

    const [
        sessionRes,
        validadoresRes,
        chatRes,
        socialRes,
        cacheArchivosRes,
        cachePersistentRes,
        escaneresRes,
        controladorRes
    ] = await Promise.allSettled([
        import('./backend/ipc/session_ipc.js'),
        import('./backend/ipc/validadores_ipc.js'),
        import('./backend/ipc/chat_ipc.js'),
        import('./backend/ipc/social_ipc.js'),
        import('./backend/ipc/cache_archivos_descargados_ipc.js'),
        import('./backend/ipc/cache_persistent_ipc.js'),
        import('./backend/ipc/escaneres_app_ipc.js'),
        import('./backend/services/controladorArchivos.js')
    ]);

    if (sessionRes.status === 'fulfilled') {
        try { sessionRes.value.registerSessionHandlers(window); }
        catch (e) { _log(`[IPC] Error en registerSessionHandlers: ${e.stack || e.message}`); }
    } else _log(`[IPC] Fallo session_ipc: ${sessionRes.reason?.stack || sessionRes.reason}`);

    if (validadoresRes.status === 'fulfilled') {
        try { validadoresRes.value.registerValidadoresHandlers(); }
        catch (e) { _log(`[IPC] Error en registerValidadoresHandlers: ${e.stack || e.message}`); }
    } else _log(`[IPC] Fallo validadores_ipc: ${validadoresRes.reason?.stack || validadoresRes.reason}`);

    if (chatRes.status === 'fulfilled') {
        try { chatRes.value.registerChatHandlers(window, sock); }
        catch (e) { _log(`[IPC] Error en registerChatHandlers: ${e.stack || e.message}`); }
    } else _log(`[IPC] Fallo chat_ipc: ${chatRes.reason?.stack || chatRes.reason}`);

    if (socialRes.status === 'fulfilled') {
        try { socialRes.value.registerSocialHandlers(); }
        catch (e) { _log(`[IPC] Error en registerSocialHandlers: ${e.stack || e.message}`); }
    } else _log(`[IPC] Fallo social_ipc: ${socialRes.reason?.stack || socialRes.reason}`);

    if (cacheArchivosRes.status === 'fulfilled') {
        try { cacheArchivosRes.value.registerCacheArchivosDescargadosHandlers(); }
        catch (e) { _log(`[IPC] Error en registerCacheArchivosDescargadosHandlers: ${e.stack || e.message}`); }
    } else _log(`[IPC] Fallo cache_archivos_descargados_ipc (SQLite): ${cacheArchivosRes.reason?.stack || cacheArchivosRes.reason?.message}`);

    if (cachePersistentRes.status === 'fulfilled') {
        try { cachePersistentRes.value.registerCachePersistentHandlers(); }
        catch (e) { _log(`[IPC] Error en registerCachePersistentHandlers: ${e.stack || e.message}`); }
    } else _log(`[IPC] Fallo cache_persistent_ipc (SQLite): ${cachePersistentRes.reason?.stack || cachePersistentRes.reason?.message}`);

    if (escaneresRes.status === 'fulfilled') {
        try { escaneresRes.value.registerEscaneresAppHandlers(); }
        catch (e) { _log(`[IPC] Error en registerEscaneresAppHandlers: ${e.stack || e.message}`); }
    } else _log(`[IPC] Fallo escaneres_app_ipc: ${escaneresRes.reason?.stack || escaneresRes.reason}`);

    if (controladorRes.status === 'fulfilled') {
        const {
            getAjustesAppFile, saveAjustesAppFile,
            exportarClavePrivadaADescargas, exportarClavePorId,
            importarClavePrivada, cambiarClavePrincipal,
            listarClavesIdentidad, eliminarClaveSoporte
        } = controladorRes.value;
        ipcMain.handle("obtener-ajustes-app", async (_, nombre) => {
            return await getAjustesAppFile(nombre);
        });
        ipcMain.handle("guardar-ajustes-app", async (_, data) => {
            return await saveAjustesAppFile({ data, create: false });
        });
        ipcMain.handle("exportar-clave-privada", async () => {
            return await exportarClavePrivadaADescargas();
        });
        ipcMain.handle("identity-importar-clave", async (_, { pemContent, label }) => {
            return await importarClavePrivada(pemContent, label || '');
        });
        ipcMain.handle("identity-importar-clave-archivo", async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                title: 'Seleccionar clave privada',
                filters: [{ name: 'PEM Key', extensions: ['pem', 'key', 'txt'] }],
                properties: ['openFile']
            });
            if (canceled || !filePaths[0]) return { ok: false, error: 'Cancelado' };
            const pemContent = await fs_promises.readFile(filePaths[0], 'utf-8');
            return await importarClavePrivada(pemContent.trim(), '');
        });
        ipcMain.handle("identity-listar-claves", async () => {
            return await listarClavesIdentidad();
        });
        ipcMain.handle("identity-cambiar-principal", async (_, keyId) => {
            return await cambiarClavePrincipal(keyId);
        });
        ipcMain.handle("identity-eliminar-soporte", async (_, keyId) => {
            return await eliminarClaveSoporte(keyId);
        });
        ipcMain.handle("identity-exportar-clave", async (_, keyId) => {
            return await exportarClavePorId(keyId);
        });
    } else {
        console.error('[IPC] Fallo controladorArchivos:', controladorRes.reason);
    }

    // Verificación de contraseña para gestión de claves
    ipcMain.handle("verificar-contraseña-actual", async (_, contraseña) => {
        const { verificarContrasenaActual } = await import('./backend/services/sesionUsuario.js');
        return await verificarContrasenaActual(contraseña);
    });

    ipcMain.handle("obtener-email-soporte", () => {
        return process.env.BREVO_SENDER_EMAIL || null;
    });

    ipcMain.handle("obtener-num-cpus", async () => {
        const { os } = await import('./backend/utils/libs.js');
        return os.cpus().length;
    });

    ipcMain.handle("ajustes:set-num-workers", async (_, n) => {
        const { aplicarNuevoNumWorkers } = await import('./backend/utils/workers/workerPool.js');
        await aplicarNuevoNumWorkers(n);
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
            backgroundThrottling: false
        }
    });
    const pageToLoad = AutoLogin
        ? path.join(__dirname, 'frontend', 'home', 'home.html')
        : path.join(__dirname, 'frontend', 'sesion-log', 'sesion.html');

    // Registrar handlers antes de cargar el contenido para evitar race conditions
    await registerAllHandlers(mainWindow, socket);

    mainWindow.loadFile(pageToLoad);

    mainWindow.maximize();
    mainWindow.show();

    mainWindow.on('close', async (event) => {
        if (!isQuitting) {
            event.preventDefault();
            const { getAjustesAppFile } = await import('./backend/services/controladorArchivos.js');
            const ajustes = await getAjustesAppFile();
            if (ajustes.DESACTIVAR_SEGUNDO_PLANO) {
                isQuitting = true;
                app.quit();
            } else {
                mainWindow.hide();
                showTray(); // fire-and-forget (async)
                await limpiarRecursosSegundoPlano();
            }
        }
    });

    // Ocultar el tray automáticamente en cuanto la ventana se muestra
    // (cubre todos los orígenes: click en tray, notificación OS, second-instance...)
    mainWindow.on('show', () => hideTray());
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) mostrarVentana();
    });

    app.whenReady().then(async () => {
        // Migrar .env al baúl seguro del SO (si los hay) y cargar vars desde él
        const { inicializarVault } = await import('./backend/utils/env_vault.js');
        await inicializarVault();

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

        // Aplicar preferencia de workers guardada por el usuario
        try {
            const { getAjustesAppFile } = await import('./backend/services/controladorArchivos.js');
            const { setNumWorkersOverride } = await import('./backend/utils/workers/workerPool.js');
            const ajustes = await getAjustesAppFile();
            if (ajustes?.NUM_WORKERS > 0) setNumWorkersOverride(ajustes.NUM_WORKERS);
        } catch (_) {}
    });
}

app.on('before-quit', async (event) => {
    isQuitting = true;
    event.preventDefault();
    try {
        const [dbRes, buzonRes, poolRes] = await Promise.allSettled([
            import("./backend/db/mongo.js"),
            import('./backend/services/buzonAPI.js'),
            import('./backend/utils/workers/workerPool.js')
        ]);

        // Terminar worker pool primero (operaciones en vuelo)
        await limpiarRecursosSegundoPlano();

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
