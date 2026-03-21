import {getAjustesAppFile,saveAjustesAppFile} from '../../services/controladorArchivos.js'
let _cache_img_extensiones = null
const LIMITE_RAM_MB = 256
const TIEMPO_EXPIRACION = 5 * 60 * 1000 // 5 minutos
let timer_limpieza = null

function resetearTimerLimpieza() {
    if (timer_limpieza) clearTimeout(timer_limpieza)
    timer_limpieza = setTimeout(() => {
        _cache_img_extensiones = null
        timer_limpieza = null
    }, TIEMPO_EXPIRACION)
}

function _estimar_tamano_cache_mb(data) {
    if (!data) return 0
    try {
        // En Node.js (backend), Buffer.byteLength es más eficiente que TextEncoder
        const bytes = Buffer.byteLength(JSON.stringify(data))
        return bytes / (1024 * 1024)
    } catch (e) {
        return 0
    }
}


export async function getCacheUrlImgExtensiones() {
    resetearTimerLimpieza()
    /*si esta vacio devolver siempre null */
    return _cache_img_extensiones
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

    const espacioDisponible = limite - actuales.length;

    if (nuevas.length >= limite) {
        _cache_img_extensiones = Object.fromEntries(nuevas.slice(-limite));
    } else if (espacioDisponible < nuevas.length) {
        const mantener = actuales.slice(nuevas.length - espacioDisponible);
        _cache_img_extensiones = Object.fromEntries([
            ...mantener,
            ...nuevas
        ]);
    } else {
        // si hay espacio → añadir directamente
        Object.assign(_cache_img_extensiones, cache);
    }

    // Aplicar límite de RAM de 256MB (igual que historial de archivos descargados)
    while (_estimar_tamano_cache_mb(_cache_img_extensiones) > LIMITE_RAM_MB && Object.keys(_cache_img_extensiones).length > 0) {
        const keys = Object.keys(_cache_img_extensiones)
        delete _cache_img_extensiones[keys[0]]
    }

    resetearTimerLimpieza()
    return true
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