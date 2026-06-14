import db from './database.js';
import { getAjustesAppFile, saveAjustesAppFile } from '../../services/controladorArchivos.js'
import { createLogger } from '../../utils/logger.js';
import { gzipSync, gunzipSync } from '../../utils/libs.js';
const log = createLogger('cache-archivos-desc');

const LIMITE_RAM_MB = 256;
const TIEMPO_EXPIRACION = 5 * 60 * 1000; // 5 minutos

// Preparar sentencias
const stmt_insert = db.prepare('INSERT OR REPLACE INTO archivos_descargados (id, data, timestamp) VALUES (?, ?, ?)');
const stmt_select_all = db.prepare('SELECT data FROM archivos_descargados ORDER BY timestamp ASC');
const stmt_delete = db.prepare('DELETE FROM archivos_descargados WHERE id = ?');
const stmt_clear = db.prepare('DELETE FROM archivos_descargados');
const stmt_count = db.prepare('SELECT COUNT(*) as count FROM archivos_descargados');
const stmt_get_oldest = db.prepare('SELECT id, data FROM archivos_descargados ORDER BY timestamp ASC LIMIT 1');

/**
 * Estima el tamaño en bytes de un objeto de forma rápida.
 */
function _estimar_bytes_rapido(obj) {
    if (obj === null || obj === undefined) return 0;
    if (Buffer.isBuffer(obj)) return obj.length;
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
    const rows = stmt_select_all.all();
    return rows.map(r => {
        try {
            // Intentar descompresión
            const decompressed = gunzipSync(r.data);
            return JSON.parse(decompressed.toString());
        } catch (e) {
            // Retrocompatibilidad si no estaba comprimido
            try {
                return JSON.parse(r.data);
            } catch (err) {
                return null;
            }
        }
    }).filter(item => item !== null);
}

export async function setCacheArchivosDescargados(cache = "c") {
    if (cache === "c") {
        stmt_clear.run();
        return true;
    }

    if (typeof cache !== "object" || Object.keys(cache).length === 0) {
        return false;
    }

    const limite = await obtenerLimiteCacheArchivosDescargados();
    const id = (cache.id_archivo || cache.id || cache.ruta || Date.now()).toString();
    
    // Comprimir y minificar (JSON.stringify sin espacios)
    const compressed = gzipSync(JSON.stringify(cache));
    
    // Insertar o actualizar
    stmt_insert.run(id, compressed, Date.now());

    // Límite por cantidad
    let currentCount = stmt_count.get().count;
    while (currentCount > limite) {
        const oldest = stmt_get_oldest.get();
        if (oldest) {
            stmt_delete.run(oldest.id);
            currentCount--;
        } else break;
    }

    // Límite por RAM (estimación basada en los datos en la base de datos)
    const allData = stmt_select_all.all().map(r => {
        try {
            return JSON.parse(gunzipSync(r.data).toString());
        } catch (e) {
            try { return JSON.parse(r.data); } catch { return null; }
        }
    }).filter(Boolean);
    let currentMB = _estimar_tamano_mb(allData);

    while (currentMB > LIMITE_RAM_MB) {
        const oldest = stmt_get_oldest.get();
        if (oldest) {
            let data;
            try {
                data = JSON.parse(gunzipSync(oldest.data).toString());
            } catch (e) {
                try { data = JSON.parse(oldest.data); } catch { data = {}; }
            }
            const itemSize = _estimar_tamano_mb(data);
            stmt_delete.run(oldest.id);
            currentMB -= itemSize;
        } else break;
    }

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
    stmt_clear.run();
}

async function obtenerLimiteCacheArchivosDescargados() {
    return await getAjustesAppFile("LIMITE_CACHE_ARCHIVOS_DESCARGADOS");
}