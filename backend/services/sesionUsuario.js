import { createLogger } from '../utils/logger.js';
const log = createLogger('session');
import { User } from '../models/User.js';
import { ValidationCode, TokenVC, TokenDPC, DispositivosBloqueados } from '../models/Security.js';
import { LoginUsuarioDB, InsertarUsuario, procesarUsuario } from '../repositories/UserRepository.js';
import { InsertarVC, BorrarVC, InsertarCuentaVC, BorrarCuentaVC, LimpiarJWTUsuario, AñadirJWTUsuario, AñadirJWTUsuarioVC, LimpiarJWTUsuarioVC, BuscarVC, BuscarCuentaVC, AñadirJWTDPConfianza, LimpiarJWTDPConfianza, ObtenerSesionesPorCorreo, ObtenerDPConfianzasPorCorreo, RevocarSesionPorDispositivo, RevocarDPConfianzaPorDispositivo, ObtenerInfoSesionDispositivo, ObtenerInfoDPConfianzaDispositivo, BloquearDispositivo, DesbloquearDispositivo, ObtenerDPsBloqueadosPorCorreo } from '../repositories/SecurityRepository.js';
import {
    saveSessionFile,
    clearFileSession,
    saveOmitirVerificacionCuentaFile,
    saveDispositivoConfianzaFile,
    readFileSession,
    limpiarArchivosCompleto,
    saveIdentityFile
} from './controladorArchivos.js';
import { enviarEmail, generarCodigoVerificacion, correoPermitido } from './MENSAJERIA/Servicio_mensajeria_correo.js';
import {
    ValidarCorreoEstructura,
    ConfirmacionCuentaCreadaEstructura,
    ValidarCuentaUsuario,
    ConfirmacionInicioSesion,
    AvisoDispositivoConfianzaAnadido,
    AvisoDispositivoConfianzaRevocado,
    AvisoSesionCerrada,
    AvisoDispositivoBloqueado,
    AvisoDispositivoDesbloqueado
} from './MENSAJERIA/Estructuras_correos.js';
import { generarteToken, validateToken } from './CreadorTokens.js';
import * as storage from '../STORAGE/Variables_sesion.js';
import { hash, compare, createHash, machineIdSync, os, si } from '../utils/libs.js';
import { generarLlavesRSA, hashDatosSistema, getIdentity } from './cryptoService.js';

import { clearCacheUsuarios, setUsuarioEnCache } from '../repositories/UserRepository.js';
import { clearCacheArchivosDescargados } from '../STORAGE/CACHE/_cache_archivos_descargados.js';

import {
    comprobarContrasenaValidaciones,
    comprobar_apodo,
    comprobaciones_Correo,
    comprobar_codigo_verificacion
} from './validadores.js'

async function infoDispositivo() {
    try {
        const [sysInfo, osInfo, cpuInfo] = await Promise.all([si.system(), si.osInfo(), si.cpu()]);

        // SO: distro real + arquitectura (siempre disponible y útil)
        let osStr = (osInfo.distro || '').trim();
        if (!osStr) {
            const labels = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
            osStr = labels[os.platform()] || os.platform();
        }
        if (os.platform() === 'darwin' && osInfo.codename) osStr = `macOS ${osInfo.codename}`;
        const arch = osInfo.arch || process.arch;
        if (arch) osStr += ` · ${arch}`;

        // Nombre del dispositivo: fabricante+modelo primero, CPU como fallback
        const util = (s) => s && s.trim() &&
            !s.toLowerCase().includes('o.e.m') &&
            !s.toLowerCase().includes('to be filled') &&
            s !== 'System Product Name' && s !== 'None' && s !== '0';
        const mfr   = util(sysInfo.manufacturer) ? sysInfo.manufacturer.trim() : '';
        const model = util(sysInfo.model)         ? sysInfo.model.trim()         : '';
        let nombre = [mfr, model].filter(Boolean).join(' ');
        if (!nombre && cpuInfo?.brand) nombre = cpuInfo.brand.trim();

        return { os: osStr, nombre: nombre || null };
    } catch {
        const labels = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
        return { os: labels[os.platform()] || os.platform(), nombre: null };
    }
}

//variables de usuario de sesion
function ACTUALIZAR_DATOS_LOGIN({ data, limpiar = false, id_maquina = null }) {
    //cambiar nombre variables muy repetidas
    const lp = !limpiar
    const dt = data
    //actualizar variables de sesion
    storage.setIDMongodbUsuario(lp ? dt._id : null);
    storage.setApodoSesion(lp ? dt.apodo : null);
    storage.setCorreoSesion(lp ? dt.correo : null);
    storage.setFechaCreacionCuenta(lp ? dt.createdAt : null)
    storage.setFechaBloqueoApodo(lp ? dt.exp_bloq_apodo : null)
    storage.setFechaBloqueoCorreo(lp ? dt.exp_bloq_correo : null)
    storage.setFechaBloqueoContraseña(lp ? dt.exp_bloq_contrasena : null)
    storage.setUsuariosSilence(lp ? dt.users_silence : []);
    storage.setUsuariosBloqueados(lp ? dt.users_bloq : []);
    storage.setIdDispositivo(lp ? (id_maquina ? id_maquina : machineIdSync()) : null)
    storage.setSecretKEY(lp ? dt.secretKey : null)
    storage.setListaChats(lp ? dt.chats : []);
    storage.setListaContactos(lp ? dt.contactos : []);
    storage.setIDAmigo(lp ? dt.idamigo : false)
    storage.setVisibleUsuario(lp ? dt.visible : false)
    storage.setInvisibleUsuario(lp ? dt.invisible : false)
    storage.setMostrarCorreoUsuario(lp ? dt.mostrarCorreo : true)
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
        ACTUALIZAR_DATOS_LOGIN({ data: usuario_datos.data, id_maquina: deviceId });
        await asegurarIdentidadLocal();
        log.info("Autologin completado correctamente");
        return { success: true };
    } else {
        await Promise.all([
            LimpiarJWTUsuario(username, token),
            clearFileSession('sessionFile')
        ]);
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

    // Proceso pesado (hashing, RSA y DB) en background para respuesta inmediata
    ; (async () => {
        try {
            const [pass_hashed, keys] = await Promise.all([
                hash(passwordStr),
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

            enviarEmail({ correoDestino: correoStr, asunto: asunto, htmlContenido: htmlContenido });
        } catch (e) {
            log.error({ err: e }, "Error asíncrono en proceso de registro");
            mainWindow.webContents.send("fallo-correo-mandar");
        }
    })();

    mainWindow.webContents.send("icono-cargando", false);
    return { success: true };
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
        const encryptedData = encriptarDatosSistema(parsedData);
        await ValidationCode.updateOne({ _id: code_db._id }, { $set: { data: encryptedData } });
        return { success: false, message: "Fallo al crear el usuario" }
    }

    await Promise.all([
        saveIdentityFile({ privateKey: privateKey, publicKey: publicKey }),
        BorrarVC(correoStr)
    ]);
    ; (async () => {
        // Mandar correo confirmando creación de cuenta (no bloqueante)
        const { asunto, htmlContenido } = ConfirmacionCuentaCreadaEstructura({ apodo: apodo });
        enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido });
    })();
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
    ACTUALIZAR_DATOS_LOGIN({ data: usuario_data.data, id_maquina: deviceId });

    if (autoverificacion) {
        // JWT, mantener sesion iniciada en cache (ejecutado en background)
        if (mantener_sesion_iniciada) {
            (async () => {
                const [token, info] = await Promise.all([generarteToken('sesion'), infoDispositivo()]);
                await Promise.all([
                    saveSessionFile({ username: usuario_data.data.correo, token }),
                    AñadirJWTUsuario(usuario_data.data.correo, token, info)
                ]);
            })().catch(e => log.error(e));
        }
        await asegurarIdentidadLocal();
        log.info("Autoverificacion de cuenta completada");
    } else {
        ; (async () => {
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
        ACTUALIZAR_DATOS_LOGIN({ limpiar: true, id_maquina: deviceId })
        return { success: false, message: "Fallo al iniciar sesion: no existe ese código o ha expirado" };
    }

    let parsedData = typeof code_db.data === 'string' ? JSON.parse(code_db.data) : code_db.data;
    let { intentos, mantenerSesion } = parsedData;

    if (intentos <= 0) {
        ACTUALIZAR_DATOS_LOGIN({ limpiar: true, id_maquina: deviceId });
        await BorrarCuentaVC(correo);
        return { success: false, message: "Fallo al iniciar sesion: intentos acabados" }
    }

    //JWT , mantener sesion iniciada en cache
    if (mantenerSesion) {
        const [token, info] = await Promise.all([generarteToken('sesion'), infoDispositivo()]);
        await Promise.all([
            saveSessionFile({ username: correo, token }),
            AñadirJWTUsuario(correo, token, info)
        ]);
    }

    //guardar auto verificacion de cuenta en fichero local (omitir verificacion futura)
    const tokenVC = await generarteToken('cuenta');
    await Promise.all([
        saveOmitirVerificacionCuentaFile({ username: correo, token: tokenVC }),
        AñadirJWTUsuarioVC(correo, tokenVC),
        //borrar codigos
        BorrarCuentaVC(correo)
    ]);

    await asegurarIdentidadLocal();

    ;(async () => {
        if (!await correoPermitido('CORREO_INICIO_SESION')) return;
        const { asunto, htmlContenido } = ConfirmacionInicioSesion();
        enviarEmail({ correoDestino: correo, asunto, htmlContenido });
    })()
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

            clearCacheUsuarios(),
            clearCacheArchivosDescargados()
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


/**
 * Garantiza que exista una identidad E2EE local. Si no hay clave privada local
 * (p.ej. el registro no llegó a persistirla por un fallo previo), la regenera
 * automáticamente. Requiere que el ID de usuario ya esté establecido en sesión.
 * @returns {Promise<boolean>} true si la identidad ya existía o se regeneró con éxito
 */
async function asegurarIdentidadLocal() {
    try {
        const identidad = await getIdentity();
        if (identidad?.primary?.privateKey) return true;

        if (!storage.getIDMongodbUsuario()) {
            log.warn('[Identity] No hay identidad local pero tampoco sesión activa; se omite regeneración');
            return false;
        }

        log.warn('[Identity] No se encontró identidad E2EE local; regenerando automáticamente...');
        return await REGENERAR_IDENTIDAD_USUARIO();
    } catch (e) {
        log.error({ err: e }, '[Identity] Error asegurando la identidad local');
        return false;
    }
}

async function REGENERAR_IDENTIDAD_USUARIO() {
    try {
        const id_propio = storage.getIDMongodbUsuario();
        if (!id_propio) return false;

        const keys = await generarLlavesRSA();

        // Actualizar en DB y Guardar localmente en paralelo
        await Promise.all([
            User.updateOne({ _id: id_propio }, { $set: { publicKey: keys.publicKey } }),
            saveIdentityFile({ privateKey: keys.privateKey, publicKey: keys.publicKey })
        ]);

        // Refrescar caché del usuario propio para que incluya la nueva public key
        const updatedUser = await User.findById(id_propio).lean();
        if (updatedUser) {
            await setUsuarioEnCache(procesarUsuario(updatedUser));
        }

        log.warn("ATENCIÓN: Regenerando identidad E2EE completa. Esto romperá la lectura de mensajes antiguos en todos los chats existentes.");
        return true;
    } catch (e) {
        log.fatal({ err: e }, "Error crítico regenerando identidad");
        return false;
    }
}


/**
 * Verifica que la contraseña suministrada coincide con la del usuario en sesión.
 * @returns {{ ok: boolean, error?: string }}
 */
async function verificarContrasenaActual(contraseña) {
    try {
        const userId = storage.getIDMongodbUsuario?.();
        if (!userId) return { ok: false, error: 'No hay sesión activa' };
        const user = await User.findById(userId).select('contrasena').lean();
        if (!user) return { ok: false, error: 'Usuario no encontrado' };
        const match = await compare(contraseña, user.contrasena);
        return { ok: match, error: match ? undefined : 'Contraseña incorrecta' };
    } catch (err) {
        log.error({ err }, '[Auth] Error verificando contraseña actual');
        return { ok: false, error: err.message };
    }
}

async function marcarDispositivoConfianza(correo) {
    const [token, info] = await Promise.all([generarteToken('confianza'), infoDispositivo()]);
    await Promise.all([
        saveDispositivoConfianzaFile({ username: correo, token }),
        AñadirJWTDPConfianza(correo, token, info)
    ]);
    ;(async () => {
        if (!await correoPermitido('CORREO_DISPOSITIVO_CONFIANZA')) return;
        const apodo = storage.getApodoSesion();
        const fecha = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
        const { asunto, htmlContenido } = AvisoDispositivoConfianzaAnadido({ apodo, nombre: info.nombre, sistemaOperativo: info.os, fecha });
        enviarEmail({ correoDestino: correo, asunto, htmlContenido });
    })();
    return { success: true };
}

async function revocarDispositivoConfianza(correo) {
    const [info] = await Promise.all([
        infoDispositivo(),
        LimpiarJWTDPConfianza(correo),
        clearFileSession('dispositivoConfianza')
    ]);
    ;(async () => {
        if (!await correoPermitido('CORREO_DISPOSITIVO_CONFIANZA')) return;
        const apodo = storage.getApodoSesion();
        const fecha = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
        const { asunto, htmlContenido } = AvisoDispositivoConfianzaRevocado({ apodo, nombre: info.nombre, sistemaOperativo: info.os, fecha });
        enviarEmail({ correoDestino: correo, asunto, htmlContenido });
    })();
    return { success: true };
}

async function obtenerGestionDispositivos(correo) {
    const correoHash = hashDatosSistema(correo);
    const deviceId = String(machineIdSync());
    const deviceHash = hashDatosSistema(deviceId);

    const [sesiones, confianzas, bloqueados] = await Promise.all([
        ObtenerSesionesPorCorreo(correoHash),
        ObtenerDPConfianzasPorCorreo(correoHash),
        ObtenerDPsBloqueadosPorCorreo(correoHash)
    ]);

    const mapear = (doc) => {
        const ts = doc._id.getTimestamp ? doc._id.getTimestamp() : new Date(parseInt(doc._id.toString().slice(0, 8), 16) * 1000);
        return {
            id_dp_hash: doc.id_dp_hash,
            corto: doc.id_dp_hash.slice(-8).toUpperCase(),
            esteDispositivo: doc.id_dp_hash === deviceHash,
            os: doc.os || null,
            nombre: doc.nombre || null,
            creadoEn: ts.toISOString(),
            expira: doc.expira ? new Date(doc.expira).toISOString() : null
        };
    };

    const mapearBloqueado = (doc) => ({
        id_dp_hash: doc.id_dp_hash,
        corto: doc.id_dp_hash.slice(-8).toUpperCase(),
        esteDispositivo: doc.id_dp_hash === deviceHash,
        os: doc.os || null,
        nombre: doc.nombre || null,
        fechaBloqueado: doc.fecha_bloqueo ? new Date(doc.fecha_bloqueo).toISOString() : null
    });

    return {
        sesiones: sesiones.map(mapear),
        confianzas: confianzas.map(mapear),
        bloqueados: bloqueados.map(mapearBloqueado),
        deviceHash
    };
}

async function revocarSesionDispositivo(correo, id_dp_hash) {
    const correoHash = hashDatosSistema(correo);
    const [docInfo] = await Promise.all([
        ObtenerInfoSesionDispositivo(correoHash, id_dp_hash),
        RevocarSesionPorDispositivo(correoHash, id_dp_hash)
    ]);
    const deviceId = String(machineIdSync());
    if (id_dp_hash === hashDatosSistema(deviceId)) {
        await clearFileSession('sessionFile').catch(() => {});
    }
    ;(async () => {
        if (!await correoPermitido('CORREO_SESION_CERRADA')) return;
        const apodo = storage.getApodoSesion();
        const fecha = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
        const { asunto, htmlContenido } = AvisoSesionCerrada({ apodo, nombre: docInfo?.nombre || null, sistemaOperativo: docInfo?.os || null, fecha });
        enviarEmail({ correoDestino: correo, asunto, htmlContenido });
    })();
    return { success: true };
}

async function revocarConfianzaDispositivo(correo, id_dp_hash) {
    const correoHash = hashDatosSistema(correo);
    const [docInfo] = await Promise.all([
        ObtenerInfoDPConfianzaDispositivo(correoHash, id_dp_hash),
        RevocarDPConfianzaPorDispositivo(correoHash, id_dp_hash)
    ]);
    const deviceId = String(machineIdSync());
    if (id_dp_hash === hashDatosSistema(deviceId)) {
        await clearFileSession('dispositivoConfianza').catch(() => {});
    }
    ;(async () => {
        if (!await correoPermitido('CORREO_DISPOSITIVO_CONFIANZA')) return;
        const apodo = storage.getApodoSesion();
        const fecha = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
        const { asunto, htmlContenido } = AvisoDispositivoConfianzaRevocado({ apodo, nombre: docInfo?.nombre || null, sistemaOperativo: docInfo?.os || null, fecha });
        enviarEmail({ correoDestino: correo, asunto, htmlContenido });
    })();
    return { success: true };
}

async function bloquearDispositivo(correo, id_dp_hash) {
    const correoHash = hashDatosSistema(correo);

    // Obtener info del dispositivo de sesiones o confianza antes de eliminar
    const [infoSesion, infoConfianza] = await Promise.all([
        ObtenerInfoSesionDispositivo(correoHash, id_dp_hash),
        ObtenerInfoDPConfianzaDispositivo(correoHash, id_dp_hash)
    ]);
    const info = infoSesion || infoConfianza || {};

    // Bloquear + revocar sesiones y confianza en paralelo
    await Promise.all([
        BloquearDispositivo(correo, correoHash, id_dp_hash, { os: info.os || null, nombre: info.nombre || null }),
        RevocarSesionPorDispositivo(correoHash, id_dp_hash),
        RevocarDPConfianzaPorDispositivo(correoHash, id_dp_hash)
    ]);

    // Si es el dispositivo actual, limpiar archivos locales
    const deviceId = String(machineIdSync());
    if (id_dp_hash === hashDatosSistema(deviceId)) {
        await Promise.allSettled([
            clearFileSession('sessionFile'),
            clearFileSession('dispositivoConfianza')
        ]);
    }

    ;(async () => {
        if (!await correoPermitido('CORREO_DISPOSITIVO_BLOQUEADO')) return;
        const apodo = storage.getApodoSesion();
        const fecha = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
        const { asunto, htmlContenido } = AvisoDispositivoBloqueado({ apodo, nombre: info.nombre || null, sistemaOperativo: info.os || null, fecha });
        enviarEmail({ correoDestino: correo, asunto, htmlContenido });
    })();

    return { success: true };
}

async function desbloquearDispositivo(correo, id_dp_hash) {
    const correoHash = hashDatosSistema(correo);

    // Obtener info antes de desbloquear para el correo
    const doc = await ObtenerDPsBloqueadosPorCorreo(correoHash)
        .then(list => list.find(d => d.id_dp_hash === id_dp_hash) || null);

    await DesbloquearDispositivo(correoHash, id_dp_hash);

    ;(async () => {
        if (!await correoPermitido('CORREO_DISPOSITIVO_BLOQUEADO')) return;
        const apodo = storage.getApodoSesion();
        const fecha = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
        const { asunto, htmlContenido } = AvisoDispositivoDesbloqueado({ apodo, nombre: doc?.nombre || null, sistemaOperativo: doc?.os || null, fecha });
        enviarEmail({ correoDestino: correo, asunto, htmlContenido });
    })();

    return { success: true };
}

async function estadoDispositivoConfianza(correo) {
    try {
        const data = await readFileSession('dispositivoConfianza').catch(() => null);
        if (!data?.token) return false;
        if (!validateToken(data.token)) {
            clearFileSession('dispositivoConfianza').catch(() => {});
            return false;
        }
        const deviceId = String(machineIdSync());
        const tokenhash = createHash("sha256").update(data.token).digest("hex");
        const existe = await TokenDPC.exists({
            correo_hash: hashDatosSistema(correo),
            token: tokenhash,
            id_dp_hash: hashDatosSistema(deviceId)
        });
        return !!existe;
    } catch {
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
    REGENERAR_IDENTIDAD_USUARIO,
    verificarContrasenaActual,
    marcarDispositivoConfianza,
    revocarDispositivoConfianza,
    estadoDispositivoConfianza,
    obtenerGestionDispositivos,
    revocarSesionDispositivo,
    revocarConfianzaDispositivo,
    bloquearDispositivo,
    desbloquearDispositivo
};
