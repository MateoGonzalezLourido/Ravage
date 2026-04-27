import { saveCacheArchivosDescargadosFile, readFileSession, getAjustesAppFile, saveAjustesAppFile } from '../../services/controladorArchivos.js'
import { createLogger } from '../../utils/logger.js';
const log = createLogger('cache-archivos-desc');

let _cache_archivos_descargados = new Map();
const LIMITE_RAM_MB = 256;
const TIEMPO_EXPIRACION = 5 * 60 * 1000; // 5 minutos
let timer_limpieza = null;

function resetearTimerLimpieza() {
    if (timer_limpieza) clearTimeout(timer_limpieza);
    timer_limpieza = setTimeout(() => {
        _cache_archivos_descargados.clear();
        timer_limpieza = null;
    }, TIEMPO_EXPIRACION);
}

/**
 * Estima el tamaño en bytes de un objeto de forma rápida.
 */
function _estimar_bytes_rapido(obj) {
    if (obj === null || obj === undefined) return 0;
    const type = typeof obj;
    if (type === 'string') return obj.length * 2;
    if (type === 'number') return 8;
    if (type === 'boolean') return 4;
    if (type === 'object') {
        let size = 0;
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) size += _estimar_bytes_rapido(obj[i]);
        } else {
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    size += key.length * 2 + _estimar_bytes_rapido(obj[key]);
                }
            }
        }
        return size;
    }
    return 0;
}

function _estimar_tamano_mb(data) {
    if (!data) return 0;
    return _estimar_bytes_rapido(data) / (1024 * 1024);
}

export async function getCacheArchivosDescargados() {
    resetearTimerLimpieza();
    if (_cache_archivos_descargados.size > 0) {
        return Array.from(_cache_archivos_descargados.values());
    }
    const data = await readFileSession('cacheArchivosDescargados') || [];
    _cache_archivos_descargados = new Map(data.map(item => [item.id || item.ruta || Math.random(), item]));
    return data;
}

export async function setCacheArchivosDescargados(cache = "c") {
    if (cache === "c") {
        _cache_archivos_descargados.clear();
        await saveCacheArchivosDescargadosFile([]);
        return true;
    }

    if (typeof cache !== "object" || Object.keys(cache).length === 0) {
        return false;
    }

    const [limite, _] = await Promise.all([
        obtenerLimiteCacheArchivosDescargados(),
        getCacheArchivosDescargados()
    ]);

    const id = cache.id || cache.ruta || Date.now();
    
    // Si ya existe, lo borramos para que al re-insertar quede al final (FIFO en Iterador)
    if (_cache_archivos_descargados.has(id)) {
        _cache_archivos_descargados.delete(id);
    }
    _cache_archivos_descargados.set(id, cache);

    // Límite por cantidad
    if (_cache_archivos_descargados.size > limite) {
        const firstKey = _cache_archivos_descargados.keys().next().value;
        _cache_archivos_descargados.delete(firstKey);
    }

    // Límite por RAM
    let currentMB = _estimar_tamano_mb(Array.from(_cache_archivos_descargados.values()));
    while (currentMB > LIMITE_RAM_MB && _cache_archivos_descargados.size > 0) {
        const firstKey = _cache_archivos_descargados.keys().next().value;
        const item = _cache_archivos_descargados.get(firstKey);
        currentMB -= _estimar_tamano_mb(item);
        _cache_archivos_descargados.delete(firstKey);
    }

    await saveCacheArchivosDescargadosFile(Array.from(_cache_archivos_descargados.values()));
    resetearTimerLimpieza();
    return true;
}

export async function setLimiteCacheArchivosDescargados(limite) {
    if (typeof limite !== "number" || limite < 0) {
        return false;
    }
    await saveAjustesAppFile({ data: { LIMITE_CACHE_ARCHIVOS_DESCARGADOS: limite }, create: false });
    return true;
}

export async function clearCacheArchivosDescargados() {
    _cache_archivos_descargados.clear();
    await saveCacheArchivosDescargadosFile([]);
}

async function obtenerLimiteCacheArchivosDescargados() {
    return await getAjustesAppFile("LIMITE_CACHE_ARCHIVOS_DESCARGADOS");
}