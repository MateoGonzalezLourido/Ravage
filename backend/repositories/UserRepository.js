import { User, ActiveUser } from '../models/User.js';
import { TokenSession } from '../models/Security.js';
import { compare, createHash, randomBytes, mongoose } from '../utils/libs.js';
import { validateToken } from '../services/CreadorTokens.js';
import { 
    getIdDispositivo, 
    getCorreoSesion, 
    getUsuariosBloqueados, 
    getUsuariosSilence, 
    setUsuariosBloqueados, 
    setUsuariosSilence 
} from '../STORAGE/Variables_sesion.js';

export async function LoginUsuarioDB({ correo = null, contraseña = null, token = null, id_dp = null, bloqueada = false }) {
    try {
        if (token && correo && id_dp) {
            let token_valido = validateToken(token);
            if (!token_valido) {
                // Note: LimpiarJWTUsuario should be in SecurityRepository
                // We will import it or move it later. For now, let's keep the logic.
                const tokenhash = createHash("sha256").update(token).digest("hex");
                await TokenSession.deleteMany({ correo, token: tokenhash });
                return { success: false };
            }

            const tokenhash = createHash("sha256").update(token).digest("hex");
            const token_datos = await TokenSession.exists({ correo, token: tokenhash, id_dp });

            if (!token_datos) return { success: false };

            const usuario_datos = await User.findOne({ correo, bloqueada });
            if (!usuario_datos) return { success: false };
            
            return { success: true, data: usuario_datos };
        }

        if (!correo || !contraseña) return { success: false };

        const usuario_datos = await User.findOne({ correo, bloqueada });
        if (!usuario_datos) return { success: false };

        const ok = await compare(contraseña, usuario_datos.contrasena);
        if (!ok) return { success: false };

        return { success: true, data: usuario_datos };
    } catch (e) {
        console.error(e);
        return { success: false };
    }
}

export async function InsertarUsuario({ apodo = "Usuario", contraseña, correo, secretKey, idamigo }) {
    try {
        await User.create({
            apodo,
            correo,
            contrasena: contraseña,
            secretKey,
            idamigo
        });
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function ActualizarUsuarioActivo({ correo = null }) {
    if (!correo) return null;
    const deviceId = getIdDispositivo();
    try {
        return await ActiveUser.updateOne(
            { correo, id_dp: deviceId },
            { $set: { expira: new Date() } },
            { upsert: true }
        );
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function BorrarUsuarioActivo() {
    const deviceId = getIdDispositivo();
    await ActiveUser.deleteOne({ id_dp: deviceId });
}

export async function añadirUsuariosBloqueados(id, apodo) {
    const correo = getCorreoSesion();
    let lista_bloqueados = getUsuariosBloqueados();
    if (lista_bloqueados.some(sub => sub.includes(id))) return false;

    lista_bloqueados.push([id, apodo]);

    try {
        const r = await User.updateOne(
            { correo },
            { $set: { users_bloq: lista_bloqueados } }
        );
        if (r.matchedCount === 0) return false;
        setUsuariosBloqueados(lista_bloqueados);
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function eliminarUsuariosBloqueados(id) {
    const correo = getCorreoSesion();
    let lista_bloqueados = getUsuariosBloqueados();
    const index = lista_bloqueados.findIndex(sub => sub.includes(id));
    if (index === -1) return false;

    lista_bloqueados.splice(index, 1);
    try {
        const r = await User.updateOne(
            { correo },
            { $set: { users_bloq: lista_bloqueados } }
        );
        if (r.matchedCount === 0) return false;
        setUsuariosBloqueados(lista_bloqueados);
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}
export async function cambiarContraseñaUsuario(contraseña) {
    const correo = getCorreoSesion();
    const fecha_bloqueo = new Date(Date.now() + (48 * 60 * 20 * 1000));
    try {
        const r = await User.updateOne(
            { correo },
            { $set: { contrasena: contraseña, exp_bloq_contrasena: fecha_bloqueo } }
        );
        if (r.matchedCount === 0) return false;
        setFechaBloqueoContraseña(fecha_bloqueo);
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function cambiarCorreoUsuario(correo) {
    const correo_viejo = getCorreoSesion();
    const fecha_bloqueo = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    try {
        const r = await User.updateOne(
            { correo: correo_viejo },
            { $set: { correo, exp_bloq_correo: fecha_bloqueo } }
        );
        if (r.matchedCount === 0) return false;
        await BorrarUsuarioActivo();
        setCorreoSesion(correo);
        setFechaBloqueoCorreo(fecha_bloqueo);
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function cambiarApodoUsuario(apodo) {
    const correo = getCorreoSesion();
    const fecha_bloqueo = new Date(Date.now() + (24 * 60 * 20 * 1000));
    try {
        const r = await User.updateOne(
            { correo },
            { $set: { apodo, exp_bloq_apodo: fecha_bloqueo } }
        );
        if (r.matchedCount === 0) return false;
        setApodoSesion(apodo);
        setFechaBloqueoApodo(fecha_bloqueo);
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function ActualizarSecretKeyUsuario(actualizar = true) {
    const key = randomBytes(32).toString("hex");
    if (!actualizar) return key;
    try {
        const correo = getCorreoSesion();
        const r = await User.updateOne({ correo }, { $set: { secretKey: key } });
        if (r.matchedCount === 0) return false;
        return key;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function obtener_datos_usuario(id, datos_usar = null) {
    const datos_buscar = datos_usar || "correo apodo visible idamigo";
    const usuario = await User.findById(id, datos_buscar).lean();
    if (!usuario) return null;
    return { ...usuario, _id: usuario._id?.toString() };
}

export async function encontrar_usuario(texto, correo = false) {
    try {
        const id_propio = getIDMongodbUsuario();
        const filtro = correo
            ? { correo: texto, mostrarCorreo: true, visible: true, bloquearChatsNuevos: false }
            : { idamigo: texto, visible: true, bloquearChatsNuevos: false };

        const usuario = await User.findOne(filtro, "_id apodo users_bloq").lean();
        if (!usuario) return null;

        const isBloqueado = usuario.users_bloq.includes(id_propio) || getUsuariosBloqueados().includes(usuario._id.toString());
        if (isBloqueado) return null;

        return { id: usuario._id.toString(), nombre: usuario.apodo };
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function AÑADIR_CONTACTO(id, nombre) {
    try {
        const id_propio = getIDMongodbUsuario();
        const r = await User.updateOne(
            { _id: id_propio, "contactos.id": { $ne: id } },
            { $push: { contactos: { id, apodo: nombre } } }
        );
        return r.modifiedCount > 0;
    } catch (e) {
        console.error(e);
        return false;
    }
}

export async function eliminarUsuariosSilenciados(id) {
    const correo = getCorreoSesion();
    let lista_silenciados = getUsuariosSilence();
    const index = lista_silenciados.findIndex(sub => sub.includes(id));
    if (index === -1) return false;

    lista_silenciados.splice(index, 1);
    try {
        const r = await User.updateOne({ correo }, { $set: { users_silence: lista_silenciados } });
        if (r.matchedCount === 0) return false;
        setUsuariosSilence(lista_silenciados);
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function añadirUsuariosSilenciados(id, apodo) {
    const correo = getCorreoSesion();
    let lista_silenciados = getUsuariosSilence();
    if (lista_silenciados.some(sub => sub.includes(id))) return false;

    lista_silenciados.push([id, apodo]);
    try {
        const r = await User.updateOne({ correo }, { $set: { users_silence: lista_silenciados } });
        if (r.matchedCount === 0) return false;
        setUsuariosSilence(lista_silenciados);
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}
