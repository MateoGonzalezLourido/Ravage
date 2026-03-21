import { readFileSession, saveCacheChatsFile, getAjustesAppFile, saveAjustesAppFile } from '../services/controladorArchivos.js';
import { getRecommendedCacheStrategy, getSystemResources } from '../../utils/systemInfo.js';
import { fs, path } from '../../utils/libs.js';

let _cache_chats = new Map(); // Para RAM
let _frecuencia_chats = new Map(); // Tracking de uso
let _last_used_chats = new Map(); // Tracking de tiempo
const LIMITE_FRECUENTES_MB = 128;
const PERIODO_PROTECCION_MS = 5 * 60 * 1000; // 5 minutos de protección para "uso muy corto"
let _cache_frecuentes_cargada = false;

/**
 * Estima el tamaño en MB de un objeto.
 */
function _estimar_tamano_mb(data) {
    if (!data) return 0;
    try {
        const bytes = Buffer.byteLength(JSON.stringify(data));
        return bytes / (1024 * 1024);
    } catch (e) {
        return 0;
    }
}

function _minificar_chat(chat) {
    return {
        i: chat._id ? chat._id.toString() : chat.i,
        f: chat._frequency || chat.f || 1,
        t: chat._last_used || chat.t || Date.now(),
        n: chat.nombre || chat.n,
        u: chat.usuarios || chat.u,
        a: chat.admins || chat.a,
        y: chat.tipo || chat.y,
        m: chat.mensajes || chat.m, // IDs de mensajes
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
        mensajes: m.m,
        ratchet_keys: m.k,
        metadata: m.d
    };
}

/**
 * Inicializa la caché cargando los chats frecuentes desde disco si existen.
 */
/**
 * Inicializa la caché cargando los chats frecuentes desde disco.
 * Si estamos en modo RAM, limitamos la carga inicial para no saturar.
 */
async function _asegurar_inicio() {
    if (_cache_frecuentes_cargada) return;
    try {
        const { forceDisk, limitRAM } = await _obtener_limite_actual();
        const maxInitialMB = forceDisk ? 256 : Math.min(limitRAM, 512); // No cargar más de 512MB al inicio en RAM

        const frecuentes_min = await readFileSession('cacheChatsFrecuentes') || [];
        let loadedMB = 0;

        for (const m of frecuentes_min) {
            const chat = _desminificar_chat(m);
            const size = _estimar_tamano_mb(chat);
            if (loadedMB + size <= maxInitialMB) {
                _cache_chats.set(chat._id.toString(), chat);
                _frecuencia_chats.set(chat._id.toString(), chat._frequency);
                _last_used_chats.set(chat._id.toString(), chat._last_used);
                loadedMB += size;
            } else {
                break;
            }
        }
        _cache_frecuentes_cargada = true;
    } catch (e) {
        console.error("Error al cargar chats frecuentes:", e);
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
    if (_cache_chats.has(id)) {
        // En caso de CACHE HIT: suma +1 al contador
        const f = (_frecuencia_chats.get(id) || 0) + 1;
        _frecuencia_chats.set(id, f);
        _last_used_chats.set(id, Date.now());

        const chat = _cache_chats.get(id);
        chat._frequency = f;
        chat._last_used = _last_used_chats.get(id);
        
        _gestionar_persistencia_frecuentes();
        return chat;
    }
    return null;
}

export async function setChatEnCache(chat) {
    await _asegurar_inicio();
    if (!chat || !chat._id) return;
    
    const id = chat._id.toString();
    // En caso de CACHE MISS / ACTUALIZACION: suma +1 al contador
    const f = (_frecuencia_chats.get(id) || 0) + 1;
    _frecuencia_chats.set(id, f);
    _last_used_chats.set(id, Date.now());

    chat._frequency = f;
    chat._last_used = _last_used_chats.get(id);
    
    _cache_chats.set(id, chat);
    
    await _aplicar_limites_cache();
    _gestionar_persistencia_frecuentes();
}
async function _aplicar_limites_cache() {
    const { forceDisk, limitRAM, limitDisk } = await _obtener_limite_actual();
    const isRAMOk = await _verificar_recursos_sistema(limitRAM, 'ram');
    const isDiskOk = await _verificar_recursos_sistema(limitDisk, 'disk');
    
    // Si forzamos disco, el límite de RAM de la Map debe ser pequeño (ej 256MB)
    // El "cache" real estará en el archivo persistente que puede ser de hasta limitDisk.
    const maxRAM_MB = forceDisk ? 256 : (isRAMOk ? limitRAM : 128);
    
    let currentMB = _estimar_tamano_mb(Array.from(_cache_chats.values()));
    
    if (currentMB > maxRAM_MB) {
        const now = Date.now();
        const sorted = Array.from(_cache_chats.keys()).sort((a, b) => {
            const freqA = _frecuencia_chats.get(a) || 0;
            const freqB = _frecuencia_chats.get(b) || 0;
            
            if (freqA !== freqB) return freqA - freqB;
            
            // Tie-break: el más viejo primero
            const timeA = _last_used_chats.get(a) || 0;
            const timeB = _last_used_chats.get(b) || 0;
            return timeA - timeB;
        });
        
        while (currentMB > maxRAM_MB && sorted.length > 0) {
            const id = sorted.shift();
            
            // Protección: si es muy reciente, intentamos no borrarlo a menos que no haya otra opción
            const lastUsed = _last_used_chats.get(id) || 0;
            if (now - lastUsed < PERIODO_PROTECCION_MS && sorted.length > 0) {
                // Si aún tenemos más candidatos en la lista sorted, movemos este al final y probamos con el siguiente
                sorted.push(id);
                continue;
            }

            _cache_chats.delete(id);
            currentMB = _estimar_tamano_mb(Array.from(_cache_chats.values()));
        }
    }
}

let _timer_persistencia = null;
async function _gestionar_persistencia_frecuentes() {
    if (_timer_persistencia) return;
    
    _timer_persistencia = setTimeout(async () => {
        try {
            const { forceDisk, limitDisk } = await _obtener_limite_actual();
            const persistentLimitMB = forceDisk ? limitDisk : LIMITE_FRECUENTES_MB;

            const allChats = Array.from(_cache_chats.values());
            const sorted = allChats.sort((a, b) => {
                if ((b._frequency || 0) !== (a._frequency || 0)) {
                    return (b._frequency || 0) - (a._frequency || 0);
                }
                return (b._last_used || 0) - (a._last_used || 0);
            });
            
            const frecuentes = [];
            let currentMB = 0;
            
            for (const chat of sorted) {
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
            console.error("Error persistiendo chats frecuentes:", e);
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
    await _aplicar_limites_cache(); // Re-aplicar con los nuevos ajustes
    return true;
}

export async function clearCacheChats() {
    _cache_chats.clear();
    _frecuencia_chats.clear();
    _last_used_chats.clear();
    await saveCacheChatsFile([]);
}
