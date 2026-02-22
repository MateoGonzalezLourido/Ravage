const { InsertarUsuario, LoginUsuarioDB, User, ValidationCode, LimpiarJWTUsuario, BorrarVC, InsertarVC, InsertarCuentaVC, BorrarCuentaVC, ActualizarUsuarioActivo, CuentaValidationCode, BorrarUsuarioActivo, AñadirJWTUsuario, AñadirJWTUsuarioVC, LimpiarJWTUsuarioVC, TokenVC, TokenSession, TokenDPC, DispositivosBloqueados } = require('../db/mongo.js')
const { saveSessionFile, clearFileSession, saveOmitirVerificacionCuentaFile, readFileSession, limpiarArchivosCompleto } = require('./controladorArchivosSesion.js')
const { enviarEmail, generarCodigoVerificacion } = require('./MENSAJERIA/Servicio_mensajeria_correo.js')
const { ValidarCorreoEstructura, ConfirmacionCuentaCreadaEstructura, ValidarCuentaUsuario, ConfirmacionInicioSesion } = require('./MENSAJERIA/Estructuras_correos.js')
const { generarteToken, validateToken } = require('./CreadorTokens.js')
const storage = require('../STORAGE/Variables_sesion.js')
const { machineIdSync } = require('node-machine-id');
const dotenv = require("dotenv");
dotenv.config();
const bcrypt = require('bcryptjs')//para contraseñas: mas seguro para esto
const crypto = require("crypto");//para tokens y codigos: mas rapido e igual de funcional

let IntervalTimerUsuarioActivo;
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
    storage.setUsuariosSilence(!limpiar ? String(data.users_silence) : [])
    storage.setUsuariosBloqueados(!limpiar ? String(data.users_bloq) : [])
    storage.setIdDispositivo(!limpiar ? String(machineIdSync()) : null)
    storage.setSecretKEY(!limpiar ? data.secretKey : null)
    storage.setListaChats(
        !limpiar
            ? data.chats.map(c => ({
                ...c,
                id: c.id.toString() // convierte ObjectId a string si queda alguno
            }))
            : []
    );
    storage.setListaContactos(
        !limpiar
            ? data.contactos.map(c => ({
                ...c,
                id: c.id.toString() // convierte ObjectId a string si queda alguno
            }))
            : []
    );
    storage.setVisibleUsuario(!limpiar ? data.visible : false)
}
async function autoLoginUsuario() {//aqui se usa username y correo, pero son lo mismo
    //leer fichero con datos de sesion anterior
    const data = await readFileSession('sessionFile')
    //verificar si estan todos los datos
    if (!data || (!data.username || !data.token)) {
        console.error("*Autologin: datos de fichero no validos")
        return { success: false }; //fichero vacio o faltan datos
    }
    //comprobacion inicial de si es un correo
    const VCorreo = comprobaciones_Correo(data.username)
    if (!VCorreo.success) {//no es valido
        console.error("*Autologin: correo no valido")
        clearFileSession('sessionFile'); // datos corruptos → limpiar sesión
        return { success: false }
    }
    //comprobar si este dp no esta bloqueado
    const deviceId = String(machineIdSync());// por defecto devuelve un hash único de la máquina
    const dp_bloqueado_db = await DispositivosBloqueados.find({ correo: data.username, id_dp: deviceId }).limit(1)
    if (dp_bloqueado_db && (dp_bloqueado_db.length != 0)) {
        bloquear_accion = false
        limpiarArchivosCompleto()
        return { success: false, message: '*ESTE DISPOSITIVO TIENE EL ACCESO BLOQUEADO A ESTA CUENTA' }
    }
    // verificar si esa cuenta sigue existiendo en la base de datos
    const usuario_datos = await LoginUsuarioDB({ correo: data.username, token: data.token, id_dp: deviceId })

    //mostrar como usuario activo en mongodb
    if (usuario_datos.success && (usuario_datos.data)) {
        // se ha encontrado el usuario
        //establecer variables globales
        //añadir usuario activo
        ACTUALIZAR_DATOS_LOGIN({ data: usuario_datos.data });
        (async () => {
            await ActualizarUsuarioActivo({ correo: usuario_datos.data.correo });
            comprobarActividadOnline()//iniciar comprobador usuario activo
        })();
        console.log("*Autologin correcto")
        return { success: true };
    }
    else {//no se ha encontrado el usuario
        LimpiarJWTUsuario(data.username, data.token)//limpiar token de mongodb
        clearFileSession('sessionFile'); // datos incorrectos → limpiar sesión
        console.error("Error en auto login: no existe este usuario o los datos estan mal")
        return { success: false };
    }
}

//variables importantes para unir funciones log o reg con su validacion por correo
let contraseña_hashed;
let apodo_usuario;
let mantener_sesion_iniciada_usuario;
const n_intentos_codigo_validacion = 5;
let intentos_codigo_validacion = n_intentos_codigo_validacion;
let bloquear_accion = false

async function registerUsuario({ apodo = "Usuario", correo = null, password = null }) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true

    if (!correo || !password) {
        bloquear_accion = false
        return { success: false, message: "Faltan datos para registrar el usuario" }
    }
    //comprobacion inicial de si es un correo
    const resultado = comprobaciones_Correo(correo)
    if (!resultado.success) {
        bloquear_accion = false
        return { success: false, message: resultado.message }
    }
    //verificar si no existe un usuario igual
    const existe = await User.exists({ correo });
    if (existe) {
        bloquear_accion = false
        return { success: false, message: "Correo ya registrado" };
    }
    //guardar vairables para pasarlas a la validacion por correo
    contraseña_hashed = await bcrypt.hash(password, saltos_contraseña);//contraseña hasheada
    const apodo_valido = comprobar_apodo(apodo)
    if (!apodo_valido.success) {
        bloquear_accion = false
        return { success: false, message: apodo_valido.message }
    }
    apodo_usuario = apodo

    //crear verificacion por codigo de correo
    const code_generado = String(generarCodigoVerificacion())
    //generar correo
    const { asunto, htmlContenido } = ValidarCorreoEstructura({ apodo: apodo, code: code_generado })
    //insertar codigo en mongodb
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
    InsertarVC({ correo: correo, code: code_generado, id: deviceId })
    //enviar correo
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })

    //intentos para poder poner el codigo correcto de verificacion
    intentos_codigo_validacion = n_intentos_codigo_validacion
    bloquear_accion = false
    return { success: true }
}

async function ValidarCodeRegistroUsuario({ correo, code = "" }) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true

    intentos_codigo_validacion--
    //verificar si ya habia cabado los intentos
    if (intentos_codigo_validacion < 0) {
        bloquear_accion = false
        return { success: false, message: "Fallo al crear el usuario:intentos acabados" }
    }
    //mirar si es codigo valido
    if (code.length > 6) {
        bloquear_accion = false
        return { success: false, message: "Código muy largo" }
    }
    if (isNaN(Number(code))) {
        bloquear_accion = false
        return { success: false, message: "Código no numérico" }
    }
    //cojer el ultimo codigo generado
    const codehash = crypto.createHash("sha256").update(code).digest("hex");//crear hash del code
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina

    const code_db = await ValidationCode.exists({ correo, code: codehash, id_dp: deviceId })
    if (!code_db) {//no hay codes
        contraseña_hashed = null;
        apodo_usuario = null;
        bloquear_accion = false
        return { success: false, message: "Fallo al crear el usuario: no existe ese código" };
    }
    //crear nueva cuenta de usuario
    const nuevoUsuario = await InsertarUsuario({ apodo: apodo_usuario, contraseña: contraseña_hashed, correo: correo });
    if (!nuevoUsuario) {//error
        BorrarVC(correo)//borrar codigos
        contraseña_hashed = null;
        apodo_usuario = null;
        bloquear_accion = false
        return { success: false, message: "Fallo al crear el usuario" }
    }

    //mandar correo confirmando creacion de cuenta
    const { asunto, htmlContenido } = ConfirmacionCuentaCreadaEstructura({ apodo: apodo_usuario })
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    //limpiar datos 
    BorrarVC(correo)
    apodo_usuario = null;
    contraseña_hashed = null;
    bloquear_accion = false
    return { success: true };
}

async function loginUsuario({ username, contraseña, mantener_sesion_iniciada = true }) {//aqui se usa username en vez de correo, pero son lo mismo
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true

    //limpiar cosas del registro si hubiese
    if (apodo_usuario || apodo_usuario) {
        contraseña_hashed = null;
        apodo_usuario = null;
    }
    //comprobacion inicial de si es un correo
    const resultado = comprobaciones_Correo(username)
    if (!resultado.success) {
        bloquear_accion = false
        return { success: false, message: resultado.message }
    }
    //comprobar si este dp no esta bloqueado
    const deviceId = String(machineIdSync());// por defecto devuelve un hash único de la máquina
    const dp_bloqueado_db = await DispositivosBloqueados.exists({ correo: username, id_dp: deviceId })
    if (dp_bloqueado_db) {
        bloquear_accion = false
        return { success: false, message: 'ESTE DISPOSITIVO TIENE EL ACCESO BLOQUEADO A ESTA CUENTA' }
    }
    //iniciar sesion
    const usuario_data = await LoginUsuarioDB({ correo: username, contraseña: contraseña })
    if (!usuario_data || !usuario_data.success) {
        bloquear_accion = false
        clearFileSession('sessionFile');// datos incorrectos → limpiar sesión
        return { success: false, message: 'Usuario no encontrado' }
    }
    //dispositivo confianza
    const dp_confianza_data = await readFileSession('dispositivoConfianza')
    let dp_confianza = false
    if (!dp_confianza_data || (dp_confianza_data != "" && !validateToken(dp_confianza_data.token))) {
        clearFileSession('dispositivoConfianza')
    }
    else {
        const tokenhash = crypto.createHash("sha256").update(dp_confianza_data.token).digest("hex");
        dp_confianza = await TokenDPC.exists({ correo: username, token: tokenhash, id_dp: deviceId })
    }
    //autovalidacion del codigo de verificacion de cuenta por token
    const data_autoverificacion = !dp_confianza ? await readFileSession("omitirVerificacionCuentaFile") : ""
    let autoverificacion = dp_confianza
    if (!dp_confianza && data_autoverificacion && (data_autoverificacion.token && data_autoverificacion.username)) {
        const valido = validateToken(data_autoverificacion.token)
        if (valido) {
            //validar token con mongodb
            const tokenhash = crypto.createHash("sha256").update(data_autoverificacion.token).digest("hex");
            const token_datos = await TokenVC.exists({ correo: usuario_data.data.correo, token: tokenhash, id_dp: deviceId })

            if (!token_datos) clearFileSession('omitirVerificacionCuentaFile');
            else autoverificacion = true

        }
        else {//limpiar archivo y token
            clearFileSession('omitirVerificacionCuentaFile');
            LimpiarJWTUsuarioVC(username, data_autoverificacion.token)
        }
    }
    //guardar correo en variables globales
    ACTUALIZAR_DATOS_LOGIN({ data: usuario_data.data });
    if (autoverificacion) {//se autovalida
        (async () => {
            await ActualizarUsuarioActivo({ correo: usuario_data.data.correo });
            comprobarActividadOnline()
        })();
        //JWT , mantener sesion iniciada en cache
        (async () => {
            if (mantener_sesion_iniciada) {
                const token = await generarteToken('sesion');
                saveSessionFile({ username: usuario_data.data.correo, token: token })//guardar sesion en fichero local
                await AñadirJWTUsuario(usuario_data.data.correo, token)//guardar en mongodb
            }
        })();
        console.log("-Autoverificacion de cuenta")
    }
    else {
        mantener_sesion_iniciada_usuario = mantener_sesion_iniciada
        //crear verificacion por codigo de correo
        const code_generado = String(generarCodigoVerificacion())
        const { asunto, htmlContenido } = ValidarCuentaUsuario({ apodo: usuario_data.data.apodo, code: code_generado })
        //insertar codigo en mongodb
        InsertarCuentaVC({ correo: usuario_data.data.correo, code: code_generado, id: deviceId })
        //mandar correo
        enviarEmail({ correoDestino: usuario_data.data.correo, asunto: asunto, htmlContenido: htmlContenido })
        //intentos para poder poner el codigo correcto de verificacion
        intentos_codigo_validacion = n_intentos_codigo_validacion
    }
    bloquear_accion = false
    return { success: true, autoverificacion: autoverificacion }
}

async function ValidarCodeLogin({ correo, code }) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true

    intentos_codigo_validacion--
    //verificar si ya habia cabado los intentos
    if (intentos_codigo_validacion < 0) {
        ACTUALIZAR_DATOS_LOGIN({ limpiar: true })
        return { success: false, message: "Fallo al iniciar sesion:intentos acabados" }
    }
    //mirar si es codigo valido
    if (code.length > 6) return { success: false, message: "Código muy largo" }
    if (isNaN(Number(code))) return { success: false, message: "Código no numérico" }
    //cojer el ultimo codigo generado

    //cojer el ultimo codigo generado
    const codehash = crypto.createHash("sha256").update(code).digest("hex");
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina

    const code_db = await CuentaValidationCode.exists({ correo, code: codehash, id_dp: deviceId })
    if (!code_db) {//no hay codes
        contraseña_hashed = null;
        apodo_usuario = null;
        bloquear_accion = false
        ACTUALIZAR_DATOS_LOGIN({ limpiar: true })
        return { success: false, message: "Fallo al iniciar sesion: no existe ese código" };
    }
    //mostrar como usuario activo en mongodb
    (async () => {
        await ActualizarUsuarioActivo({ correo: correo });
        comprobarActividadOnline()
    })();
    //JWT , mantener sesion iniciada en cache
    (async () => {
        if (mantener_sesion_iniciada_usuario) {
            const token = await generarteToken('sesion');
            saveSessionFile({ username: correo, token: token })//guardar sesion en fichero local
            await AñadirJWTUsuario(correo, token)//guardar en mongodb
        }
    })();
    //guardar auto verificacion de cuenta en fichero local
    (async () => {
        const token = await generarteToken('cuenta');
        saveOmitirVerificacionCuentaFile({ username: correo, token: token })
        await AñadirJWTUsuarioVC(correo, token)//guardar en mongodb
    })();
    //borrar codigos
    BorrarCuentaVC(correo)

    //mandar correo confirmando creacion de cuenta
    const { asunto, htmlContenido } = ConfirmacionInicioSesion()
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    bloquear_accion = false
    return { success: true };
}

async function cerrarSesionUsuario(correo) {
    //cojer datos del archivo de sesion para borrar el token
    const data = await readFileSession('sessionFile')
    //limpiar archivo de sesion
    clearFileSession('sessionFile');
    //si existe ese archivo limpiar token
    if (data) LimpiarJWTUsuario(correo, data.token)//borrar jwt de DB
    //borrar usuario activo
    clearInterval(IntervalTimerUsuarioActivo)
    BorrarUsuarioActivo()
    //limpiar datos
    storage.setCorreoSesion(null)
    storage.setApodoSesion(null)
    //mostrar log

    //sesion cerrada
    console.warn("*Sesion cerrada")
    return true
}

//TODO: añadir mas verificaciones
function comprobaciones_Correo(correo) {
    let success = true;
    let message = "Username válido";
    //validaciones
    if (/[A-Z]/.test(correo)) { success = false; message = "El correo no puede contener mayúsculas"; }
    else if (correo.indexOf("@") == -1) { success = false; message = "No es un correo"; }

    //resultado
    return { success: success, message: message }
}
//TODO: añadir mas verificaciones
function comprobar_apodo(apodo) {
    let success = true;
    let message = "Username válido";
    //validaciones
    // solo letras, números, guion y guion bajo
    if (!(/^[a-zA-Z0-9_-]+$/.test(apodo))) { success = false; message = "Apodo: solo letras, números, guión y guión bajo"; }

    //resultado
    return { success: success, message: message }
}
//TODO: añadir mas verificaciones
function comprobarContrasenaValidaciones(contraseña) {
    let success = true;
    let message = "Username válido";
    //validaciones

    return { success: success, message: message }
}
async function comprobar_contraseña_cuenta(contraseña) {
    const correo = storage.getCorreoSesion()
    const usuario_data = (await User.find({ correo: correo }).limit(1))[0]
    if (!usuario_data) return false
    const ok = await bcrypt.compare(String(contraseña), usuario_data.contrasena);
    return ok
}
//mantener sesion activa
async function comprobarActividadOnline() {
    const correo_inicial = storage.getCorreoSesion()
    IntervalTimerUsuarioActivo = setInterval(() => {
        const correo_actual = storage.getCorreoSesion()
        if (!correo_actual) {
            //si no hay correo parar la comprobacion
            clearInterval(IntervalTimerUsuarioActivo)
            BorrarUsuarioActivo()
            return;
        }
        if (correo_actual !== correo_inicial) BorrarUsuarioActivo()//borrar sesion desactualizada

        ActualizarUsuarioActivo({ correo: correo_actual })
    }, 4 * 60 * 1000)//4minutos, aunque mongo expire cada 5 minutos
}
module.exports = { comprobar_contraseña_cuenta, registerUsuario, loginUsuario, autoLoginUsuario, cerrarSesionUsuario, ValidarCodeRegistroUsuario, ValidarCodeLogin, comprobaciones_Correo, comprobar_apodo, comprobarContrasenaValidaciones }
