import { createLogger } from '../utils/logger.js';
const log = createLogger('user-repo');
import { User } from '../models/User.js';
import { TokenSession } from '../models/Security.js';
import { compare, createHash, randomBytes, mongoose } from '../utils/libs.js';
import { validateToken } from '../services/CreadorTokens.js';
import { encriptarDatosSistema, desencriptarDatosSistema, hashDatosSistema } from '../services/cryptoService.js';
import { getUsuarioDeCache, setUsuarioEnCache } from '../STORAGE/CACHE/_cache_usuarios.js';

import { 
    getCorreoSesion, 
    getUsuariosBloqueados, 
    getUsuariosSilence, 
    setUsuariosBloqueados, 
    setUsuariosSilence,
    setFechaBloqueoContraseña,
    setFechaBloqueoCorreo,
    setFechaBloqueoApodo,
    setApodoSesion,
    setCorreoSesion,
    getIDMongodbUsuario,
    getInvisibleUsuario,
    setInvisibleUsuario,
    getMostrarCorreoUsuario,
    setMostrarCorreoUsuario
} from '../STORAGE/Variables_sesion.js';

/**
 * Helper para desencriptar un objeto de usuario de la DB.
 */
export function procesarUsuario(usuario) {
    if (!usuario) return null;
    const result = { ...usuario };
    
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
            ultimomensaje: chat.ultimomensaje ? desencriptarDatosSistema(chat.ultimomensaje) : ""
        }));
    }

    if (result.contactos && Array.isArray(result.contactos)) {
        result.contactos = result.contactos.map(c => ({
            ...c,
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
    const LOGIN_FIELDS = "_id apodo correo createdAt exp_bloq_apodo exp_bloq_correo exp_bloq_contrasena users_silence users_bloq secretKey chats.id chats.grupo chats.ultimoCambio contactos.id contactos.apodo idamigo visible invisible mostrarCorreo";

    try {
        if (token && correo && id_dp) {
            const correoStr = String(correo);
            const tokenStr = String(token);
            const idDpStr = String(id_dp);

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
        const correoStr = String(correo);
        const contraseñaStr = String(contrasena);

        const correoHash = hashDatosSistema(correoStr);
        // Al hacer login con contraseña, necesitamos el campo contrasena para comparar,
        // además de los campos necesarios para la sesión.
        const usuario_datos = await User.findOne({ correo_hash: correoHash, bloqueada })
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



export async function añadirUsuariosBloqueados(id) {
    const correo = getCorreoSesion();
    let lista_bloqueados = getUsuariosBloqueados(); // Esta lista ya debería tener solo IDs (strings o ObjectIds)
    const idStr = id.toString();
    
    if (lista_bloqueados.some(bid => bid.toString() === idStr)) return false;

    lista_bloqueados.push(new mongoose.Types.ObjectId(idStr));

    try {
        const correoHash = hashDatosSistema(correo);
        const r = await User.updateOne(
            { correo_hash: correoHash },
            { 
                $set: { users_bloq: lista_bloqueados },
                $pull: { contactos: { id: idStr } }
            }
        );
        if (r.matchedCount === 0) return false;
        setUsuariosBloqueados(lista_bloqueados);

        // Actualizar cache propia
        const updatedUser = await User.findOne({ correo_hash: correoHash }).lean();
        if (updatedUser) await setUsuarioEnCache(procesarUsuario(updatedUser));

        return true;
    } catch (e) {
        log.error(e);
        return null;
    }
}


export async function eliminarUsuariosBloqueados(id) {
    const correo = getCorreoSesion();
    let lista_bloqueados = getUsuariosBloqueados();
    const idStr = id.toString();
    const index = lista_bloqueados.findIndex(bid => bid.toString() === idStr);
    if (index === -1) return false;

    lista_bloqueados.splice(index, 1);
    try {
        const correoHash = hashDatosSistema(correo);
        const r = await User.updateOne(
            { correo_hash: correoHash },
            { $set: { users_bloq: lista_bloqueados } }
        );
        if (r.matchedCount === 0) return false;
        setUsuariosBloqueados(lista_bloqueados);

        // Actualizar cache propia
        const updatedUser = await User.findOne({ correo_hash: correoHash }).lean();
        if (updatedUser) await setUsuarioEnCache(procesarUsuario(updatedUser));

        return true;
    } catch (e) {
        log.error(e);
        return null;
    }
}

export async function cambiarContraseñaUsuario(contraseña) {
    const correo = getCorreoSesion();
    const fecha_bloqueo = new Date(Date.now() + (48 * 60 * 20 * 1000));
    try {
        const correoHash = hashDatosSistema(correo);
        const r = await User.updateOne(
            { correo_hash: correoHash },
            { $set: { contrasena: contraseña, exp_bloq_contrasena: fecha_bloqueo } }
        );
        if (r.matchedCount === 0) return false;
        setFechaBloqueoContraseña(fecha_bloqueo);

        // Actualizar cache
        const updatedUser = await User.findOne({ correo_hash: correoHash }).lean();
        if (updatedUser) await setUsuarioEnCache(procesarUsuario(updatedUser));

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

        // Actualizar cache
        const updatedUser = await User.findOne({ correo_hash: correo_nuevo_hash }).lean();
        if (updatedUser) await setUsuarioEnCache(procesarUsuario(updatedUser));

        setCorreoSesion(correo);
        setFechaBloqueoCorreo(fecha_bloqueo);
        return true;
    } catch (e) {
        log.error(e);
        return null;
    }
}


export async function cambiarApodoUsuario(apodo) {
    const correo = getCorreoSesion();
    const apodoStr = String(apodo);
    const fecha_bloqueo = new Date(Date.now() + (24 * 60 * 60 * 1000));
    try {
        const correoHash = hashDatosSistema(correo);
        const r = await User.updateOne(
            { correo_hash: correoHash },
            { $set: { apodo: encriptarDatosSistema(apodoStr), exp_bloq_apodo: fecha_bloqueo } }
        );
        if (r.matchedCount === 0) return false;

        // Actualizar cache
        const updatedUser = await User.findOne({ correo_hash: correoHash }).lean();
        if (updatedUser) await setUsuarioEnCache(procesarUsuario(updatedUser));

        setApodoSesion(apodoStr);
        setFechaBloqueoApodo(fecha_bloqueo);
        return true;
    } catch (e) {
        log.error(e);
        return null;
    }
}


export async function ActualizarSecretKeyUsuario(actualizar = true) {
    const key = randomBytes(32).toString("hex");
    if (!actualizar) return key;
    try {
        const correo = getCorreoSesion();
        const correoHash = hashDatosSistema(correo);
        const r = await User.updateOne({ correo_hash: correoHash }, { $set: { secretKey: key } });
        if (r.matchedCount === 0) return false;

        // Actualizar cache
        const updatedUser = await User.findOne({ correo_hash: correoHash }).lean();
        if (updatedUser) await setUsuarioEnCache(procesarUsuario(updatedUser));

        return key;
    } catch (e) {
        log.error(e);
        return null;
    }
}


export async function obtener_datos_usuario(id, datos_usar = null) {
    const idStr = id.toString();
    const id_propio = getIDMongodbUsuario();
    const esMiPropioUsuario = id_propio && idStr === id_propio.toString();

    if (!datos_usar && !esMiPropioUsuario) {
        const cached = await getUsuarioDeCache(idStr);
        if (cached) {
            // Ocultar correo si el usuario tiene mostrarCorreo: false
            if (cached.mostrarCorreo === false) {
                const sinCorreo = { ...cached };
                delete sinCorreo.correo;
                return sinCorreo;
            }
            return cached;
        }
    }

    const datos_buscar = datos_usar || "correo apodo visible idamigo mostrarCorreo";
    const usuario = await User.findById(id, datos_buscar).lean();
    if (!usuario) return null;
    
    const procesado = procesarUsuario(usuario);
    if (!datos_usar) {
        await setUsuarioEnCache(procesado);
    }

    // Ocultar correo para otros usuarios si mostrarCorreo es false
    if (!esMiPropioUsuario && procesado.mostrarCorreo === false) {
        const sinCorreo = { ...procesado };
        delete sinCorreo.correo;
        return sinCorreo;
    }

    return procesado;
}


export async function obtener_varios_usuarios(ids, datos_usar = null) {
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const id_propio = getIDMongodbUsuario();
    const query_datos = datos_usar || "correo apodo visible idamigo mostrarCorreo";
    
    // Buscar en DB todos los IDs
    const usuarios_db = await User.find({ _id: { $in: ids } }, query_datos).lean();
    
    const resultados = usuarios_db.map(u => {
        const procesado = procesarUsuario(u);
        const idStr = procesado.id || procesado._id?.toString();
        
        // Ocultar correo si no es el usuario propio y mostrarCorreo es false
        if (idStr !== id_propio?.toString() && procesado.mostrarCorreo === false) {
            const sinCorreo = { ...procesado };
            delete sinCorreo.correo;
            return sinCorreo;
        }
        return procesado;
    });

    return resultados;
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
        const id_propio = getIDMongodbUsuario();

        // Comprobar bloqueo bidireccional
        const mis_bloqueados = getUsuariosBloqueados() || [];
        if (mis_bloqueados.some(b => b.toString() === id.toString())) return false;

        const targetUser = await User.findById(id, "users_bloq").lean();
        if (targetUser && (targetUser.users_bloq || []).some(b => b.toString() === id_propio.toString())) return false;

        const r = await User.updateOne(
            { _id: id_propio, "contactos.id": { $ne: id } },
            { $push: { contactos: { id, apodo: encriptarDatosSistema(nombre) } } }
        );
        if (r.modifiedCount > 0) {
            // Actualizar cache propia por el cambio en contactos
            const correoHash = hashDatosSistema(getCorreoSesion());
            const updatedUser = await User.findOne({ correo_hash: correoHash }).lean();
            if (updatedUser) await setUsuarioEnCache(procesarUsuario(updatedUser));
            return true;
        }
        return false;
    } catch (e) {
        log.error(e);
        return false;
    }
}


export async function eliminarUsuariosSilenciados(id) {
    const correo = getCorreoSesion();
    const correoHash = hashDatosSistema(correo);
    let lista_silenciados = getUsuariosSilence();
    const idStr = id.toString();
    const index = lista_silenciados.findIndex(sid => sid.toString() === idStr);
    if (index === -1) return false;

    lista_silenciados.splice(index, 1);
    try {
        const r = await User.updateOne({ correo_hash: correoHash }, { $set: { users_silence: lista_silenciados } });
        if (r.matchedCount === 0) return false;
        setUsuariosSilence(lista_silenciados);

        // Actualizar cache propia
        const updatedUser = await User.findOne({ correo_hash: correoHash }).lean();
        if (updatedUser) await setUsuarioEnCache(procesarUsuario(updatedUser));

        return true;
    } catch (e) {
        log.error(e);
        return null;
    }
}


export async function añadirUsuariosSilenciados(id) {
    const correo = getCorreoSesion();
    const correoHash = hashDatosSistema(correo);
    let lista_silenciados = getUsuariosSilence();
    const idStr = id.toString();
    if (lista_silenciados.some(sid => sid.toString() === idStr)) return false;

    lista_silenciados.push(new mongoose.Types.ObjectId(idStr));
    try {
        const r = await User.updateOne({ correo_hash: correoHash }, { $set: { users_silence: lista_silenciados } });
        if (r.matchedCount === 0) return false;
        setUsuariosSilence(lista_silenciados);

        // Actualizar cache propia
        const updatedUser = await User.findOne({ correo_hash: correoHash }).lean();
        if (updatedUser) await setUsuarioEnCache(procesarUsuario(updatedUser));

        return true;
    } catch (e) {
        log.error(e);
        return null;
    }
}


export async function toggleInvisibleUsuario() {
    const correo = getCorreoSesion();
    const correoHash = hashDatosSistema(correo);
    const estadoActual = getInvisibleUsuario();
    const nuevoEstado = !estadoActual;
    try {
        const r = await User.updateOne(
            { correo_hash: correoHash },
            { $set: { invisible: nuevoEstado } }
        );
        if (r.matchedCount === 0) return { success: false };
        setInvisibleUsuario(nuevoEstado);

        // Actualizar cache
        const updatedUser = await User.findOne({ correo_hash: correoHash }).lean();
        if (updatedUser) await setUsuarioEnCache(procesarUsuario(updatedUser));

        return { success: true, invisible: nuevoEstado };
    } catch (e) {
        log.error(e);
        return { success: false };
    }
}


export async function toggleMostrarCorreoUsuario() {
    const correo = getCorreoSesion();
    const correoHash = hashDatosSistema(correo);
    const estadoActual = getMostrarCorreoUsuario();
    const nuevoEstado = !estadoActual;
    try {
        const r = await User.updateOne(
            { correo_hash: correoHash },
            { $set: { mostrarCorreo: nuevoEstado } }
        );
        if (r.matchedCount === 0) return { success: false };
        setMostrarCorreoUsuario(nuevoEstado);

        // Actualizar cache
        const updatedUser = await User.findOne({ correo_hash: correoHash }).lean();
        if (updatedUser) await setUsuarioEnCache(procesarUsuario(updatedUser));

        return { success: true, mostrarCorreo: nuevoEstado };
    } catch (e) {
        log.error(e);
        return { success: false };
    }
}

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
            grupo: !!c.grupo,
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
