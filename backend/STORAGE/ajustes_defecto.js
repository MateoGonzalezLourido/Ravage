import {app,path} from '../utils/libs.js'
export const AJUSTES_APP_DEFAULT = {
    //mensaje de bienvenida que se ejecuta una vez
    MSBienvenida: true,
    //donde descargar los archivos
    URL_DESCARGA: app ? app.getPath("downloads") : path.join(process.cwd(), 'downloads'),
    //caches
    LIMITE_CACHE_IMG_EXTENSIONES: 50,
    LIMITE_CACHE_ARCHIVOS_DESCARGADOS: 20,
    LIMITE_CHAT_CACHE_RAM: 1024,
    LIMITE_CHAT_CACHE_DISK: 2048,
    LIMITE_USER_CACHE_RAM: 1024,
    LIMITE_USER_CACHE_DISK: 2048,
    FORCE_DISK_CACHE: false,
    //utilidades
    PREVISUALIZACION_URL: true,

    // Configuración por defecto de Escáneres de Seguridad
    ESCANER_ESTEGANOGRAFIA: true,
    ESCANER_URL: false,
    ESCANER_URL_MALICIOSA: true,
    ESCANER_XSS: false,
    ESCANER_CODIGO: false,
    ESCANER_ZALGO: true,
    ESCANER_COMANDOS_TERMINAL: true,
    ESCANER_CRYPTO_BILLETERAS: true,
    ESCANER_DIRECCIONES_IP: false,
    ESCANER_HOMOGLIFOS: true
};