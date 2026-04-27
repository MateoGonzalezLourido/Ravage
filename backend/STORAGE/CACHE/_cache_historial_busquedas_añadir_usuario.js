import { readFileSession, saveCacheHistorialBusquedasAñadirFile } from '../../services/controladorArchivos.js';
import { encontrar_usuario } from '../../repositories/UserRepository.js';
import { createLogger } from '../../utils/logger.js';
const log = createLogger('cache-hist-buscar');

const LIMITE_HISTORIAL = 200;
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const DIAS_2_MS = 2 * 24 * 60 * 60 * 1000;
const DIAS_90_MS = 90 * 24 * 60 * 60 * 1000;

// _cache_historial contendrá { datos: Map, fecha_actualizado_global }
let _cache_historial_map = null;
let _fecha_actualizado_global = Date.now();
let _timeout_limpieza_ram = null;

export function cancelar_limpieza_variable_cache() {
    if (_timeout_limpieza_ram) {
        clearTimeout(_timeout_limpieza_ram);
        _timeout_limpieza_ram = null;
    }
}

async function _asegurar_inicio() {
    cancelar_limpieza_variable_cache();
    if (_cache_historial_map) return;
    try {
        const guardado = await readFileSession('cacheHistorialBusquedasAñadir');
        if (guardado && Array.isArray(guardado.datos)) {
            _cache_historial_map = new Map();
            for (const d of guardado.datos) {
                // Usamos una clave compuesta o preferimos el datoUsadoBuscar por ser único en búsquedas
                _cache_historial_map.set(d.datoUsadoBuscar, d);
            }
            _fecha_actualizado_global = guardado.fecha_actualizado_global || Date.now();
        } else {
            _cache_historial_map = new Map();
            _fecha_actualizado_global = Date.now();
        }
        await _revisar_cache_semanal();
    } catch (e) {
        log.error({ err: e }, "Error iniciando cache de historial");
        _cache_historial_map = new Map();
        _fecha_actualizado_global = Date.now();
    }
}

async function _guardar_en_disco() {
    try {
        const datos_array = Array.from(_cache_historial_map.values());
        await saveCacheHistorialBusquedasAñadirFile({
            datos: datos_array,
            fecha_actualizado_global: _fecha_actualizado_global,
            cantidad_guardados: datos_array.length
        });
    } catch (e) {
        log.error({ err: e }, "Error guardando cache historial");
    }
}

export async function revisar_mongodb_datos() {
    await _asegurar_inicio();
    let modificado = false;
    
    for (const [key, item] of _cache_historial_map.entries()) {
        const esCorreo = item.datoUsadoBuscar.includes('@');
        try {
            const valid = await encontrar_usuario(item.datoUsadoBuscar, esCorreo);
            if (!valid) {
                _cache_historial_map.delete(key);
                modificado = true;
            }
        } catch(e) {
            log.error(e);
        }
    }
    
    if (modificado) {
        _fecha_actualizado_global = Date.now();
        await _guardar_en_disco();
    }
}

async function _revisar_cache_semanal() {
    const ahora = Date.now();
    if (ahora - _fecha_actualizado_global > SEMANA_MS) {
        await revisar_mongodb_datos();
    }
}

function _borrar_inteligentemente() {
    if (_cache_historial_map.size <= LIMITE_HISTORIAL) return;
    
    const ahora = Date.now();
    let keyABorrar = null;
    
    // Buscar candidatos con más de 2 días
    let mejorCandidato = null;
    let masViejo = null;

    for (const [key, d] of _cache_historial_map.entries()) {
        const antiguedad = ahora - d.ultima_vez;
        
        if (!masViejo || d.ultima_vez < masViejo.val.ultima_vez) {
            masViejo = { key, val: d };
        }

        if (antiguedad > DIAS_2_MS) {
            const esMuyViejo = antiguedad > DIAS_90_MS;
            
            if (!mejorCandidato) {
                mejorCandidato = { key, val: d, esMuyViejo };
                continue;
            }

            // Prioridad 1: Más de 90 días
            if (esMuyViejo && !mejorCandidato.esMuyViejo) {
                mejorCandidato = { key, val: d, esMuyViejo };
            } 
            else if (esMuyViejo === mejorCandidato.esMuyViejo) {
                // Prioridad 2: Menos veces buscado
                if (d.veces_buscado < mejorCandidato.val.veces_buscado) {
                    mejorCandidato = { key, val: d, esMuyViejo };
                } 
                // Prioridad 3: Más tiempo sin usarse
                else if (d.veces_buscado === mejorCandidato.val.veces_buscado && d.ultima_vez < mejorCandidato.val.ultima_vez) {
                    mejorCandidato = { key, val: d, esMuyViejo };
                }
            }
        }
    }
    
    keyABorrar = mejorCandidato ? mejorCandidato.key : (masViejo ? masViejo.key : null);
    
    if (keyABorrar) {
        _cache_historial_map.delete(keyABorrar);
    }
}

export async function añadir_historial(id, datoUsado) {
    await _asegurar_inicio();
    
    // Búsqueda rápida por datoUsado (clave del Map)
    let item = _cache_historial_map.get(datoUsado);
    
    // Si no está por datoUsado, buscar por _id en los valores (menos frecuente)
    if (!item) {
        for (const d of _cache_historial_map.values()) {
            if (d._id === id) {
                item = d;
                break;
            }
        }
    }

    if (item) {
        item.veces_buscado += 1;
        item.ultima_vez = Date.now();
    } else {
        _cache_historial_map.set(datoUsado, {
            _id: id,
            datoUsadoBuscar: datoUsado,
            veces_buscado: 1,
            ultima_vez: Date.now()
        });
        
        while (_cache_historial_map.size > LIMITE_HISTORIAL) {
            _borrar_inteligentemente();
        }
    }
    
    await _guardar_en_disco();
}

export async function borrar_historial_usuario(id_o_dato) {
    await _asegurar_inicio();
    
    if (_cache_historial_map.has(id_o_dato)) {
        _cache_historial_map.delete(id_o_dato);
        await _guardar_en_disco();
        return true;
    }

    // Si no está por clave, buscar por ID en valores
    for (const [key, d] of _cache_historial_map.entries()) {
        if (d._id === id_o_dato) {
            _cache_historial_map.delete(key);
            await _guardar_en_disco();
            return true;
        }
    }
    return false;
}

export async function limpiar_historial_completo() {
    _cache_historial_map = new Map();
    _fecha_actualizado_global = Date.now();
    await saveCacheHistorialBusquedasAñadirFile({
        datos: [],
        fecha_actualizado_global: _fecha_actualizado_global,
        cantidad_guardados: 0
    });
}

export async function obtener_historial() {
    await _asegurar_inicio();
    return {
        datos: Array.from(_cache_historial_map.values()),
        fecha_actualizado_global: _fecha_actualizado_global,
        cantidad_guardados: _cache_historial_map.size
    };
}

export function limpiar_variable_cache() {
    if (_timeout_limpieza_ram) clearTimeout(_timeout_limpieza_ram);
    _timeout_limpieza_ram = setTimeout(() => {
        _cache_historial_map = null;
        _timeout_limpieza_ram = null;
    }, 5000);
}


