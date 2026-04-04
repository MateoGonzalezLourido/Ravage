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

    for (const key in datos) {
        _cache_datos_chat_activo[key] = datos[key];
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
    if (!bloque||!_cache_datos_chat_activo) {
        return _cache_datos_chat_activo;
    }
    
    if (bloque === "seguridad") {
        salida.ESCANER_ESTEGANOGRAFIA = _cache_datos_chat_activo.ESCANER_ESTEGANOGRAFIA
        salida.ESCANER_URL = _cache_datos_chat_activo.ESCANER_URL
        salida.ESCANER_URL_MALICIOSA = _cache_datos_chat_activo.ESCANER_URL_MALICIOSA
        salida.ESCANER_XSS = _cache_datos_chat_activo.ESCANER_XSS
        salida.ESCANER_CODIGO = _cache_datos_chat_activo.ESCANER_CODIGO
        salida.ESCANER_ZALGO = _cache_datos_chat_activo.ESCANER_ZALGO
        salida.ESCANER_COMANDOS_TERMINAL = _cache_datos_chat_activo.ESCANER_COMANDOS_TERMINAL
        salida.ESCANER_CRYPTO_BILLETERAS = _cache_datos_chat_activo.ESCANER_CRYPTO_BILLETERAS
        salida.ESCANER_DIRECCIONES_IP = _cache_datos_chat_activo.ESCANER_DIRECCIONES_IP
        salida.ESCANER_HOMOGLIFOS = _cache_datos_chat_activo.ESCANER_HOMOGLIFOS
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
