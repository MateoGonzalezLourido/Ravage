import { createLogger } from '../../utils/logger.js';
const log = createLogger('cache-chat-activo');

/**
 * CACHE CHAT ACTIVO
 * Cache temporal para almacenar datos ligeros del chat que se está visualizando/usando.
 * Se auto-elimina cada 3 minutos o cuando se solicita explícitamente.
 */
let _cache_datos_chat_activo = null;
let _timer = null;
const TIEMPO_VIDA_MS = 3 * 60 * 1000; // 3 Minutos

/**
 * Crea o actualiza la cache del chat activo.
 * Fusiona los datos nuevos con los existentes (merge).
 * @param {Object} datos - Nuevos datos temporales a añadir o modificar.
 */
export function crearCacheChatActivo(datos) {
    if (!_cache_datos_chat_activo) {
        _cache_datos_chat_activo = {};
    }
    //esquema: key y su nombre en la cache
    const mapeo_campos = {
        seguridad: 'seguridad',
        participantes: 'participantes',
        Admin: 'admin',
        fecha_creacion: 'fecha_creacion',
        n_mensajes: 'n_mensajes',
        d_participantes: 'd_participantes'
    };

    for (let key in mapeo_campos) {
        if (datos[key]) {
            _cache_datos_chat_activo[mapeo_campos[key]] = datos[key];
        }
    }

    //el ciclo de vida no cambia, solo se actualizan los datos
    if (!_timer) {
        _timer = setTimeout(() => {
            log.debug('Cache de chat activo expirada automáticamente (3min)');
            borrarCacheChatActivo();
        }, TIEMPO_VIDA_MS);
        log.debug('Cache de chat activo creada y ciclo de 3min iniciado');
    } else {
        log.debug('Cache de chat activo actualizada con nuevos datos');
    }
}

/**
 * Obtiene los datos almacenados en la cache.
 * @returns {any} Los datos de la cache o null si no existe.
 */
export function obtenerCacheChatActivo(bloque = null) {
    //puedes añadir tus propios bloques de salida
    let salida = {}
    if (!bloque || !_cache_datos_chat_activo) {
        return _cache_datos_chat_activo;
    }

    if (bloque === "seguridad") {
       return _cache_datos_chat_activo.seguridad
    }

    return salida;
}

/**
 * Borra la cache y detiene el temporizador de expiración.
 */
export function borrarCacheChatActivo() {
    if (_timer) {
        clearTimeout(_timer);
        _timer = null;
    }
    _cache_datos_chat_activo = null;
    log.debug('Cache de chat activo borrada');
}
