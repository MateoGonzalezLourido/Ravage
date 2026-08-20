import { hash, compare, machineIdSync } from '../utils/libs.js';
import { hashDatosSistema, desencriptarDatosSistema, encriptarDatosSistema } from './cryptoService.js';


import { createLogger } from '../utils/logger.js';
const log = createLogger('usuario');
import { User } from '../models/User.js';
import { DatosCuentaVC } from '../models/Security.js';
import { InsertarDatosCuentaVC, BorrarDatosCuentaVC } from '../repositories/SecurityRepository.js';
import { cambiarContraseñaUsuario, cambiarCorreoUsuario, cambiarApodoUsuario } from '../repositories/UserRepository.js';
import {
    getCorreoSesion,
    getApodoSesion,
    setApodoSesion,
    setCorreoSesion
} from '../STORAGE/Variables_sesion.js';
import {
    CodigoCambiarDatosCuenta,
    ConfirmacionCambioContraseña,
    ConfirmacionCambioCorreo,
    ConfirmacionCambioApodo
} from './MENSAJERIA/Estructuras_correos.js';
import {
    generarCodigoVerificacion,
    enviarEmail,
    correoPermitido
} from './MENSAJERIA/Servicio_mensajeria_correo.js';
import {
    comprobaciones_Correo,
    comprobar_apodo,
    comprobarContrasenaValidaciones,
    comprobar_codigo_verificacion
} from './validadores.js';
import { cerrarSesionUsuario } from './sesionUsuario.js';



//cambios de datos de la cuenta
const n_intentos_codigo_validacion = 5;
let bloquear_accion = false

/**
 * Lee los intentos restantes guardados dentro del documento cifrado de DatosCuentaVC.
 * Mismo patrón que ValidationCode en sesionUsuario.js (parsedData.intentos).
 * Si el documento es antiguo o no tiene `data`, se asume el máximo de intentos.
 */
function leerDatosVC(code_db) {
    let parsedData = {};
    try {
        const data_desencriptada = code_db?.data ? desencriptarDatosSistema(code_db.data) : null;
        if (data_desencriptada) {
            parsedData = typeof data_desencriptada === 'string' ? JSON.parse(data_desencriptada) : data_desencriptada;
        }
    } catch (e) {
        log.warn({ err: e }, "No se pudo leer los datos del código de cambio de datos de cuenta");
        parsedData = {};
    }
    if (typeof parsedData.intentos !== 'number') {
        parsedData.intentos = n_intentos_codigo_validacion;
    }
    return parsedData;
}

/** Persiste (cifrados) los intentos restantes en el propio documento del código. */
async function guardarDatosVC(code_db_id, parsedData) {
    try {
        await DatosCuentaVC.updateOne({ _id: code_db_id }, { $set: { data: encriptarDatosSistema(parsedData) } });
    } catch (e) {
        log.error({ err: e }, "No se pudieron guardar los intentos del código de cambio de datos de cuenta");
    }
}

/**
 * Inserta el código de verificación y guarda dentro de él los intentos disponibles.
 * `InsertarDatosCuentaVC` no acepta `data`, así que se completa con un update sobre
 * el documento recién creado (el modelo ya está importado y se usa en este archivo).
 */
async function InsertarCodigoCambioDatos({ correo, code, id, tipo }) {
    const insertado = await InsertarDatosCuentaVC({ correo: correo, code: code, id: id, tipo: tipo });
    if (!insertado) return false;
    await DatosCuentaVC.updateOne(
        { correo_hash: hashDatosSistema(correo), code: code, tipo: tipo },
        { $set: { data: encriptarDatosSistema({ intentos: n_intentos_codigo_validacion }) } }
    );
    return true;
}

async function permitirCambioContraseñaUsuario(contraseña = null, contraseña_actual = null) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    try {
        const correo = getCorreoSesion()

        // Si no se proporciona contraseña, solo verificar si el usuario puede realizar la acción (bloqueo por tiempo)
        if (!contraseña) {
            const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo) });
            if (!data_usuario) {
                return { success: false, message: "Usuario no encontrado" };
            }
            if (data_usuario.exp_bloq_contrasena && new Date(data_usuario.exp_bloq_contrasena) >= new Date()) {
                return { success: false, message: "Tiempo de bloqueo no cumplido" };
            }
            return { success: true };
        }

        // Comprobar formato de la nueva contraseña
        let result = comprobarContrasenaValidaciones(contraseña);
        if (!result.success) {
            return { success: false, message: result.message };
        }

        // Verificar bloqueo y contraseña actual
        const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo) });
        if (!data_usuario) {
            return { success: false, message: "Usuario no encontrado" };
        }

        if (data_usuario.exp_bloq_contrasena && new Date(data_usuario.exp_bloq_contrasena) >= new Date()) {
            return { success: false, message: "Tiempo de bloqueo no cumplido" };
        }

        // Exigir la contraseña actual: sin esto, quien tuviera el dispositivo
        // desbloqueado y acceso al correo (o solo a la notificación del código)
        // podía cambiarla sin conocerla.
        if (!contraseña_actual) {
            return { success: false, message: "Debes introducir tu contraseña actual" };
        }
        const actual_correcta = await compare(contraseña_actual, data_usuario.contrasena);
        if (!actual_correcta) {
            return { success: false, message: "La contraseña actual no es correcta" };
        }

        const iguales = await compare(contraseña, data_usuario.contrasena);
        if (iguales) {
            return { success: false, message: "La contraseña es la misma" };
        }

        const apodo = getApodoSesion();
        const code_generado = String(generarCodigoVerificacion());
        const hashed_ValidationCode = await hash(code_generado);
        const { asunto, htmlContenido } = CodigoCambiarDatosCuenta({ apodo: apodo, codigo: code_generado, tipo: "contraseña" });

        const deviceId = String(machineIdSync());
        await InsertarCodigoCambioDatos({ correo: correo, code: hashed_ValidationCode, id: deviceId, tipo: "contraseña" });

        enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido });

        return { success: true };
    } finally {
        bloquear_accion = false;
    }
}

async function permitirCambioCorreoUsuario(correo = null) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    try {
        const correo_viejo = getCorreoSesion()

        // Si no se proporciona correo, solo verificar si el usuario puede realizar la acción
        if (!correo) {
            const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo_viejo) })
            if (!data_usuario) {
                return { success: false, message: "Usuario no encontrado" }
            }
            if (data_usuario.exp_bloq_correo && new Date(data_usuario.exp_bloq_correo) >= new Date()) {
                return { success: false, message: "Tiempo de bloqueo no cumplido" }
            }
            return { success: true }
        }

        // Comprobar formato del nuevo correo
        let result = comprobaciones_Correo(correo)
        if (!result.success) {
            return { success: false, message: result.message }
        }

        // Verificar bloqueo, correo actual y existencia del nuevo correo
        const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo_viejo) })
        if (!data_usuario) {
            return { success: false, message: "Usuario no encontrado" }
        }

        if (data_usuario.exp_bloq_correo && new Date(data_usuario.exp_bloq_correo) >= new Date()) {
            return { success: false, message: "Tiempo de bloqueo no cumplido" }
        }

        if (desencriptarDatosSistema(data_usuario.correo) == correo) {
            return { success: false, message: "El correo es el mismo" }
        }

        const data_usuario2 = await User.exists({ correo_hash: hashDatosSistema(correo) })
        if (data_usuario2) {
            return { success: false, message: "Usuario ya existente" }
        }

        const apodo = getApodoSesion()
        const code_generado = String(generarCodigoVerificacion())
        const hashed_ValidationCode = await hash(code_generado)
        const { asunto, htmlContenido } = CodigoCambiarDatosCuenta({ apodo: apodo, codigo: code_generado, tipo: "correo" })

        const deviceId = String(machineIdSync());
        await InsertarCodigoCambioDatos({ correo: correo_viejo, code: hashed_ValidationCode, id: deviceId, tipo: "correo" })

        enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })

        return { success: true }
    } finally {
        bloquear_accion = false
    }
}
async function permitirCambioApodoUsuario(apodo = null) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    try {
        const correo = getCorreoSesion()
        // Si no se proporciona apodo, solo verificar si el usuario puede realizar la acción
        if (!apodo) {
            const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo) })

            if (!data_usuario) {
                return { success: false, message: "Usuario no encontrado" }
            }
            if (data_usuario.exp_bloq_apodo && new Date(data_usuario.exp_bloq_apodo) >= new Date()) {
                return { success: false, message: "Tiempo de bloqueo no cumplido" }
            }
            return { success: true }
        }

        // Comprobar formato del nuevo apodo
        let result = comprobar_apodo(apodo)
        if (!result.success) {
            return { success: false, message: result.message }
        }

        // Verificar bloqueo y apodo actual
        const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo) })
        if (!data_usuario) {
            return { success: false, message: "Usuario no encontrado" }
        }

        if (data_usuario.exp_bloq_apodo && new Date(data_usuario.exp_bloq_apodo) >= new Date()) {
            return { success: false, message: "Tiempo de bloqueo no cumplido" }
        }

        if (desencriptarDatosSistema(data_usuario.apodo) == apodo) {
            return { success: false, message: "El apodo es el mismo" }
        }

        // En este no se manda correo de verificación
        return { success: true }
    } finally {
        bloquear_accion = false
    }
}
async function ValidarCodeCambioDatosCuenta({ data, code = "", tipo = "" }) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    try {
        const correo = getCorreoSesion()
        // Hash del código tal y como está guardado en DB (lo necesita BorrarDatosCuentaVC)
        let code_hash_db = null
        if (tipo != "apodo") {
            //mirar si es codigo valido
            const VCodigo = comprobar_codigo_verificacion(code)
            if (!VCodigo.success) {
                return { success: false, message: VCodigo.message }
            }
            //cojer el ultimo codigo generado
            let code_db = await DatosCuentaVC.findOne({ correo_hash: hashDatosSistema(correo), tipo: tipo }).sort({ expira: -1 }).lean();
            if (!code_db) {
                return { success: false, message: "Fallo al cambiar datos: no hay codigos" };
            }
            code_hash_db = code_db.code

            // Los intentos viven dentro del propio documento cifrado (mismo patrón que ValidationCode)
            let parsedData = leerDatosVC(code_db)
            let intentos = parsedData.intentos

            //verificar si ya habia acabado los intentos
            if (intentos <= 0) {
                await BorrarDatosCuentaVC(correo, code_hash_db)
                return { success: false, message: "Fallo al cambiar datos: intentos acabados" }
            }

            const deviceId = String(machineIdSync());
            const id_dp_desencriptado = desencriptarDatosSistema(code_db.id_dp);

            if (deviceId !== id_dp_desencriptado && (id_dp_desencriptado != "")) {
                return { success: false, message: "Fallo al cambiar datos: este codigo no pertenece a este dispositivo" };
            }
            //comparar codigo de usuario con el de mongodb
            const ok = await compare(String(code), code_db.code);
            if (!ok) {//no son iguales
                intentos--
                if (intentos <= 0) {
                    await BorrarDatosCuentaVC(correo, code_hash_db)
                    return { success: false, message: "Fallo al cambiar datos: intentos acabados", intentos: 0 }
                }
                parsedData.intentos = intentos
                await guardarDatosVC(code_db._id, parsedData)
                log.warn(`Código incorrecto, intentos restantes: ${intentos}`)
                return { success: false, message: "Fallo al cambiar datos: codigo incorrecto", intentos: intentos };
            };
        }
        //crear nueva cuenta de usuario
        if (tipo === "contraseña") {
            const contraseña_hashed = await hash(data)
            const nuevoUsuario = await cambiarContraseñaUsuario(contraseña_hashed);
            if (!nuevoUsuario) {//error
                return { success: false, message: "Fallo al cambiar contraseña" }
            }
            await BorrarDatosCuentaVC(correo, code_hash_db)//borrar codigos
            //cerrar sesion
            await cerrarSesionUsuario(correo)
        }
        else if (tipo === "correo") {
            const nuevoUsuario = await cambiarCorreoUsuario(data);
            if (!nuevoUsuario) {//error
                return { success: false, message: "Fallo al cambiar correo" }
            }
            setCorreoSesion(data)
            await BorrarDatosCuentaVC(correo, code_hash_db)//borrar codigos
        }
        else if (tipo === "apodo") {
            const nuevoUsuario = await cambiarApodoUsuario(data);
            if (!nuevoUsuario) {//error
                return { success: false, message: "Fallo al cambiar apodo" }
            }
            setApodoSesion(data)
        }

        //mandar correo confirmando el cambio de datos
        const apodo = getApodoSesion()
        let asunto, htmlContenido
        if (tipo == "contraseña") {
            ({ asunto, htmlContenido } = ConfirmacionCambioContraseña({ apodo: apodo }))
        }
        else if (tipo == "correo") {
            ({ asunto, htmlContenido } = ConfirmacionCambioCorreo({ apodo: apodo }))
        }
        else if (tipo == "apodo") {
            ({ asunto, htmlContenido } = ConfirmacionCambioApodo({ apodo: apodo }))
        }
        else {
            asunto = "Confirmación Cambio Datos Cuenta"
            htmlContenido = ""
        }
        const claveCorreo = tipo === 'contraseña' ? 'CORREO_CAMBIO_CONTRASEÑA' : tipo === 'correo' ? 'CORREO_CAMBIO_CORREO' : tipo === 'apodo' ? 'CORREO_CAMBIO_APODO' : null;
        if (!claveCorreo || await correoPermitido(claveCorreo)) {
            enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido });
        }
        return { success: true };
    } finally {
        bloquear_accion = false
    }
}

export {
    permitirCambioContraseñaUsuario,
    ValidarCodeCambioDatosCuenta,
    permitirCambioCorreoUsuario,
    permitirCambioApodoUsuario
};
