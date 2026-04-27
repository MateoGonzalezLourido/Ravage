import { createLogger } from '../../utils/logger.js';
const log = createLogger('cache-chats');
import { readFileSession, saveCacheChatsFile, getAjustesAppFile, saveAjustesAppFile } from '../../services/controladorArchivos.js';
import { getRecommendedCacheStrategy, getSystemResources } from '../../utils/systemInfo.js';

let _cache_chats = new Map(); // Para RAM (key: id string, value: chat object + metadata)
const LIMITE_FRECUENTES_MB = 128;
const PERIODO_PROTECCION_MS = 5 * 60 * 1000; // 5 minutos de protección para "uso muy corto"
let _cache_frecuentes_cargada = false;

const ESQUEMA_CACHE_CHAT = {
    _id:                null,       // ObjectId
    nombre:             null,       // { data, iv, tag } cifrado
    usuarios:           [],         // [ObjectId]
    admins:             [],         // [ObjectId]
    escaneres_seguridad: {},        // Object con flags de escaneres
    fecha_creacion:     null,       // Date
    _frequency:         0,
    _last_used:         0
};

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

function _minificar_chat(chat) {
    return {
        i: chat._id ? chat._id.toString() : chat.i,
        f: chat._frequency || 1,
        t: chat._last_used || Date.now(),
        n: chat.nombre || chat.n,
        u: chat.usuarios || chat.u,
        a: chat.admins || chat.a,
        y: chat.tipo || chat.y,
        k: chat.ratchet_keys || chat.k,
        d: chat.metadata || chat.d
    };
}

function _desminificar_chat(m) {
    return {
        _id: m.i,
        _frequency: m.f,
        _last_used: m.t,
        nombre: m.n,
        usuarios: m.u,
        admins: m.a,
        tipo: m.y,
        ratchet_keys: m.k,
        metadata: m.d
    };
}

async function _asegurar_inicio() {
    if (_cache_frecuentes_cargada) return;
    try {
        const { forceDisk, limitRAM } = await _obtener_limite_actual();
        const maxInitialMB = forceDisk ? 256 : Math.min(limitRAM, 512);

        const frecuentes_min = await readFileSession('cacheChatsFrecuentes') || [];
        let loadedMB = 0;

        for (const m of frecuentes_min) {
            const chat = _desminificar_chat(m);
            const size = _estimar_tamano_mb(chat);
            if (loadedMB + size <= maxInitialMB) {
                _cache_chats.set(chat._id.toString(), chat);
                loadedMB += size;
            } else {
                break;
            }
        }
        _cache_frecuentes_cargada = true;
    } catch (e) {
        log.error({ err: e }, "Error al cargar chats frecuentes");
    }
}

async function _obtener_limite_actual() {
    const ajustes = await getAjustesAppFile();
    const recommended = await getRecommendedCacheStrategy();

    const forceDisk = ajustes.FORCE_DISK_CACHE || recommended.type === 'disk';
    const limitRAM = ajustes.LIMITE_CHAT_CACHE_RAM || recommended.sizeMB;
    const limitDisk = ajustes.LIMITE_CHAT_CACHE_DISK || 2048;

    return { forceDisk, limitRAM, limitDisk };
}

async function _verificar_recursos_sistema(limite, tipo) {
    const { totalRamGB, freeDiskGB } = await getSystemResources();
    if (tipo === 'ram') {
        const limiteGB = limite / 1024;
        return totalRamGB > limiteGB;
    } else {
        const limiteGB = limite / 1024;
        return freeDiskGB > (limiteGB + 50);
    }
}

export async function getChatDeCache(id_chat) {
    await _asegurar_inicio();
    const id = id_chat.toString();
    const chat = _cache_chats.get(id);
    if (chat) {
        chat._frequency = (chat._frequency || 0) + 1;
        chat._last_used = Date.now();
        _gestionar_persistencia_frecuentes();
        return chat;
    }
    return null;
}

export async function setChatEnCache(chat) {
    await _asegurar_inicio();
    if (!chat || !chat._id) return;

    const id = chat._id.toString();
    const existing = _cache_chats.get(id);

    const chatFiltrado = Object.fromEntries(
        Object.keys(ESQUEMA_CACHE_CHAT).map(k => [k, chat[k] ?? ESQUEMA_CACHE_CHAT[k]])
    );

    chatFiltrado._frequency = (existing ? existing._frequency : 0) + 1;
    chatFiltrado._last_used = Date.now();

    _cache_chats.set(id, chatFiltrado);

    await _aplicar_limites_cache();
    _gestionar_persistencia_frecuentes();
}

async function _aplicar_limites_cache() {
    const { forceDisk, limitRAM, limitDisk } = await _obtener_limite_actual();
    const isRAMOk = await _verificar_recursos_sistema(limitRAM, 'ram');
    const isDiskOk = await _verificar_recursos_sistema(limitDisk, 'disk');

    const maxRAM_MB = forceDisk
        ? (isDiskOk ? 256 : 128)
        : (isRAMOk ? limitRAM : 128);

    let currentMB = 0;
    const chats = Array.from(_cache_chats.values());
    for(const c of chats) currentMB += _estimar_tamano_mb(c);

    if (currentMB > maxRAM_MB) {
        const now = Date.now();
        // Ordenar: menos frecuentes primero, luego los más viejos
        const sortedKeys = Array.from(_cache_chats.entries())
            .sort((a, b) => {
                if (a[1]._frequency !== b[1]._frequency) return a[1]._frequency - b[1]._frequency;
                return a[1]._last_used - b[1]._last_used;
            })
            .map(e => e[0]);

        for (const id of sortedKeys) {
            if (currentMB <= maxRAM_MB) break;

            const chat = _cache_chats.get(id);
            if (!chat) continue;

            // Protección: si es muy reciente, intentamos no borrarlo
            if (now - chat._last_used < PERIODO_PROTECCION_MS && _cache_chats.size > 1) {
                continue;
            }

            const itemSize = _estimar_tamano_mb(chat);
            _cache_chats.delete(id);
            currentMB -= itemSize;
        }
    }
}

let _timer_persistencia = null;
async function _gestionar_persistencia_frecuentes() {
    if (_timer_persistencia) return;

    _timer_persistencia = setTimeout(async () => {
        try {
            const { forceDisk, limitDisk } = await _obtener_limite_actual();
            const isDiskOk = await _verificar_recursos_sistema(limitDisk, 'disk');

            const persistentLimitMB = (forceDisk && isDiskOk) ? limitDisk : LIMITE_FRECUENTES_MB;

            const allChats = Array.from(_cache_chats.values());
            // Ordenar para persistir los más frecuentes y recientes
            allChats.sort((a, b) => {
                if (b._frequency !== a._frequency) return b._frequency - a._frequency;
                return b._last_used - a._last_used;
            });

            const frecuentes = [];
            let currentMB = 0;

            for (const chat of allChats) {
                const itemSize = _estimar_tamano_mb(chat);
                if (currentMB + itemSize <= persistentLimitMB) {
                    frecuentes.push(_minificar_chat(chat));
                    currentMB += itemSize;
                } else {
                    break;
                }
            }

            await saveCacheChatsFile(frecuentes);
        } catch (e) {
            log.error({ err: e }, "Error persistiendo chats frecuentes");
        } finally {
            _timer_persistencia = null;
        }
    }, 10000);
}

export async function setConfigCacheChats({ limitRAM, limitDisk, forceDisk }) {
    const settings = {};
    if (limitRAM !== undefined) settings.LIMITE_CHAT_CACHE_RAM = limitRAM;
    if (limitDisk !== undefined) settings.LIMITE_CHAT_CACHE_DISK = limitDisk;
    if (forceDisk !== undefined) settings.FORCE_DISK_CACHE = forceDisk;

    await saveAjustesAppFile({ data: settings, create: false });
    await _aplicar_limites_cache();
    return true;
}

export async function clearCacheChats() {
    _cache_chats.clear();
    await saveCacheChatsFile([]);
}

