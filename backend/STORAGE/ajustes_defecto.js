import {app,path} from '../utils/libs.js'
export const AJUSTES_APP_DEFAULT = {
    MSBienvenida: true,
    URL_DESCARGA: app ? app.getPath("downloads") : path.join(process.cwd(), 'downloads'),
    LIMITE_CACHE_IMG_EXTENSIONES: 50,
    LIMITE_CACHE_ARCHIVOS_DESCARGADOS: 20,
    LIMITE_CHAT_CACHE_RAM: 1024,
    LIMITE_CHAT_CACHE_DISK: 2048,
    LIMITE_USER_CACHE_RAM: 1024,
    LIMITE_USER_CACHE_DISK: 2048,
    FORCE_DISK_CACHE: false
};