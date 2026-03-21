import {getAjustesAppFile,saveAjustesAppFile} from '../../services/controladorArchivos.js'
let _cache_img_extensiones = null

export async function getCacheUrlImgExtensiones() {
    /*si esta vacio devolver siempre null */
    let cache_devolver=_cache_img_extensiones
    if (!_cache_img_extensiones || Object.keys(_cache_img_extensiones).length === 0) {
   
    cache_devolver=null
   }
        return cache_devolver
}
export async function setCacheUrlImgExtensiones(cache = "c") {
    // reset
    if (cache === "c" || cache=={}) {
        _cache_img_extensiones = null;
        return true;
    }

    // validación
    if (!cache || typeof cache !== "object" || Object.keys(cache).length === 0) {
        return false;
    }

    const limite = await obtenerLimiteCacheUrlImgExtensiones();

    if (!_cache_img_extensiones) _cache_img_extensiones = {};

    const actuales = Object.entries(_cache_img_extensiones);
    const nuevas = Object.entries(cache);

    if (nuevas.length >= limite) {
        _cache_img_extensiones = Object.fromEntries(nuevas.slice(-limite));
        return true;
    }

    const espacioDisponible = limite - actuales.length;

    if (espacioDisponible < nuevas.length) {
        const mantener = actuales.slice(nuevas.length - espacioDisponible);
        _cache_img_extensiones = Object.fromEntries([
            ...mantener,
            ...nuevas
        ]);
        return true;
    }

    // si hay espacio → añadir directamente
    Object.assign(_cache_img_extensiones, cache);
    return true;
}
export async function setLimiteCacheUrlImgExtensiones(limite) {
    if(typeof limite !== "number" || limite < 0){
        return false
    }
    saveAjustesAppFile({ LIMITE_CACHE_IMG_EXTENSIONES: limite });
    return true
}

export async function clearCacheUrlImgExtensiones() {
    _cache_img_extensiones = null
    const limite=await obtenerLimiteCacheUrlImgExtensiones()
    saveAjustesAppFile({ LIMITE_CACHE_IMG_EXTENSIONES: limite });
}
function obtenerLimiteCacheUrlImgExtensiones() {
    return getAjustesAppFile("LIMITE_CACHE_IMG_EXTENSIONES")
}