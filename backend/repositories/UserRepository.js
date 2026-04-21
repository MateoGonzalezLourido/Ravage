import { mongoose, createHash, randomBytes, compare } from '../utils/libs.js';
import { createLogger } from '../utils/logger.js';
import { User } from '../models/User.js';
import { ChatsRavage } from '../models/Chat.js';
import { TokenSession } from '../models/Security.js';
import { validateToken } from '../services/CreadorTokens.js';
import { encriptarDatosSistema, desencriptarDatosSistema, hashDatosSistema } from '../services/cryptoService.js';
import { getUsuarioDeCache, setUsuarioEnCache } from '../STORAGE/CACHE/_cache_usuarios.js';
import {
    getCorreoSesion, getUsuariosBloqueados, getUsuariosSilence, setUsuariosBloqueados, setUsuariosSilence,
    setFechaBloqueoContraseña, setFechaBloqueoCorreo, setFechaBloqueoApodo, setApodoSesion, setCorreoSesion,
    getIDMongodbUsuario, getInvisibleUsuario, setInvisibleUsuario, getMostrarCorreoUsuario, setMostrarCorreoUsuario
} from '../STORAGE/Variables_sesion.js';
import { convertirObjectId } from '../utils/conversores.js';

const log = createLogger('user-repo');

// --- HELPERS INTERNOS ---
const _getID = (id) => {
    const res = convertirObjectId(id);
    if (!res) return null;
    return (res && typeof res === 'object') ? (res.id || res._id || res.toString()) : res.toString();
};

const _syncCache = async (correoHash) => {
    const user = await User.findOne({ correo_hash: correoHash }).lean();
    if (user) await setUsuarioEnCache(procesarUsuario(user));
};

export function procesarUsuario(usuario) {
    if (!usuario) return null;
    
    // Asegurar que trabajamos con un objeto plano
    let result;
    if (typeof usuario.toObject === 'function') {
        result = usuario.toObject();
    } else {
        // Clonar para no mutar el original
        result = Array.isArray(usuario) ? [...usuario] : { ...usuario };
    }

    if (result.apodo && typeof result.apodo === 'object') {
        result.apodo = desencriptarDatosSistema(result.apodo);
    }
    if (result.correo && typeof result.correo === 'object') {
        result.correo = desencriptarDatosSistema(result.correo);
    }
    if (result.idamigo && typeof result.idamigo === 'object') {
        result.idamigo = desencriptarDatosSistema(result.idamigo);
    }

    if (result.chats && Array.isArray(result.chats)) {
        result.chats = result.chats.map(chat => ({
            ...chat,
            id: chat.id ? chat.id.toString() : (chat._id ? chat._id.toString() : null),
            ultimomensaje: chat.ultimomensaje ? desencriptarDatosSistema(chat.ultimomensaje) : ""
        }));
    }

    if (result.contactos && Array.isArray(result.contactos)) {
        result.contactos = result.contactos.map(c => ({
            ...c,
            id: c.id ? c.id.toString() : (c._id ? c._id.toString() : null),
            apodo: (c.apodo && typeof c.apodo === 'object') ? desencriptarDatosSistema(c.apodo) : (c.apodo || "")
        }));
    }

    if (result._id) {
        result.id = result._id.toString();
    }

    return result;
}

export async function LoginUsuarioDB({ correo = null, contrasena = null, token = null, id_dp = null, bloqueada = false }) {
    // Campos mínimos necesarios para el login y la inicialización de la sesión según sesionUsuario.js
    const LOGIN_FIELDS = "_id apodo correo createdAt exp_bloq_apodo exp_bloq_correo exp_bloq_contrasena users_silence users_bloq secretKey chats.id chats.ultimoCambio contactos.id contactos.apodo idamigo visible invisible mostrarCorreo";

    try {
        if (token && correo && id_dp) {
            const correoStr = correo.toString();
            const tokenStr = token.toString();
            const idDpStr = id_dp.toString();

            let token_valido = validateToken(tokenStr);
            if (!token_valido) {
                const tokenhash = createHash("sha256").update(tokenStr).digest("hex");
                await TokenSession.deleteMany({ correo_hash: hashDatosSistema(correoStr), token: tokenhash });
                return { success: false };
            }

            const tokenhash = createHash("sha256").update(tokenStr).digest("hex");
            const token_datos = await TokenSession.exists({ correo_hash: hashDatosSistema(correoStr), token: tokenhash, id_dp_hash: hashDatosSistema(idDpStr) });

            if (!token_datos) return { success: false };

            const correoHash = hashDatosSistema(correoStr);
            const usuario_datos = await User.findOne({ correo_hash: correoHash, bloqueada }).select(LOGIN_FIELDS).lean();
            if (!usuario_datos) return { success: false };

            return { success: true, data: procesarUsuario(usuario_datos) };
        }

        if (!correo || !contrasena) return { success: false };
        const correoStr = correo.toString();
        const contraseñaStr = contrasena.toString();

        const correoHash = hashDatosSistema(correoStr);
        // Al hacer login con contraseña, necesitamos el campo contrasena para comparar,
        // además de los campos necesarios para la sesión.
        const usuario_datos = await User.findOne({ correo_hash: correoHash, bloqueada }).lean()
            .select(`${LOGIN_FIELDS} contrasena`)
            .lean();

        if (!usuario_datos) return { success: false };

        const ok = await compare(contraseñaStr, usuario_datos.contrasena);
        if (!ok) return { success: false };

        return { success: true, data: procesarUsuario(usuario_datos) };
    } catch (e) {
        log.error(e);
        return { success: false };
    }
}

export async function InsertarUsuario({ apodo = "Usuario", contrasena, correo, secretKey, idamigo, publicKey = "" }) {
    try {
        const sKey = secretKey || randomBytes(32).toString("hex");
        const idAmigo = idamigo || randomBytes(5).toString("hex").toUpperCase();

        const correoHash = hashDatosSistema(correo);
        const idamigoHash = hashDatosSistema(idAmigo);

        await User.create({
            apodo: encriptarDatosSistema(apodo),
            correo: encriptarDatosSistema(correo),
            correo_hash: correoHash,
            contrasena: contrasena,
            secretKey: sKey,
            idamigo: encriptarDatosSistema(idAmigo),
            idamigo_hash: idamigoHash,
            publicKey: publicKey
        });
        return true;
    } catch (e) {
        log.error(e);
        return null;
    }
}
async function _toggleArrayUsuario(id, arrayType, isAdd) {
    const idStr = _getID(id);
    if (!idStr) return null;

    let getList, setList, field;
    if (arrayType === 'bloq') {
        getList = getUsuariosBloqueados;
        setList = setUsuariosBloqueados;
        field = 'users_bloq';
    } else {
        getList = getUsuariosSilence;
        setList = setUsuariosSilence;
        field = 'users_silence';
    }

    let list = getList();
    const index = list.findIndex(x => x.toString() === idStr);
    const exists = index !== -1;

    if (isAdd && exists) return false;
    if (!isAdd && !exists) return false;

    try {
        const correoHash = hashDatosSistema(getCorreoSesion());
        const updateOp = isAdd
            ? { $addToSet: { [field]: idStr } }
            : { $pull: { [field]: idStr } };

        if (isAdd && arrayType === 'bloq') {
            updateOp.$pull = { contactos: { id: idStr } };
        }

        const r = await User.updateOne({ correo_hash: correoHash }, updateOp);
        if (r.modifiedCount === 0 && r.matchedCount === 0) return false;

        if (isAdd) list.push(idStr);
        else list.splice(index, 1);

        setList(list);
        await _syncCache(correoHash);
        return true;
    } catch (e) {
        log.error(e);
        return null;
    }
}

export const añadirUsuariosBloqueados = (id) => _toggleArrayUsuario(id, 'bloq', true);
export const eliminarUsuariosBloqueados = (id) => _toggleArrayUsuario(id, 'bloq', false);

export async function cambiarContraseñaUsuario(contraseña) {
    const fecha_bloqueo = new Date(Date.now() + (48 * 60 * 20 * 1000));
    try {
        const correoHash = hashDatosSistema(getCorreoSesion());
        const r = await User.updateOne(
            { correo_hash: correoHash },
            { $set: { contrasena: contraseña, exp_bloq_contrasena: fecha_bloqueo } }
        );
        if (r.matchedCount === 0) return false;

        setFechaBloqueoContraseña(fecha_bloqueo);
        await _syncCache(correoHash);
        return true;
    } catch (e) {
        log.error(e);
        return null;
    }
}


export async function cambiarCorreoUsuario(correo) {
    const correo_viejo = getCorreoSesion();
    const fecha_bloqueo = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    try {
        const correo_viejo_hash = hashDatosSistema(correo_viejo);
        const correo_nuevo_hash = hashDatosSistema(correo);
        const r = await User.updateOne(
            { correo_hash: correo_viejo_hash },
            { $set: { correo: encriptarDatosSistema(correo), correo_hash: correo_nuevo_hash, exp_bloq_correo: fecha_bloqueo } }
        );
        if (r.matchedCount === 0) return false;

        await _syncCache(correo_nuevo_hash);
        setCorreoSesion(correo);
        setFechaBloqueoCorreo(fecha_bloqueo);
        return true;
    } catch (e) {
        log.error(e);
        return null;
    }
}


export async function cambiarApodoUsuario(apodo) {
    const apodoStr = String(apodo);
    const fecha_bloqueo = new Date(Date.now() + (24 * 60 * 60 * 1000));
    try {
        const correoHash = hashDatosSistema(getCorreoSesion());
        const r = await User.updateOne(
            { correo_hash: correoHash },
            { $set: { apodo: encriptarDatosSistema(apodoStr), exp_bloq_apodo: fecha_bloqueo } }
        );
        if (r.matchedCount === 0) return false;

        await _syncCache(correoHash);
        setApodoSesion(apodoStr);
        setFechaBloqueoApodo(fecha_bloqueo);
        return true;
    } catch (e) {
        log.error(e);
        return null;
    }
}


let session_cache_usuarios = new Map(); // Cache RAM de sesión (Persistente durante la sesión)
const MAX_SESSION_CACHE_MB = 50; // Límite de la caché de sesión

/**
 * Revisa la caché de sesión para borrar usuarios de más de 15 min 
 * o si se excede el límite de MB (borrando los más antiguos).
 */
export function REVISAR_LIMPIEZA_CACHE_SESION() {
    const ahora = Date.now();
    
    // 1. Borrar los que tengan más de 15 minutos
    let borradosTTL = 0;
    for (const [id, entry] of session_cache_usuarios.entries()) {
        if (ahora - entry.timestamp > 15 * 60 * 1000) {
            session_cache_usuarios.delete(id);
            borradosTTL++;
        }
    }
    if (borradosTTL > 0) log.debug({ borrados: borradosTTL }, "Caché sesión: Limpieza por TTL (15 min)");

    // 2. Controlar tamaño por MB
    const items = Array.from(session_cache_usuarios.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp); // De más antiguo a más nuevo
    
    let currentMB = 0;
    let borradosSize = 0;
    for (const [id, entry] of items) {
        const itemSize = JSON.stringify(entry.data).length * 2 / (1024 * 1024);
        if (currentMB + itemSize > MAX_SESSION_CACHE_MB) {
            session_cache_usuarios.delete(id);
            borradosSize++;
        } else {
            currentMB += itemSize;
        }
    }
    if (borradosSize > 0) log.debug({ borrados: borradosSize, currentMB: currentMB.toFixed(2) }, "Caché sesión: Limpieza por tamaño (50MB)");
}

function _faltan_datos(procesado, datos_usar) {
    if (!datos_usar) return false;
    const campos = datos_usar.split(" ");
    for (const c of campos) {
        if (c && procesado[c] === undefined) return true;
    }
    return false;
}

export async function ActualizarSecretKeyUsuario(actualizar = true) {
    const key = randomBytes(32).toString("hex");
    if (!actualizar) return key;
    try {
        const correoHash = hashDatosSistema(getCorreoSesion());
        const r = await User.updateOne({ correo_hash: correoHash }, { $set: { secretKey: key } });
        if (r.matchedCount === 0) return false;

        await _syncCache(correoHash);
        return key;
    } catch (e) {
        log.error(e);
        return null;
    }
}


export async function obtener_datos_usuario(id, datos_usar = null) {
    const idStr = _getID(id);
    if (!idStr) return null;

    const id_propio = getIDMongodbUsuario();
    const esMiPropioUsuario = id_propio && idStr === id_propio.toString();
    const ahora = Date.now();

    let useCache = false;
    let cachedEntry = session_cache_usuarios.get(idStr);

    if (cachedEntry) {
        const procesado = cachedEntry.data;
        if (!datos_usar && !esMiPropioUsuario) {
            useCache = true;
        } else if (datos_usar) {
            // TTL de 5 minutos para re-verificar mostrarCorreo e invisible
            if (ahora - cachedEntry.timestamp <= 5 * 60 * 1000) {
                // REVISIÓN: Si piden campos que no tenemos en caché, forzar consulta a DB
                if (!_faltan_datos(procesado, datos_usar)) {
                    log.debug({ id: idStr }, "Caché sesión: HIT (enviando a frontend)");
                    useCache = true;
                } else {
                    log.debug({ id: idStr }, "Caché sesión: MISS (faltan campos en RAM)");
                }
            }
        }
    }

    if (useCache) {
        // Clonamos para no mutar el objeto original de la caché y asegurar que el ID sea string para IPC
        const procesado = { ...cachedEntry.data };
        if (procesado._id) procesado.id = procesado._id.toString();
        
        // REVISIÓN: Si piden campos que no tenemos en caché, forzar consulta a DB
        if (!_faltan_datos(procesado, datos_usar)) {
            // Al entregarlo, lo eliminamos de la caché persistente (ahora vivirá en la activa del frontend)
            session_cache_usuarios.delete(idStr);

            if (!esMiPropioUsuario && procesado.mostrarCorreo === false) {
                const sinCorreo = { ...procesado };
                delete sinCorreo.correo;
                return sinCorreo;
            }
            return procesado;
        }
    }

    const datos_buscar = datos_usar || "correo apodo visible idamigo mostrarCorreo invisible";
    const usuario = await User.findById(idStr, datos_buscar).lean();
    if (!usuario) return null;

    const procesado = procesarUsuario(usuario);
    session_cache_usuarios.set(idStr, { data: procesado, timestamp: ahora });

    if (!esMiPropioUsuario && procesado.mostrarCorreo === false) {
        const sinCorreo = { ...procesado };
        delete sinCorreo.correo;
        return sinCorreo;
    }

    return procesado;
}


export async function obtener_varios_usuarios(ids, datos_usar = null) {
    log.info({ "ids": ids, "datos_usar": datos_usar }, "buscar datos usuarios")
    if (!Array.isArray(ids) || ids.length === 0) return [];

    // Cada vez que se piden varios (ej. al abrir un chat o virtualizar), revisamos limpieza
    REVISAR_LIMPIEZA_CACHE_SESION();

    const normalizedIds = ids.map(x => {
        if (x?.buffer) return new mongoose.Types.ObjectId(Buffer.from(Object.values(x.buffer)));
        return new mongoose.Types.ObjectId(x);
    }).filter(Boolean);

    const id_propio = getIDMongodbUsuario();
    const ahora = Date.now();
    let query_datos = datos_usar || "correo apodo visible idamigo mostrarCorreo invisible";

    const result = [];
    const missingIds = [];

    for (const nId of normalizedIds) {
        const idStr = nId.toString();
        const cachedEntry = session_cache_usuarios.get(idStr);
        let useCache = false;

        if (cachedEntry) {
            const procesado = cachedEntry.data;
            if (!datos_usar) {
                useCache = true;
            } else if (ahora - cachedEntry.timestamp <= 5 * 60 * 1000) {
                // REVISIÓN: Si no faltan datos, lo usamos
                if (!_faltan_datos(procesado, datos_usar)) {
                    log.debug({ id: idStr }, "Caché sesión: HIT múltiple (enviando a frontend)");
                    useCache = true;
                } else {
                    log.debug({ id: idStr }, "Caché sesión: MISS múltiple (faltan campos en RAM)");
                }
            }
        }

        if (useCache) {
            // Clonamos para asegurar que el ID sea string para el transporte IPC al frontend
            const procesado = { ...cachedEntry.data };
            if (procesado._id) procesado.id = procesado._id.toString();
            
            // REVISIÓN: Si no faltan datos, lo usamos
            if (!_faltan_datos(procesado, datos_usar)) {
                log.debug({ id: idStr }, "Caché sesión: HIT múltiple (enviando a frontend)");
                // Lo borramos de aquí porque va a pasar a la caché activa del frontend
                session_cache_usuarios.delete(idStr);

                if (idStr !== id_propio?.toString() && procesado.mostrarCorreo === false) {
                    const sinCorreo = { ...procesado };
                    delete sinCorreo.correo;
                    result.push(sinCorreo);
                } else {
                    result.push(procesado);
                }
                continue; // Encontrado íntegro en caché, pasar al siguiente
            }
        } else {
            // Antes de ir a DB, probar caché persistente (solo si no es búsqueda específica de campos sensibles)
            // [ELIMINADO: La caché persistente ahora es en RAM y se gestiona en session_cache_usuarios]
            missingIds.push(nId);
        }
    }

    if (missingIds.length === 0) return result;

    let usuarios_db = await User.find({ _id: { $in: missingIds } }, query_datos).lean();
    if (usuarios_db.length === 0) {
        query_datos="nombre";
        usuarios_db = await ChatsRavage.find({ _id: { $in: missingIds } }, query_datos).lean();
    }
    if (usuarios_db.length === 0) return result;

    for (const u of usuarios_db) {
        const procesado = procesarUsuario(u);
        const idStr = procesado.id || procesado._id?.toString();
        session_cache_usuarios.set(idStr, { data: procesado, timestamp: ahora });
        
        if (idStr !== id_propio?.toString() && procesado.mostrarCorreo === false) {
            const sinCorreo = { ...procesado };
            delete sinCorreo.correo;
            result.push(sinCorreo);
        } else {
            result.push(procesado);
        }
    }

    return result;
}

/**
 * Guarda una lista de usuarios en la caché persistente de sesión (Backend).
 * Se usa cuando el frontend limpia su caché activa al cambiar de chat.
 */
export function GUARDAR_USUARIOS_EN_PERSISTENTE(usuarios) {
    if (!Array.isArray(usuarios)) return;
    const ahora = Date.now();
    log.debug({ count: usuarios.length }, "Caché sesión: Recibiendo usuarios desde frontend");
    for (const u of usuarios) {
        const id = u.id || u._id?.toString();
        if (id) {
            // OPTIMIZACIÓN RAM: Para la caché persistente preferimos _id como Buffer/ObjectId
            // y eliminamos el string redundante 'id'.
            const paraCache = { ...u };
            if (paraCache._id && typeof paraCache._id === 'string') {
                try {
                    paraCache._id = new mongoose.Types.ObjectId(paraCache._id);
                } catch(e) {}
            }
            delete paraCache.id; // Ahorramos el espacio del string de 24 caracteres

            session_cache_usuarios.set(id, { data: paraCache, timestamp: ahora });
        }
    }
    REVISAR_LIMPIEZA_CACHE_SESION();
}


export async function encontrar_usuario(texto, correo = false) {
    try {
        const id_propio = getIDMongodbUsuario();
        const textoHash = hashDatosSistema(texto);

        // Intentar buscar en cache primero por hash (si lo guardamos)
        // Por ahora, buscaremos en cache por ID si tuviéramos un mapeo, 
        // pero User.findOne es eficiente con índice. 
        // Lo que sí haremos es guardar en cache una vez encontrado.

        const filtro = correo
            ? { correo_hash: textoHash, mostrarCorreo: true, visible: true, bloquearChatsNuevos: false, invisible: false }
            : { idamigo_hash: textoHash, visible: true, bloquearChatsNuevos: false, invisible: false };

        const id_propio_obj = mongoose.Types.ObjectId.isValid(id_propio) ? new mongoose.Types.ObjectId(id_propio) : null;
        if (id_propio_obj) {
            const mis_bloqueados = getUsuariosBloqueados() || [];
            const mis_bloqueados_ids = mis_bloqueados
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));

            filtro._id = { $nin: mis_bloqueados_ids };
            filtro.users_bloq = { $ne: id_propio_obj };
        }

        const usuario = await User.findOne(filtro, "_id apodo").lean();
        if (!usuario) return null;

        const usuarioProcesado = procesarUsuario(usuario);
        await setUsuarioEnCache(usuarioProcesado); // Guardar en cache al encontrarlo
        return { id: usuarioProcesado.id, nombre: usuarioProcesado.apodo };
    } catch (e) {
        log.error(e);
        return null;
    }
}


export async function AÑADIR_CONTACTO(id, nombre) {
    try {
        const idStr = _getID(id);
        if (!idStr) return false;

        const id_propio = getIDMongodbUsuario();
        const mis_bloqueados = getUsuariosBloqueados() || [];

        if (mis_bloqueados.some(b => b.toString() === idStr)) return false;

        const targetUser = await User.findById(idStr, "users_bloq").lean();
        if (targetUser && (targetUser.users_bloq || []).some(b => b.toString() === id_propio.toString())) return false;

        const r = await User.updateOne(
            { _id: id_propio, "contactos.id": { $ne: idStr } },
            { $push: { contactos: { id: idStr, apodo: encriptarDatosSistema(nombre) } } }
        );
        if (r.modifiedCount > 0) {
            await _syncCache(hashDatosSistema(getCorreoSesion()));
            return true;
        }
        return false;
    } catch (e) {
        log.error(e);
        return false;
    }
}


export const añadirUsuariosSilenciados = (id) => _toggleArrayUsuario(id, 'silence', true);
export const eliminarUsuariosSilenciados = (id) => _toggleArrayUsuario(id, 'silence', false);


async function _toggleBoolean(field, getter, setter) {
    const nuevoEstado = !getter();
    try {
        const correoHash = hashDatosSistema(getCorreoSesion());
        const r = await User.updateOne(
            { correo_hash: correoHash },
            { $set: { [field]: nuevoEstado } }
        );
        if (r.matchedCount === 0) return { success: false };

        setter(nuevoEstado);
        await _syncCache(correoHash);
        return { success: true, [field]: nuevoEstado };
    } catch (e) {
        log.error(e);
        return { success: false };
    }
}

export const toggleInvisibleUsuario = () => _toggleBoolean('invisible', getInvisibleUsuario, setInvisibleUsuario);
export const toggleMostrarCorreoUsuario = () => _toggleBoolean('mostrarCorreo', getMostrarCorreoUsuario, setMostrarCorreoUsuario);

/**
 * Obtiene la lista resumida de chats del usuario directamente de la DB.
 * Útil para asegurar sincronización cuando se crean o modifican chats.
 */
export async function obtenerChatsUsuarioDB() {
    try {
        const id_propio = getIDMongodbUsuario();
        if (!id_propio) return [];

        const usuario = await User.findById(id_propio, "chats").lean();
        if (!usuario || !usuario.chats) return [];

        const procesado = procesarUsuario(usuario);
        return procesado.chats.map(c => ({
            id: c.id.toString(),
            ultimoCambio: c.ultimoCambio instanceof Date ? c.ultimoCambio.toISOString() : c.ultimoCambio,
            ultimomensaje: c.ultimomensaje || "",
            silenciado: !!c.silenciado,
            bloqueado: !!c.bloqueado
        }));
    } catch (e) {
        log.error({ err: e }, "Error al obtener chats desde DB");
        return [];
    }
}
