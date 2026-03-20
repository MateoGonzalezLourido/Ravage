import { User } from '../models/User.js';
import { ValidationCode, CuentaValidationCode, TokenVC, TokenSession, TokenDPC, DispositivosBloqueados } from '../models/Security.js';
import { LoginUsuarioDB, InsertarUsuario } from '../repositories/UserRepository.js';
import { InsertarVC, BorrarVC, InsertarCuentaVC, BorrarCuentaVC, LimpiarJWTUsuario, AñadirJWTUsuario, AñadirJWTUsuarioVC, LimpiarJWTUsuarioVC, BuscarVC, BuscarCuentaVC } from '../repositories/SecurityRepository.js';
import {
    saveSessionFile,
    clearFileSession,
    saveOmitirVerificacionCuentaFile,
    readFileSession,
    limpiarArchivosCompleto,
    saveIdentityFile
} from './controladorArchivos.js';
import { enviarEmail, generarCodigoVerificacion } from './MENSAJERIA/Servicio_mensajeria_correo.js';
import {
    ValidarCorreoEstructura,
    ConfirmacionCuentaCreadaEstructura,
    ValidarCuentaUsuario,
    ConfirmacionInicioSesion
} from './MENSAJERIA/Estructuras_correos.js';
import { generarteToken, validateToken } from './CreadorTokens.js';
import * as storage from '../STORAGE/Variables_sesion.js';
import { hash, createHash, machineIdSync } from '../utils/libs.js';
import { generarLlavesRSA } from './cryptoService.js';
import {comprobar_contraseña_cuenta,
    comprobarContrasenaValidaciones,
    comprobar_apodo,
    comprobaciones_Correo} from './validadores.js'
const saltos_contraseña = Number(process.env.SALTOS_ENCRIPTAR_CONTRASENA)
//vairables de usuario de sesion
function ACTUALIZAR_DATOS_LOGIN({ data, limpiar = false }) {
    storage.setIDMongodbUsuario(!limpiar ? String(data._id) : null);
    storage.setApodoSesion(!limpiar ? data.apodo : null);
    storage.setCorreoSesion(!limpiar ? data.correo : null);
    storage.setFechaCreacionCuenta(!limpiar ? data.createdAt : null)
    storage.setFechaBloqueoApodo(!limpiar ? data.exp_bloq_apodo : null)
    storage.setFechaBloqueoCorreo(!limpiar ? data.exp_bloq_correo : null)
    storage.setFechaBloqueoContraseña(!limpiar ? data.exp_bloq_contrasena : null)
    storage.setUsuariosSilence(!limpiar ? data.users_silence : []);
    storage.setUsuariosBloqueados(!limpiar ? data.users_bloq : []);
    storage.setIdDispositivo(!limpiar ? String(machineIdSync()) : null)
    storage.setSecretKEY(!limpiar ? data.secretKey : null)
    storage.setListaChats(
        !limpiar
            ? data.chats.map(c => ({
                id: c.id.toString(),          // ObjectId -> string
                apodo: c.apodo || "",         // evitar undefined
                grupo: !!c.grupo,             // boolean
                ultimoCambio: new Date(c.ultimoCambio).toISOString() // Date -> string ISO
            }))
            : []
    );
    storage.setListaContactos(
        !limpiar
            ? data.contactos.map(c => ({
                id: c.id.toString(),          // ObjectId -> string
                apodo: c.apodo || "",         // evitar undefined
            }))
            : []
    );
    storage.setIDAmigo(!limpiar ? data.idamigo : false)
    storage.setVisibleUsuario(!limpiar ? data.visible : false)
}
async function autoLoginUsuario() {
    // Leer fichero con datos de sesion anterior
    const data = await readFileSession('sessionFile');
    
    // Verificar si estan todos los datos
    if (!data || !data.username || !data.token) {
        return { success: false }; 
    }
    
    const username = String(data.username);
    const token = String(data.token);

    // Comprobacion inicial de si es un correo
    if (!comprobaciones_Correo(username).success) {
        await clearFileSession('sessionFile'); 
        return { success: false };
    }

    // Comprobar si este dispositivo no esta bloqueado
    const deviceId = String(machineIdSync());
    const dp_bloqueado_db = await DispositivosBloqueados.exists({ correo: username, id_dp: deviceId });
    if (dp_bloqueado_db) {
        await limpiarArchivosCompleto();
        return { success: false, message: 'ESTE DISPOSITIVO TIENE EL ACCESO BLOQUEADO A ESTA CUENTA' };
    }

    // Verificar si esa cuenta sigue existiendo y el token es válido
    const usuario_datos = await LoginUsuarioDB({ correo: username, token: token, id_dp: deviceId });

    if (usuario_datos.success && usuario_datos.data) {
        ACTUALIZAR_DATOS_LOGIN({ data: usuario_datos.data });
        console.log("*Autologin correcto");
        return { success: true };
    } else {
        await LimpiarJWTUsuario(username, token);
        await clearFileSession('sessionFile');
        console.error("Error en auto login: token no válido o usuario inexistente");
        return { success: false };
    }
}

//variables importantes para unir funciones log o reg con su validacion por correo
// Eliminadas variables globales por seguridad y concurrencia.
// Se usa el campo 'data' en los modelos de códigos de validación.

const n_intentos_codigo_validacion = 5;

async function registerUsuario({ apodo = "Usuario", correo = null, password = null }) {
    const correoStr = String(correo).toLowerCase();
    const passwordStr = String(password);
    const apodoStr = String(apodo);

    //comprobacion inicial de si es un correo
    const resultado = comprobaciones_Correo(correoStr)
    if (!resultado.success) {
        return { success: false, message: resultado.message }
    }
    //verificar si no existe un usuario igual
    const existe = await User.exists({ correo: correoStr });
    if (existe) {
        return { success: false, message: "Correo ya registrado" };
    }
    
    const apodo_valido = comprobar_apodo(apodoStr)
    if (!apodo_valido.success) {
        return { success: false, message: apodo_valido.message }
    }

    // Generar hash de contraseña y llaves de identidad
    const pass_hashed = await hash(passwordStr, saltos_contraseña);
    const keys = generarLlavesRSA();

    //crear verificacion por codigo de correo
    const code_generado = String(generarCodigoVerificacion())
    //generar correo
    const { asunto, htmlContenido } = ValidarCorreoEstructura({ apodo: apodoStr, code: code_generado })
    
    //insertar codigo en mongodb con la data necesaria para completar el registro después
    const deviceId = String(machineIdSync()); 
    await InsertarVC({ 
        correo: correoStr, 
        code: code_generado, 
        id: deviceId,
        data: {
            passwordHash: pass_hashed,
            apodo: apodoStr,
            publicKey: keys.publicKey,
            privateKey: keys.privateKey,
            intentos: n_intentos_codigo_validacion
        }
    });

    //enviar correo
    enviarEmail({ correoDestino: correoStr, asunto: asunto, htmlContenido: htmlContenido })

    return { success: true }
}

async function ValidarCodeRegistroUsuario({ correo, code = "" }) {
    const codeStr = String(code);
    const correoStr = String(correo);
    const deviceId = String(machineIdSync()); 

    //mirar si es codigo valido (estructura)
    const VCodigo = comprobar_codigo_verificacion(codeStr)
    if (!VCodigo.success) {
        return { success: false, message: VCodigo.message }
    }

    // Buscar el código en la DB
    const code_db = await BuscarVC(correoStr, codeStr, deviceId);
    if (!code_db) {
        return { success: false, message: "Fallo al crear el usuario: no existe ese código o ha expirado" };
    }

    let { intentos, passwordHash, apodo, publicKey, privateKey } = code_db.data;

    if (intentos <= 0) {
        await BorrarVC(correoStr);
        return { success: false, message: "Fallo al crear el usuario: intentos acabados" }
    }

    // La comparación del hash del código ya se hace en BuscarVC (el repositorio genera el hash para la query)
    // Si llegamos aquí, el código es correcto porque BuscarVC lo encontró.

    //crear nueva cuenta de usuario
    const nuevoUsuario = await InsertarUsuario({ 
        apodo: apodo, 
        contraseña: passwordHash, 
        correo: correoStr,
        publicKey: publicKey || ""
    });

    if (!nuevoUsuario) {
        // Decrementar intentos si hubo un error al insertar (aunque es poco probable por el código)
        intentos--;
        if (intentos <= 0) {
            await BorrarVC(correoStr);
            return { success: false, message: "Fallo al crear el usuario: intentos acabados" }
        }
        await ValidationCode.updateOne({ _id: code_db._id }, { $set: { "data.intentos": intentos } });
        return { success: false, message: "Fallo al crear el usuario" }
    }

    //guardar llave privada localmente
    if (privateKey) {
        await saveIdentityFile({ privateKey: privateKey });
    }

    //mandar correo confirmando creacion de cuenta
    const { asunto, htmlContenido } = ConfirmacionCuentaCreadaEstructura({ apodo: apodo_usuario })
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    //limpiar datos 
    BorrarVC(correoStr)
    apodo_usuario = null;
    contraseña_hashed = null;
    identity_keys = null;
    bloquear_accion = false
    return { success: true };
}

async function loginUsuario({ username, contraseña, mantener_sesion_iniciada = true }) {
    const usernameStr = String(username).toLowerCase();
    const contraseñaStr = String(contraseña);

    //comprobacion inicial de si es un correo
    const resultado = comprobaciones_Correo(usernameStr)
    if (!resultado.success) {
        return { success: false, message: resultado.message }
    }
    //comprobar si este dp no esta bloqueado
    const deviceId = String(machineIdSync());
    const dp_bloqueado_db = await DispositivosBloqueados.exists({ correo: usernameStr, id_dp: deviceId })
    if (dp_bloqueado_db) {
        return { success: false, message: 'ESTE DISPOSITIVO TIENE EL ACCESO BLOQUEADO A ESTA CUENTA' }
    }
    //iniciar sesion
    const usuario_data = await LoginUsuarioDB({ correo: usernameStr, contraseña: contraseñaStr })
    if (!usuario_data || !usuario_data.success) {
        await clearFileSession('sessionFile');
        return { success: false, message: 'Usuario no encontrado' }
    }
    //dispositivo confianza
    const dp_confianza_data = await readFileSession('dispositivoConfianza')
    let dp_confianza = false
    if (!dp_confianza_data || (dp_confianza_data != "" && !validateToken(dp_confianza_data.token))) {
        await clearFileSession('dispositivoConfianza');
    }
    else {
        const tokenhash = createHash("sha256").update(dp_confianza_data.token).digest("hex");
        dp_confianza = await TokenDPC.exists({ correo: username, token: tokenhash, id_dp: deviceId })
    }
    //autovalidacion del codigo de verificacion de cuenta por token
    const data_autoverificacion = !dp_confianza ? await readFileSession("omitirVerificacionCuentaFile") : ""
    let autoverificacion = dp_confianza
    if (!dp_confianza && data_autoverificacion && (data_autoverificacion.token && data_autoverificacion.username)) {
        const valido = validateToken(data_autoverificacion.token)
        if (valido) {
            //validar token con mongodb
            const tokenhash = createHash("sha256").update(data_autoverificacion.token).digest("hex");
            const token_datos = await TokenVC.exists({ correo: usuario_data.data.correo, token: tokenhash, id_dp: deviceId })

            if (!token_datos) await clearFileSession('omitirVerificacionCuentaFile');
            else autoverificacion = true

        }
        else {//limpiar archivo y token
            await clearFileSession('omitirVerificacionCuentaFile');
            LimpiarJWTUsuarioVC(username, data_autoverificacion.token)
        }
    }
    //guardar correo en variables globales
    ACTUALIZAR_DATOS_LOGIN({ data: usuario_data.data });
    if (autoverificacion) {
        //JWT , mantener sesion iniciada en cache
        if (mantener_sesion_iniciada) {
            const token = await generarteToken('sesion');
            await saveSessionFile({ username: usuario_data.data.correo, token: token })
            await AñadirJWTUsuario(usuario_data.data.correo, token)
        }
        console.log("-Autoverificacion de cuenta")
    }
    else {
        //crear verificacion por codigo de correo
        const code_generado = String(generarCodigoVerificacion())
        const { asunto, htmlContenido } = ValidarCuentaUsuario({ apodo: usuario_data.data.apodo, code: code_generado })
        
        //insertar codigo en mongodb guardando si se quería mantener la sesión
        await InsertarCuentaVC({ 
            correo: usuario_data.data.correo, 
            code: code_generado, 
            id: deviceId,
            data: { 
                mantenerSesion: mantener_sesion_iniciada,
                intentos: n_intentos_codigo_validacion
            }
        });

        //mandar correo
        enviarEmail({ correoDestino: usuario_data.data.correo, asunto: asunto, htmlContenido: htmlContenido })
    }
    return { success: true, autoverificacion: autoverificacion }
}

async function ValidarCodeLogin({ correo, code }) {
    const deviceId = String(machineIdSync()); 

    //mirar si es codigo valido (estructura)
    const VCodigo = comprobar_codigo_verificacion(code)
    if (!VCodigo.success) {
        return { success: false, message: VCodigo.message }
    }

    // Buscar el código en la DB
    const code_db = await BuscarCuentaVC(correo, code, deviceId);
    if (!code_db) {
        ACTUALIZAR_DATOS_LOGIN({ limpiar: true })
        return { success: false, message: "Fallo al iniciar sesion: no existe ese código o ha expirado" };
    }

    let { intentos, mantenerSesion } = code_db.data;

    if (intentos <= 0) {
        ACTUALIZAR_DATOS_LOGIN({ limpiar: true })
        await BorrarCuentaVC(correo);
        return { success: false, message: "Fallo al iniciar sesion: intentos acabados" }
    }

    // Si llegamos aquí, el código es correcto porque BuscarCuentaVC lo encontró.

    //JWT , mantener sesion iniciada en cache
    if (mantenerSesion) {
        const token = await generarteToken('sesion');
        await saveSessionFile({ username: correo, token: token })
        await AñadirJWTUsuario(correo, token)
    }

    //guardar auto verificacion de cuenta en fichero local (omitir verificacion futura)
    const tokenVC = await generarteToken('cuenta');
    await saveOmitirVerificacionCuentaFile({ username: correo, token: tokenVC })
    await AñadirJWTUsuarioVC(correo, tokenVC)

    //borrar codigos
    await BorrarCuentaVC(correo)

    //mandar correo confirmando inicio de sesion
    const { asunto, htmlContenido } = ConfirmacionInicioSesion()
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    
    return { success: true };
}

async function cerrarSesionUsuario(correo) {
    //cojer datos del archivo de sesion para borrar el token
    const data = await readFileSession('sessionFile')
    //limpiar archivo de sesion
    await clearFileSession('sessionFile');
    //si existe ese archivo limpiar token
    if (data) LimpiarJWTUsuario(correo, data.token)//borrar jwt de DB
    //limpiar datos
    storage.setCorreoSesion(null)
    storage.setApodoSesion(null)
    //mostrar log

    //sesion cerrada
    console.warn("*Sesion cerrada")
    return true
}


export {
    registerUsuario,
    loginUsuario,
    autoLoginUsuario,
    cerrarSesionUsuario,
    ValidarCodeRegistroUsuario,
    ValidarCodeLogin,
    comprobaciones_Correo,
    comprobar_apodo,
    comprobar_codigo_verificacion
};
