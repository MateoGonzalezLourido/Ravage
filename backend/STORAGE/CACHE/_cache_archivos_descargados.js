import { saveCacheArchivosDescargadosFile, readFileSession, getAjustesAppFile, saveAjustesAppFile } from '../../services/controladorArchivos.js'
let _cache_archivos_descargados = null
const LIMITE_RAM_MB = 256
const TIEMPO_EXPIRACION = 5 * 60 * 1000 // 5 minutos
let timer_limpieza = null

function resetearTimerLimpieza() {
    if (timer_limpieza) clearTimeout(timer_limpieza)
    timer_limpieza = setTimeout(() => {
        _cache_archivos_descargados = null
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

export async function getCacheArchivosDescargados() {
    resetearTimerLimpieza()
    if (_cache_archivos_descargados) return _cache_archivos_descargados
    _cache_archivos_descargados = await readFileSession('cacheArchivosDescargados') || []
    return _cache_archivos_descargados
}

export async function setCacheArchivosDescargados(cache = "c") {
    if(cache=="c"){
        _cache_archivos_descargados = [];
        await saveCacheArchivosDescargadosFile([])
        return true
    }

    if(typeof cache !== "object" || Object.keys(cache).length === 0){
        return false
    }

    const [limite, cache_actual] = await Promise.all([
        obtenerLimiteCacheArchivosDescargados(),
        getCacheArchivosDescargados()
    ]);

    if(cache_actual.length >= limite){
        cache_actual.shift();
    }

    cache_actual.push(cache);

    // Aplicar límite de RAM de 256MB (igual que en imágenes de extensiones y frontend)
    while (_estimar_tamano_cache_mb(cache_actual) > LIMITE_RAM_MB && cache_actual.length > 0) {
        cache_actual.shift();
    }

    _cache_archivos_descargados = cache_actual;
    await saveCacheArchivosDescargadosFile(cache_actual)
    resetearTimerLimpieza()
    return true
}

export async function setLimiteCacheArchivosDescargados(limite) {
    if(typeof limite !== "number" || limite < 0){
        return false
    }
    await saveAjustesAppFile({ data: { LIMITE_CACHE_ARCHIVOS_DESCARGADOS: limite }, create: false });
    return true
}

export async function clearCacheArchivosDescargados() {
    _cache_archivos_descargados = [];
    await saveCacheArchivosDescargadosFile([]);
}

async function obtenerLimiteCacheArchivosDescargados(){
    return await getAjustesAppFile("LIMITE_CACHE_ARCHIVOS_DESCARGADOS")
}