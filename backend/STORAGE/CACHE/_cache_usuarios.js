import { createLogger } from '../../utils/logger.js';
const log = createLogger('cache-users');
import { readFileSession, saveCacheUsuariosFile, getAjustesAppFile, saveAjustesAppFile } from '../../services/controladorArchivos.js';
import { getRecommendedCacheStrategy, getSystemResources } from '../../utils/systemInfo.js';

let _cache_usuarios = new Map(); // Para RAM
let _frecuencia_usuarios = new Map(); // Tracking de uso
let _last_used_usuarios = new Map(); // Tracking de tiempo
const LIMITE_FRECUENTES_MB = 128;
const PERIODO_PROTECCION_MS = 5 * 60 * 1000;
let _cache_frecuentes_cargada = false;

/**
 * Estima el tamaño en bytes de un objeto de forma rápida (sin stringify).
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
    const bytes = _estimar_bytes_rapido(data);
    return bytes / (1024 * 1024);
}

function _minificar_usuario(u) {
    return {
        i: u._id || u.i,
        f: u._frequency || u.f || 1,
        t: u._last_used || u.t || Date.now(),
        n: u.apodo || u.n,
        h: u.idamigo || u.h,
        v: u.visible === undefined ? u.v : u.visible,
        p: u.publicKey || u.p,
        s: u.mostrarCorreo === undefined ? u.s : u.mostrarCorreo,
        b: u.bloquearChatsNuevos === undefined ? u.b : u.bloquearChatsNuevos
    };
}

function _desminificar_usuario(m) {
    return {
        _id: m.i,
        _frequency: m.f,
        _last_used: m.t,
        apodo: m.n,
        idamigo: m.h,
        visible: m.v,
        publicKey: m.p,
        mostrarCorreo: m.s,
        bloquearChatsNuevos: m.b
    };
}

/**
 * Inicializa la caché cargando los usuarios frecuentes desde disco si existen.
 */
async function _asegurar_inicio() {
    if (_cache_frecuentes_cargada) return;
    try {
        const { forceDisk, limitRAM } = await _obtener_limite_actual();
        const maxInitialMB = forceDisk ? 256 : Math.min(limitRAM, 512);

        const frecuentes_min = await readFileSession('cacheUsuariosFrecuentes', false) || [];
        let loadedMB = 0;

        for (const m of frecuentes_min) {
            const user = _desminificar_usuario(m);
            const size = _estimar_tamano_mb(user);
            if (loadedMB + size <= maxInitialMB) {
                _cache_usuarios.set(user._id.toString(), user);
                _frecuencia_usuarios.set(user._id.toString(), user._frequency);
                _last_used_usuarios.set(user._id.toString(), user._last_used);
                loadedMB += size;
            } else {
                break;
            }
        }
        _cache_frecuentes_cargada = true;
    } catch (e) {
        log.error({ err: e }, "Error al cargar usuarios frecuentes");
    }
}
async function _obtener_limite_actual() {
    const ajustes = await getAjustesAppFile();
    const recommended = await getRecommendedCacheStrategy();
    
    const forceDisk = ajustes.FORCE_DISK_CACHE || recommended.type === 'disk';
    const limitRAM = ajustes.LIMITE_USER_CACHE_RAM || recommended.sizeMB;
    const limitDisk = ajustes.LIMITE_USER_CACHE_DISK || 2048; 

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

export async function getUsuarioDeCache(id_usuario) {
    await _asegurar_inicio();
    const id = id_usuario.toString();
    if (_cache_usuarios.has(id)) {
        // En caso de CACHE HIT: suma +1 al contador
        const f = (_frecuencia_usuarios.get(id) || 0) + 1;
        _frecuencia_usuarios.set(id, f);
        _last_used_usuarios.set(id, Date.now());

        const user = _cache_usuarios.get(id);
        user._frequency = f;
        user._last_used = _last_used_usuarios.get(id);
        
        _gestionar_persistencia_frecuentes();
        return user;
    }
    return null;
}

export async function setUsuarioEnCache(user) {
    await _asegurar_inicio();
    if (!user || (!user._id && !user.id)) return;
    
    const id = (user._id || user.id).toString();
    // En caso de CACHE MISS / ACTUALIZACION: suma +1 al contador
    const f = (_frecuencia_usuarios.get(id) || 0) + 1;
    _frecuencia_usuarios.set(id, f);
    _last_used_usuarios.set(id, Date.now());

    user._frequency = f;
    user._last_used = _last_used_usuarios.get(id);
    
    _cache_usuarios.set(id, user);
    
    await _aplicar_limites_cache();
    _gestionar_persistencia_frecuentes();
}
async function _aplicar_limites_cache() {
    const { forceDisk, limitRAM, limitDisk } = await _obtener_limite_actual();
    const isRAMOk = await _verificar_recursos_sistema(limitRAM, 'ram');
    const isDiskOk = await _verificar_recursos_sistema(limitDisk, 'disk');
    
    const maxRAM_MB = forceDisk ? 256 : (isRAMOk ? limitRAM : 128);
    
    const allValues = Array.from(_cache_usuarios.values());
    let currentMB = _estimar_tamano_mb(allValues);
    
    if (currentMB > maxRAM_MB) {
        const now = Date.now();
        const keys = Array.from(_cache_usuarios.keys()).sort((a, b) => {
            const freqA = _frecuencia_usuarios.get(a) || 0;
            const freqB = _frecuencia_usuarios.get(b) || 0;
            if (freqA !== freqB) return freqA - freqB;
            const timeA = _last_used_usuarios.get(a) || 0;
            const timeB = _last_used_usuarios.get(b) || 0;
            return timeA - timeB;
        });
        
        for (const id of keys) {
            if (currentMB <= maxRAM_MB) break;

            const user = _cache_usuarios.get(id);
            if (!user) continue;

            const lastUsed = _last_used_usuarios.get(id) || 0;
            if (now - lastUsed < PERIODO_PROTECCION_MS && keys.length > 1) {
                continue;
            }

            const itemSize = _estimar_tamano_mb(user);
            _cache_usuarios.delete(id);
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
            const persistentLimitMB = forceDisk ? limitDisk : LIMITE_FRECUENTES_MB;

            const allUsers = Array.from(_cache_usuarios.values());
            const sorted = allUsers.sort((a, b) => {
                if ((b._frequency || 0) !== (a._frequency || 0)) {
                    return (b._frequency || 0) - (a._frequency || 0);
                }
                return (b._last_used || 0) - (a._last_used || 0);
            });
            
            const frecuentes = [];
            let currentMB = 0;
            
            for (const user of sorted) {
                const itemSize = _estimar_tamano_mb(user);
                if (currentMB + itemSize <= persistentLimitMB) {
                    frecuentes.push(_minificar_usuario(user));
                    currentMB += itemSize;
                } else {
                    break;
                }
            }
            
            await saveCacheUsuariosFile(frecuentes);
        } catch (e) {
            log.error({ err: e }, "Error persistiendo usuarios frecuentes");
        } finally {
            _timer_persistencia = null;
        }
    }, 15000); 
}

export async function setConfigCacheUsuarios({ limitRAM, limitDisk, forceDisk }) {
    const settings = {};
    if (limitRAM !== undefined) settings.LIMITE_USER_CACHE_RAM = limitRAM;
    if (limitDisk !== undefined) settings.LIMITE_USER_CACHE_DISK = limitDisk;
    if (forceDisk !== undefined) settings.FORCE_DISK_CACHE = forceDisk;
    
    await saveAjustesAppFile({ data: settings, create: false });
    await _aplicar_limites_cache();
    return true;
}

export async function clearCacheUsuarios() {
    _cache_usuarios.clear();
    _frecuencia_usuarios.clear();
    _last_used_usuarios.clear();
    await saveCacheUsuariosFile([]);
}
