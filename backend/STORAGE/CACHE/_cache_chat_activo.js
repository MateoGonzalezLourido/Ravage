import { createLogger } from '../../utils/logger.js';
const log = createLogger('cache-chat-activo');

/**
 * CACHE CHAT ACTIVO
 * Cache temporal para almacenar datos ligeros del chat que se está visualizando/usando.
 * Se auto-elimina cada 3 minutos o cuando se solicita explícitamente.
 */
let _cache_chats_activos = new Map();
let _timers = new Map();
const TIEMPO_VIDA_MS = 3 * 60 * 1000; // 3 Minutos
const MAX_CHATS = 2;

/**
 * Crea o actualiza la cache de un chat activo específico.
 * @param {Object} datos - Nuevos datos temporales. Debe incluir _id.
 */
export function crearCacheChatActivo(datos) {
    const id = datos._id?.toString();
    if (!id) return;

    // Si es un chat nuevo y superamos el límite, borrar el más antiguo (FIFO)
    if (!_cache_chats_activos.has(id) && _cache_chats_activos.size >= MAX_CHATS) {
        const oldestId = _cache_chats_activos.keys().next().value;
        borrarCacheChatActivo(oldestId);
    }

    let chat_data = _cache_chats_activos.get(id) || {};

    const mapeo_campos = {
        seguridad: 'seguridad',
        participantes: 'participantes',
        admin: 'admin',
        fecha_creacion: 'fecha_creacion',
        n_mensajes: 'n_mensajes',
        d_participantes: 'd_participantes'
    };

    for (let key in mapeo_campos) {
        if (datos[key] !== undefined) {
            chat_data[mapeo_campos[key]] = datos[key];
        }
    }

    // Guardar/Actualizar en el Map (esto también lo mueve al final en términos de orden si se re-inserta)
    _cache_chats_activos.delete(id); 
    _cache_chats_activos.set(id, chat_data);

    // Gestionar Timer individual
    if (_timers.has(id)) {
        clearTimeout(_timers.get(id));
    }
    
    const timer = setTimeout(() => {
        log.debug(`Cache del chat ${id} expirada automáticamente`);
        borrarCacheChatActivo(id);
    }, TIEMPO_VIDA_MS);
    
    _timers.set(id, timer);
    log.debug(`Cache activa del chat ${id} actualizada/creada`);
}

/**
 * Obtiene los datos de un chat específico.
 * @param {string} id - ID del chat.
 * @param {string} bloque - Bloque específico a retornar (opcional).
 */
export function obtenerCacheChatActivo(id, bloque = null) {
    if (!id) return null;
    const chat = _cache_chats_activos.get(id.toString());
    
    if (!chat) return null;

    if (bloque === "seguridad") {
       return chat.seguridad;
    }

    return chat;
}

/**
 * Borra la cache de un chat específico o toda la cache si no se pasa ID.
 * @param {string} id - ID del chat (opcional).
 */
export function borrarCacheChatActivo(id = null) {
    if (id) {
        const id_str = id.toString();
        if (_timers.has(id_str)) {
            clearTimeout(_timers.get(id_str));
            _timers.delete(id_str);
        }
        _cache_chats_activos.delete(id_str);
        log.debug(`Cache activa del chat ${id_str} borrada`);
    } else {
        // Borrar todo
        for (const timer of _timers.values()) clearTimeout(timer);
        _timers.clear();
        _cache_chats_activos.clear();
        log.debug('Toda la cache de chats activos ha sido borrada');
    }
}
