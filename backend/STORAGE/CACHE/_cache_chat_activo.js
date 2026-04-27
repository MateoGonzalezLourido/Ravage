import { createLogger } from '../../utils/logger.js';
const log = createLogger('cache-chat-activo');

/**
 * CACHE CHAT ACTIVO
 * Cache temporal para almacenar datos ligeros del chat que se está visualizando/usando.
 * Se auto-elimina cada 3 minutos o cuando se solicita explícitamente.
 */
const _cache_chats_activos = new Map();
const _timers = new Map();
const TIEMPO_VIDA_MS = 3 * 60 * 1000; // 3 Minutos
const MAX_CHATS = 2;

/**
 * Gestiona el timer de expiración para un chat.
 */
function resetearTimerExpiracion(id) {
    if (_timers.has(id)) {
        clearTimeout(_timers.get(id));
    }
    
    const timer = setTimeout(() => {
        if (_cache_chats_activos.has(id)) {
            log.debug(`Cache del chat ${id} expirada automáticamente`);
            borrarCacheChatActivo(id);
        }
    }, TIEMPO_VIDA_MS);
    
    _timers.set(id, timer);
}

/**
 * Crea o actualiza la cache de un chat activo específico.
 */
export function crearCacheChatActivo(datos) {
    const id = datos._id?.toString();
    if (!id) return;

    if (!_cache_chats_activos.has(id) && _cache_chats_activos.size >= MAX_CHATS) {
        const oldestId = _cache_chats_activos.keys().next().value;
        borrarCacheChatActivo(oldestId);
    }

    let chat_data = _cache_chats_activos.get(id) || {};

    const campos = ['seguridad', 'usuarios', 'admins', 'fecha_creacion', 'nmensajes', 'd_participantes'];
    let modificado = false;

    for (const key of campos) {
        if (datos[key] !== undefined && chat_data[key] !== datos[key]) {
            chat_data[key] = datos[key];
            modificado = true;
        }
    }

    if (modificado || !_cache_chats_activos.has(id)) {
        // Re-insertar para mantener el orden (FIFO en Iterador)
        _cache_chats_activos.delete(id);
        _cache_chats_activos.set(id, chat_data);
    }

    resetearTimerExpiracion(id);
}

/**
 * Obtiene los datos de un chat específico.
 */
export function obtenerCacheChatActivo(id, bloque = null) {
    if (!id) return null;
    const id_str = id.toString();
    const chat = _cache_chats_activos.get(id_str);

    if (!chat) return null;

    resetearTimerExpiracion(id_str);

    if (bloque === "seguridad") return chat.seguridad;
    return chat;
}

/**
 * Borra la cache de un chat específico o toda la cache si no se pasa ID.
 */
export function borrarCacheChatActivo(id = null) {
    if (id) {
        const id_str = id.toString();
        if (_timers.has(id_str)) {
            clearTimeout(_timers.get(id_str));
            _timers.delete(id_str);
        }
        if (_cache_chats_activos.delete(id_str)) {
            log.debug(`Cache activa del chat ${id_str} borrada`);
        }
    } else {
        if (_cache_chats_activos.size === 0 && _timers.size === 0) return;
        for (const timer of _timers.values()) clearTimeout(timer);
        _timers.clear();
        _cache_chats_activos.clear();
        log.debug('Toda la cache de chats activos ha sido borrada');
    }
}

