import {app,path} from '../utils/libs.js'
export const AJUSTES_APP_DEFAULT = {
    MSBienvenida: true,
    URL_DESCARGA: app ? app.getPath("downloads") : path.join(process.cwd(), 'downloads'),
    LIMITE_CACHE_IMG_EXTENSIONES: 50
};