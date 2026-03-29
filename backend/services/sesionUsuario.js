import { createLogger } from '../utils/logger.js';
const log = createLogger('session');
import { User } from '../models/User.js';
import { ValidationCode, TokenVC, TokenDPC, DispositivosBloqueados } from '../models/Security.js';
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
import { generarLlavesRSA, hashDatosSistema } from './cryptoService.js';
import { clearCacheChats } from '../STORAGE/CACHE/_cache_chats.js';
import { clearCacheUsuarios } from '../STORAGE/CACHE/_cache_usuarios.js';
import { clearCacheArchivosDescargados } from '../STORAGE/CACHE/_cache_archivos_descargados.js';
import { clearCacheUrlImgExtensiones } from '../STORAGE/CACHE/_cache_img_extensiones.js';

import {
    comprobarContrasenaValidaciones,
    comprobar_apodo,
    comprobaciones_Correo,
    comprobar_codigo_verificacion
} from './validadores.js'
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
    storage.setInvisibleUsuario(!limpiar ? data.invisible : false)
    storage.setMostrarCorreoUsuario(!limpiar ? data.mostrarCorreo : true)
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
    const dp_bloqueado_db = await DispositivosBloqueados.exists({ correo_hash: hashDatosSistema(username), id_dp_hash: hashDatosSistema(deviceId) });
    if (dp_bloqueado_db) {
        await limpiarArchivosCompleto();
        return { success: false, message: 'ESTE DISPOSITIVO TIENE EL ACCESO BLOQUEADO A ESTA CUENTA' };
    }

    // Verificar si esa cuenta sigue existiendo y el token es válido
    const usuario_datos = await LoginUsuarioDB({ correo: username, token: token, id_dp: deviceId });

    if (usuario_datos.success && usuario_datos.data) {
        ACTUALIZAR_DATOS_LOGIN({ data: usuario_datos.data });
        log.info("Autologin completado correctamente");
        return { success: true };
    } else {
        await LimpiarJWTUsuario(username, token);
        await clearFileSession('sessionFile');
        log.warn("Auto login fallido: token no válido o usuario inexistente");
        return { success: false };
    }
}

//variables importantes para unir funciones log o reg con su validacion por correo
// Eliminadas variables globales por seguridad y concurrencia.
// Se usa el campo 'data' en los modelos de códigos de validación.

const n_intentos_codigo_validacion = 5;

async function registerUsuario(mainWindow, { apodo = "Usuario", correo = null, password = null }) {
    //mostrar en html un icono de carga
    mainWindow.webContents.send("icono-cargando", true);

    const correoStr = String(correo).toLowerCase();
    const passwordStr = String(password);
    const apodoStr = String(apodo);

    try {
        const resCorreo = comprobaciones_Correo(correoStr);
        if (!resCorreo.success) throw new Error(resCorreo.message);

        const resApodo = comprobar_apodo(apodoStr);
        if (!resApodo.success) throw new Error(resApodo.message);

        const resPass = comprobarContrasenaValidaciones(passwordStr);
        if (!resPass.success) throw new Error(resPass.message);
    } catch (error) {
        mainWindow.webContents.send("icono-cargando", false);
        return { success: false, message: error.message };
    }

    //verificar si no existe un usuario igual
    const existe = await User.exists({ correo_hash: hashDatosSistema(correoStr) });
    if (existe) {
        mainWindow.webContents.send("icono-cargando", false);
        return { success: false, message: "Usuario ya registrado" };
    }

    mainWindow.webContents.send("icono-cargando", true);

    try {
        const [pass_hashed, keys] = await Promise.all([
            hash(passwordStr, saltos_contraseña),
            generarLlavesRSA()
        ]);

        const code_generado = String(generarCodigoVerificacion());
        const { asunto, htmlContenido } = ValidarCorreoEstructura({ apodo: apodoStr, code: code_generado });

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

        // El envío de email sigue siendo asíncrono "fire-and-forget" seguro
        enviarEmail({ correoDestino: correoStr, asunto: asunto, htmlContenido: htmlContenido });

        mainWindow.webContents.send("icono-cargando", false);
        return { success: true };
    } catch (e) {
        log.error({ err: e }, "Error en el proceso de registro");
        mainWindow.webContents.send("icono-cargando", false);
        mainWindow.webContents.send("fallo-correo-mandar");
        return { success: false, message: "Error interno al procesar el registro" };
    }
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

    let parsedData = typeof code_db.data === 'string' ? JSON.parse(code_db.data) : code_db.data;
    let { intentos, passwordHash, apodo, publicKey, privateKey } = parsedData;

    if (intentos <= 0) {
        await BorrarVC(correoStr);
        return { success: false, message: "Fallo al crear el usuario: intentos acabados" }
    }

    // La comparación del hash del código ya se hace en BuscarVC (el repositorio genera el hash para la query)
    // Si llegamos aquí, el código es correcto porque BuscarVC lo encontró.

    //crear nueva cuenta de usuario
    const nuevoUsuario = await InsertarUsuario({
        apodo: apodo,
        contrasena: passwordHash,
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

        parsedData.intentos = intentos;
        if (typeof code_db.data === 'string') {
            await ValidationCode.updateOne({ _id: code_db._id }, { $set: { data: parsedData } });
        } else {
            await ValidationCode.updateOne({ _id: code_db._id }, { $set: { "data.intentos": intentos } });
        }
        return { success: false, message: "Fallo al crear el usuario" }
    }

    await saveIdentityFile({ privateKey: privateKey, publicKey: publicKey });
    await BorrarVC(correoStr);

    // Mandar correo confirmando creación de cuenta (no bloqueante)
    const { asunto, htmlContenido } = ConfirmacionCuentaCreadaEstructura({ apodo: apodo });
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido });

    return { success: true };
}

async function loginUsuario(mainWindow, { username, contraseña, mantener_sesion_iniciada = true }) {
    //mostrar en html un icono de carga
    mainWindow.webContents.send("icono-cargando", true);

    const usernameStr = String(username).toLowerCase();
    const contraseñaStr = String(contraseña);

    try {
        const resultado = comprobaciones_Correo(usernameStr);
        if (!resultado.success) throw new Error(resultado.message);
        
        const password_valido = comprobarContrasenaValidaciones(contraseñaStr);
        if (!password_valido.success) throw new Error(password_valido.message);
    } catch (e) {
        mainWindow.webContents.send("icono-cargando", false);
        return { success: false, message: e.message };
    }

    const deviceId = String(machineIdSync());
    const usernameHash = hashDatosSistema(usernameStr);
    const deviceIdHash = hashDatosSistema(deviceId);

    // Lanzar operaciones I/O y de DB en paralelo para reducir tiempo total
    const dpConfianzaDataPromise = readFileSession('dispositivoConfianza').catch(() => null);
    const dataAutoverificacionPromise = readFileSession("omitirVerificacionCuentaFile").catch(() => null);

    const checkBloqueadoPromise = DispositivosBloqueados.exists({ 
        correo_hash: usernameHash, 
        id_dp_hash: deviceIdHash 
    });
    
    const loginPromise = LoginUsuarioDB({ correo: usernameStr, contrasena: contraseñaStr });

    // Esperar a que terminen las tareas principales simultáneamente
    const [dp_bloqueado_db, usuario_data, dp_confianza_data] = await Promise.all([
        checkBloqueadoPromise,
        loginPromise,
        dpConfianzaDataPromise
    ]);

    if (dp_bloqueado_db) {
        mainWindow.webContents.send("icono-cargando", false);
        return { success: false, message: 'ESTE DISPOSITIVO TIENE EL ACCESO BLOQUEADO A ESTA CUENTA' };
    }

    if (!usuario_data || !usuario_data.success) {
        clearFileSession('sessionFile').catch(e => log.error(e)); // sin await (background)
        mainWindow.webContents.send("icono-cargando", false);
        return { success: false, message: 'Usuario no encontrado' };
    }

    // Verificar dispositivo de confianza
    let dp_confianza = false;
    if (!dp_confianza_data || (dp_confianza_data !== "" && !validateToken(dp_confianza_data.token))) {
        clearFileSession('dispositivoConfianza').catch(e => log.error(e)); // background
    } else {
        const tokenhash = createHash("sha256").update(dp_confianza_data.token).digest("hex");
        dp_confianza = await TokenDPC.exists({ correo_hash: usernameHash, token: tokenhash, id_dp_hash: deviceIdHash });
    }

    // Autovalidacion del codigo de verificacion de cuenta por token
    let autoverificacion = dp_confianza;
    if (!dp_confianza) {
        const data_autoverificacion = await dataAutoverificacionPromise;
        if (data_autoverificacion && data_autoverificacion.token && data_autoverificacion.username) {
            if (validateToken(data_autoverificacion.token)) {
                const tokenhash = createHash("sha256").update(data_autoverificacion.token).digest("hex");
                const token_datos = await TokenVC.exists({ correo_hash: hashDatosSistema(usuario_data.data.correo), token: tokenhash, id_dp_hash: deviceIdHash });

                if (!token_datos) {
                    clearFileSession('omitirVerificacionCuentaFile').catch(e => log.error(e));
                } else {
                    autoverificacion = true;
                }
            } else {
                Promise.all([
                    clearFileSession('omitirVerificacionCuentaFile'),
                    LimpiarJWTUsuarioVC(usernameStr, data_autoverificacion.token)
                ]).catch(e => log.error(e));
            }
        }
    }

    // Guardar datos en memoria de manera síncrona
    ACTUALIZAR_DATOS_LOGIN({ data: usuario_data.data });

    if (autoverificacion) {
        // JWT, mantener sesion iniciada en cache (ejecutado en background)
        if (mantener_sesion_iniciada) {
            (async () => {
                const token = await generarteToken('sesion');
                await Promise.all([
                    saveSessionFile({ username: usuario_data.data.correo, token: token }),
                    AñadirJWTUsuario(usuario_data.data.correo, token)
                ]);
            })().catch(e => log.error(e));
        }
        log.info("Autoverificacion de cuenta completada");
    } else {
        (async () => {
            const code_generado = String(generarCodigoVerificacion());
            const { asunto, htmlContenido } = ValidarCuentaUsuario({ apodo: usuario_data.data.apodo, code: code_generado });

            await InsertarCuentaVC({
                correo: usuario_data.data.correo,
                code: code_generado,
                id: deviceId,
                data: {
                    mantenerSesion: mantener_sesion_iniciada,
                    intentos: n_intentos_codigo_validacion
                }
            });

            enviarEmail({ correoDestino: usuario_data.data.correo, asunto: asunto, htmlContenido: htmlContenido });
        })().catch(() => {
            mainWindow.webContents.send("fallo-correo-mandar");
        });
    }

    mainWindow.webContents.send("icono-cargando", false);
    return { success: true, autoverificacion: autoverificacion };
}

async function ValidarCodeLogin({ correo, code }) {
    const deviceId = String(machineIdSync());
    storage.setIdDispositivo(deviceId);

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

    let parsedData = typeof code_db.data === 'string' ? JSON.parse(code_db.data) : code_db.data;
    let { intentos, mantenerSesion } = parsedData;

    if (intentos <= 0) {
        ACTUALIZAR_DATOS_LOGIN({ limpiar: true });
        await BorrarCuentaVC(correo);
        return { success: false, message: "Fallo al iniciar sesion: intentos acabados" }
    }

    //JWT , mantener sesion iniciada en cache
    if (mantenerSesion) {
        const token = await generarteToken('sesion');
        await saveSessionFile({ username: correo, token: token });
        await AñadirJWTUsuario(correo, token)
    }

    //guardar auto verificacion de cuenta en fichero local (omitir verificacion futura)
    const tokenVC = await generarteToken('cuenta');
    await saveOmitirVerificacionCuentaFile({ username: correo, token: tokenVC });
    await AñadirJWTUsuarioVC(correo, tokenVC)

    //borrar codigos
    await BorrarCuentaVC(correo);

    //mandar correo confirmando inicio de sesion (no bloqueante)
    const { asunto, htmlContenido } = ConfirmacionInicioSesion();
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido });

    return { success: true };
}

async function cerrarSesionUsuario(correo) {
    const mainWindow = storage.getMainWindow();
    if (mainWindow) {
        mainWindow.webContents.send("cerrando-sesion", true);
    }
    ACTUALIZAR_DATOS_LOGIN({ limpiar: true });

    try {
        const data = await readFileSession('sessionFile').catch(() => null);

        //limpiar ficheros cache
        const arreglos = [
            clearFileSession('sessionFile'),
            clearCacheChats(),
            clearCacheUsuarios(),
            clearCacheArchivosDescargados(),
            clearCacheUrlImgExtensiones()
        ];

        if (data && data.token) {
            arreglos.push(LimpiarJWTUsuario(correo, data.token));
        }

        //si uno falla no rompe otros
        await Promise.allSettled(arreglos);

        log.info("Sesion cerrada y recursos liberados");
    } catch (error) {
        log.error({ err: error }, "Error en el cierre de sesión persistente");
    }

    if (mainWindow) {
        mainWindow.webContents.send("cerrando-sesion", false);
    }

    return true;
}


async function REGENERAR_IDENTIDAD_USUARIO() {
    try {
        const id_propio = storage.getIDMongodbUsuario();
        if (!id_propio) return false;

        const { generarLlavesRSA } = await import('./cryptoService.js');
        const keys = await generarLlavesRSA();

        // Actualizar en DB
        await User.updateOne({ _id: id_propio }, { $set: { publicKey: keys.publicKey } });

        // Guardar localmente
        await saveIdentityFile({ privateKey: keys.privateKey, publicKey: keys.publicKey });

        // Limpiar cache del usuario propio para que refresque la public key
        const { setUsuarioEnCache, getUsuarioDeCache } = await import('../STORAGE/CACHE/_cache_usuarios.js');
        const updatedUser = await User.findById(id_propio).lean();
        if (updatedUser) {
            const { procesarUsuario } = await import('../repositories/UserRepository.js');
            await setUsuarioEnCache(procesarUsuario(updatedUser));
        }

        log.warn("ATENCIÓN: Regenerando identidad E2EE completa. Esto romperá la lectura de mensajes antiguos en todos los chats existentes.");
        return true;
    } catch (e) {
        log.fatal({ err: e }, "Error crítico regenerando identidad");
        return false;
    }
}


export {
    registerUsuario,
    loginUsuario,
    autoLoginUsuario,
    cerrarSesionUsuario,
    ValidarCodeRegistroUsuario,
    ValidarCodeLogin,
    REGENERAR_IDENTIDAD_USUARIO
};
