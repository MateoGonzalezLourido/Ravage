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
    DESACTIVAR_SEGUNDO_PLANO: false,
    // Notificaciones del sistema operativo
    NOTI_OS_MENSAJE_INDIVIDUAL: true,
    NOTI_OS_MENSAJE_GRUPAL: true,
    NOTI_OS_DESCARGA_INDIVIDUAL: true,
    NOTI_OS_DESCARGA_GRUPAL: true,

    // Configuración por defecto de Escáneres de Seguridad(0:desactivado,1:aviso,3:aviso+formateo)
    ESCANER_ESTEGANOGRAFIA: 1,
    ESCANER_URL_MALICIOSA: 1,
    ESCANER_XSS: 0,
    ESCANER_CODIGO: 0,
    ESCANER_ZALGO: 1,
    ESCANER_COMANDOS_TERMINAL: 1,
    ESCANER_CRYPTO_BILLETERAS: 1,
    ESCANER_DIRECCIONES_IP: 0,
    ESCANER_HOMOGLIFOS: 1
};