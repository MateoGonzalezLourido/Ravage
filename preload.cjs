/*
  Puente entre frontend y backend (contextBridge).
  Expone únicamente lo necesario al renderer, sin exponer el backend directamente.
  Cada grupo de funciones representa un dominio lógico de la aplicación.
  OBLIGATORIAMENTE DEBE SER UN CJS (CommonJS)
*/

const { contextBridge } = require('./preload/libs.js');

// Importar módulos de la carpeta preload
const auth = require('./preload/auth.js');
const navigation = require('./preload/navigation.js');
const user = require('./preload/user.js');
const social = require('./preload/social.js');
const chat = require('./preload/chat.js');
const storage = require('./preload/storage.js');
const app_settings = require('./preload/app_settings.js');
const validators = require('./preload/validators.js');
const mailbox = require('./preload/mailbox.js');
const security = require('./preload/security.js');
const utils = require('./preload/utils.js');

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