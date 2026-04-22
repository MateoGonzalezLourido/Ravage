/*
Aqui se guarda la informacion de usuarios buscados en el historial de busquedas de usaurios añadir chat, es una cache en disco

datos que se guardan:
{
    datos:[{
    _id,
    datoUsadoBuscar (idAmigo o correo),
    veces_buscado,
    ultima_vez
    }],
    fecha_actualizado_global,
    cantidad_guardados
}

cuando se revisa la cache se mira la fecha_actualizado_global, si esta pasa de una semana se revisa toda la cache para comprobar si los datos son buenos o no: si el correo no es el mismo o si ese usuario no existe se borra

al hacer esto se reinicia la fecha_actualziado_global

los datos que usan el idamigo solo se revisa si existe, para optimizar

cuando cantidad_guardados sobrepasan el limite se borra el dato menos usado dentro de un ratio de minimo 2 dias de su ultima busqueda(ultima_vez), los mas usados no se borran excepto que su ultima busqueda sea mayor a 90 dias

cuando no esta claro que borrar una vez superado el limite pues se borra la entrada mas vieja

!Importante: esta lista no esta ordenada, la posicion de las entradas solo indican el orden en que se guardaron, lo cual es irrelevante
*/

import { readFileSession, saveCacheHistorialBusquedasAñadirFile } from '../../services/controladorArchivos.js';
import { encontrar_usuario } from '../../repositories/UserRepository.js';
import { createLogger } from '../../utils/logger.js';
const log = createLogger('cache-hist-buscar');

const LIMITE_HISTORIAL = 200;
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const DIAS_2_MS = 2 * 24 * 60 * 60 * 1000;
const DIAS_90_MS = 90 * 24 * 60 * 60 * 1000;

let _cache_historial = null;
let _timeout_limpieza_ram = null;

export function cancelar_limpieza_variable_cache() {
    if (_timeout_limpieza_ram) {
        clearTimeout(_timeout_limpieza_ram);
        _timeout_limpieza_ram = null;
    }
}

async function _asegurar_inicio() {
    cancelar_limpieza_variable_cache();
    if (_cache_historial) return;
    try {
        const guardado = await readFileSession('cacheHistorialBusquedasAñadir');
        if (guardado && Array.isArray(guardado.datos)) {
            _cache_historial = guardado;
            // Asegurar que si falta algo, se reponga
            if (!_cache_historial.fecha_actualizado_global) _cache_historial.fecha_actualizado_global = Date.now();
            _cache_historial.cantidad_guardados = _cache_historial.datos.length;
        } else {
            _cache_historial = {
                datos: [],
                fecha_actualizado_global: Date.now(),
                cantidad_guardados: 0
            };
        }
        await _revisar_cache_semanal();
    } catch (e) {
        log.error({ err: e }, "Error iniciando cache de historial");
        _cache_historial = { datos: [], fecha_actualizado_global: Date.now(), cantidad_guardados: 0 };
    }
}

async function _guardar_en_disco() {
    try {
        _cache_historial.cantidad_guardados = _cache_historial.datos.length;
        await saveCacheHistorialBusquedasAñadirFile(_cache_historial);
    } catch (e) {
        log.error({ err: e }, "Error guardando cache historial");
    }
}

/**
 * Función que hace la revisión en mongodb de los datos
 * Revisa que el usuario exista (si es por correo o idAmigo)
 */
export async function revisar_mongodb_datos() {
    await _asegurar_inicio();
    const datosValidos = [];
    let modificado = false;
    
    for (const item of _cache_historial.datos) {
        const esCorreo = item.datoUsadoBuscar.includes('@');
        
        try {
            // encontrar_usuario devuelve {id, nombre} o null
            const valid = await encontrar_usuario(item.datoUsadoBuscar, esCorreo);
            
            if (valid) {
                 datosValidos.push(item);
            } else {
                 modificado = true;
            }
        } catch(e) {
            log.error(e);
            datosValidos.push(item); // En caso de problema, no borrar
        }
    }
    
    if (modificado) {
        _cache_historial.datos = datosValidos;
        _cache_historial.cantidad_guardados = _cache_historial.datos.length;
    }
    _cache_historial.fecha_actualizado_global = Date.now();
    await _guardar_en_disco();
}

async function _revisar_cache_semanal() {
    const ahora = Date.now();
    if (ahora - _cache_historial.fecha_actualizado_global > SEMANA_MS) {
        await revisar_mongodb_datos();
    }
}

/**
 * Cuando cantidad_guardados sobrepasan el limite se borra el dato menos usado dentro de un 
 * ratio de minimo 2 dias de su ultima busqueda, los mas usados no se borran excepto que 
 * su ultima busqueda sea mayor a 90 dias
 */
function _borrar_inteligentemente() {
    if (_cache_historial.cantidad_guardados <= LIMITE_HISTORIAL) return;
    
    const ahora = Date.now();
    let indexABorrar = -1;
    
    // Filtrar candidatos a borrar: que tengan más de 2 días
    let candidatos = _cache_historial.datos.map((d, i) => ({...d, idx: i}))
                         .filter(d => (ahora - d.ultima_vez) > DIAS_2_MS);
                         
    if (candidatos.length > 0) {
        // Ordenarlos para encontrar el mejor candidato a borrar (el primero de la lista ordenada será el elegido)
        candidatos.sort((a, b) => {
            const a_old = (ahora - a.ultima_vez) > DIAS_90_MS;
            const b_old = (ahora - b.ultima_vez) > DIAS_90_MS;
            
            // Si a tiene más de 90 días y b no, a debe ser borrado con más prioridad
            if (a_old && !b_old) return -1;
            if (!a_old && b_old) return 1;
            
            // Si ninguno tiene 90 días (o ambos), miramos menos usado
            if (a.veces_buscado !== b.veces_buscado) {
                return a.veces_buscado - b.veces_buscado; // El menor será el primero (priority for deletion)
            }
            
            // Si empatan en uso, miramos el más viejo (menor tiempo de ultima vez)
            return a.ultima_vez - b.ultima_vez;
        });
        
        indexABorrar = candidatos[0].idx;
    } else {
        // No hay nadie con más de 2 días, borrar el más viejo
        let oldestIndex = 0;
        for (let i = 1; i < _cache_historial.datos.length; i++) {
            if (_cache_historial.datos[i].ultima_vez < _cache_historial.datos[oldestIndex].ultima_vez) {
                oldestIndex = i;
            }
        }
        indexABorrar = oldestIndex;
    }
    
    if (indexABorrar !== -1) {
        _cache_historial.datos.splice(indexABorrar, 1);
        _cache_historial.cantidad_guardados = _cache_historial.datos.length;
    }
}

/**
 * Añadir un usuario al historial
 */
export async function añadir_historial(id, datoUsado) {
    await _asegurar_inicio();
    
    const index = _cache_historial.datos.findIndex(d => d._id === id || d.datoUsadoBuscar === datoUsado);
    if (index !== -1) {
        _cache_historial.datos[index].veces_buscado += 1;
        _cache_historial.datos[index].ultima_vez = Date.now();
    } else {
        _cache_historial.datos.push({
            _id: id,
            datoUsadoBuscar: datoUsado,
            veces_buscado: 1,
            ultima_vez: Date.now()
        });
        _cache_historial.cantidad_guardados++;
        
        // Comprobar limite
        while (_cache_historial.cantidad_guardados > LIMITE_HISTORIAL) {
            _borrar_inteligentemente();
        }
    }
    
    await _guardar_en_disco();
}

/**
 * Borrar un usuario del historial
 */
export async function borrar_historial_usuario(id_o_dato) {
    await _asegurar_inicio();
    const lenInicial = _cache_historial.datos.length;
    _cache_historial.datos = _cache_historial.datos.filter(d => d._id !== id_o_dato && d.datoUsadoBuscar !== id_o_dato);
    if (_cache_historial.datos.length !== lenInicial) {
        _cache_historial.cantidad_guardados = _cache_historial.datos.length;
        await _guardar_en_disco();
        return true;
    }
    return false;
}

/**
 * Limpiar historial completo
 */
export async function limpiar_historial_completo() {
    _cache_historial = {
        datos: [],
        fecha_actualizado_global: Date.now(),
        cantidad_guardados: 0
    };
    await saveCacheHistorialBusquedasAñadirFile(_cache_historial);
}

/**
 * Obtener historial
 */
export async function obtener_historial() {
    await _asegurar_inicio();
    return _cache_historial;
}

/**
 * Limpiar variable cache (RAM)
 */
export function limpiar_variable_cache() {
    if (_timeout_limpieza_ram) clearTimeout(_timeout_limpieza_ram);
    _timeout_limpieza_ram = setTimeout(() => {
        _cache_historial = null;
        _timeout_limpieza_ram = null;
    }, 5000);
}

