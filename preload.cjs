/*
  Puente entre frontend y backend (contextBridge).
  Expone únicamente lo necesario al renderer, sin exponer el backend directamente.
  Cada grupo de funciones representa un dominio lógico de la aplicación.
  OBLIGATORIAMENTE DEBE SER UN CJS (CommonJS)
*/

const { contextBridge } = require('electron');

// Importar módulos de la carpeta preload
const auth = require('./preload/auth.cjs');
const navigation = require('./preload/navigation.cjs');
const user = require('./preload/user.cjs');
const social = require('./preload/social.cjs');
const chat = require('./preload/chat.cjs');
const storage = require('./preload/storage.cjs');
const app_settings = require('./preload/app_settings.cjs');
const validators = require('./preload/validators.cjs');
const mailbox = require('./preload/mailbox.cjs');
const security = require('./preload/security.cjs');
const utils = require('./preload/utils.cjs');
const avisosUI=require('./preload/avisos.cjs');
// Argumentos de inicio para determinar el estado inicial en el bloque boot
const startArg = process.argv.find(a => a.startsWith('--start='));
const startPage = startArg?.split('=')[1] ?? 'true';

// ─── EXPOSICIÓN DE APIS AL MAIN WORLD ─────────────────────────────────────────

// Estado inicial de la app
contextBridge.exposeInMainWorld('boot', {
    isLogged: startPage === 'true'
});

// Sesión y autenticación
contextBridge.exposeInMainWorld('sesion_usuario', auth);

// Navegación entre páginas
contextBridge.exposeInMainWorld('paginas_app', navigation);

// Datos de la cuenta del usuario
contextBridge.exposeInMainWorld('cuenta_usuario', user);

// Relaciones sociales y búsqueda
contextBridge.exposeInMainWorld('social_usuario', social);

// Mensajería y gestión de chats
contextBridge.exposeInMainWorld('chats', chat);

// Ajustes globales de la aplicación
contextBridge.exposeInMainWorld('ajustes_app', app_settings);

// Validadores de datos
contextBridge.exposeInMainWorld('validadores', validators);

// Notificaciones y buzón (Socket)
contextBridge.exposeInMainWorld('buzonAPI', mailbox);

// Bloques de Caché (definidos en storage.js)
contextBridge.exposeInMainWorld('cache_url_img_extensiones', storage.cache_url_img_extensiones);
contextBridge.exposeInMainWorld('cache_persistente', storage.cache_persistente);
contextBridge.exposeInMainWorld('cache_archivos_descargados', storage.cache_archivos_descargados);

// Seguridad y escaneo de contenido
contextBridge.exposeInMainWorld('escaneres_seguridad_app', security);

// Utilidades generales
contextBridge.exposeInMainWorld('utilidades_app', utils);

//avisos en UI
contextBridge.exposeInMainWorld('avisos_ui', avisosUI);