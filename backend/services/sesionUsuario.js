const { InsertarUsuario, LoginUsuario, User, ValidationCode, LimpiarJWTUsuario, BorrarVC, InsertarVC, InsertarCuentaVC, BorrarCuentaVC, ActualizarUsuarioActivo, CuentaValidationCode, BorrarUsuarioActivo, AñadirJWTUsuario, AñadirJWTUsuarioVC, LimpiarJWTUsuarioVC, TokenVC, TokenSession } = require('../db/mongo.js')
const bcrypt = require('bcryptjs')
const { saveSessionFile, clearFileSession, saveOmitirVerificacionCuentaFile, readFileSession } = require('./controladorArchivosSesion.js')
const { enviarEmail, generarCodigoVerificacion } = require('./MENSAJERIA/Servicio_mensajeria_correo.js')
const { ValidarCorreoEstructura, ConfirmacionCuentaCreadaEstructura, ValidarCuentaUsuario, ConfirmacionInicioSesion } = require('./MENSAJERIA/Estructuras_correos.js')
const { generarteToken, validateToken } = require('./CreadorTokens.js')
const storage = require('../STORAGE/Variables_sesion.js')
const { machineIdSync } = require('node-machine-id');
const dotenv = require("dotenv");
dotenv.config();
let IntervalTimerUsuarioActivo;
const saltos_contraseña = Number(process.env.SALTOS_ENCRIPTAR_CONTRASENA)
const saltos_code = Number(process.env.SALTOS_ENCRIPTAR_CODE)
//vairables de usuario de sesion
async function ACTUALIZAR_DATOS_LOGIN(data) {
    storage.setApodoSesion(data.apodo);
    storage.setCorreoSesion(data.correo);
    storage.setFechaCreacionCuenta(data.createdAt)
    storage.setFechaBloqueoApodo(data.exp_bloq_apodo)
    storage.setFechaBloqueoCorreo(data.exp_bloq_correo)
    storage.setFechaBloqueoContraseña(data.exp_bloq_contrasena)
    storage.setUsuariosSilence(data.users_silence)
    storage.setUsuariosBloqueados(data.users_bloq)
}
async function autoLoginUsuario() {//aqui se usa username y correo, pero son lo mismo
    //leer fichero con datos de sesion anterior
    const data = readFileSession('sessionFile')
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
    //token de validacion de sesion
    const token_valido = validateToken(data.token);
    if (!token_valido) {//token no valido
        LimpiarJWTUsuario(data.correo, data.token)//limpiar token de mongodb
        clearFileSession('sessionFile');// datos incorrectos → limpiar sesión
        console.error("Token invalido o expirado")
        return { success: false };
    }
    //verificar si mongodb tiene ese token
    const token_datos = (await TokenSession.find({ correo: data.username, token: data.token }))
    if (!token_datos || token_datos == [] || token_datos.length == 0) {
        clearFileSession('sessionFile');// datos incorrectos → limpiar sesión
        console.error("Token invalido o expirado")
        return { success: false };
    }
    const tokenHash = crypto.createHash("sha256").update(data.token).digest("hex");

    if (tokenHash != token_datos) {
        LimpiarJWTUsuario(data.correo, data.token)//limpiar token de mongodb
        clearFileSession('sessionFile');// datos incorrectos → limpiar sesión
        console.error("Token invalido o expirado")
        return { success: false };
    }
    // verificar si esa cuenta sigue existiendo en la base de datos
    const usuario_datos = await LoginUsuario({ correo: data.username, token: data.token })
    //mostrar como usuario activo en mongodb
    if (usuario_datos && data) {
        // se ha encontrado el usuario
        //establecer variables globales
        //añadir usuario activo
        ACTUALIZAR_DATOS_LOGIN(usuario_datos);
        (async () => {
            await ActualizarUsuarioActivo({ correo: usuario_datos.correo });
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
    const existe = await User.find({ correo: correo }).limit(1);
    if (existe.length == 1) {
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
    const hashed_ValidationCode = await bcrypt.hash(code_generado, saltos_code)
    //generar correo
    const { asunto, htmlContenido } = ValidarCorreoEstructura({ apodo: apodo, code: code_generado })
    //insertar codigo en mongodb
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
    InsertarVC({ correo: correo, code: hashed_ValidationCode, id: deviceId })
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
    const code_db = (await ValidationCode.find({ correo }).sort({ expira: -1 }).limit(1))[0];
    if (code_db == []) {//no hay codes
        contraseña_hashed = null;
        apodo_usuario = null;
        bloquear_accion = false
        return { success: false, message: "Fallo al crear el usuario: no hay codigos" };
    }
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina

    if (deviceId !== code_db.id_dp && (code_db.id_dp != "")) {//no son el mismo dispositivo
        contraseña_hashed = null;
        apodo_usuario = null;
        bloquear_accion = false
        return { success: false, message: "Fallo al crear el usuario: este codigo no pertenece a este dispositivo" };
    }
    //comparar codigo de usuario con el de mongodb
    const ok = await bcrypt.compare(String(code), code_db.code);
    if (!ok) {//no son iguales
        console.error(`Código incorrecto, intentos restantes: ${intentos_codigo_validacion}`)
        bloquear_accion = false
        return { success: false, message: "Fallo al crear el usuario:codigo incorrecto", intentos: intentos_codigo_validacion };
    };
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
    //iniciar sesion
    const usuario_data = await LoginUsuario({ correo: username, contraseña: contraseña })
    if (!usuario_data || (!usuario_data.correo || !usuario_data.apodo)) {
        bloquear_accion = false
        return { success: false, message: 'Usuario no encontrado' }
    }
    //autovalidacion del codigo de verificacion de cuenta por token
    const data_autoverificacion = readFileSession("omitirVerificacionCuentaFile")
    let autoverificacion = false
    if (data_autoverificacion && (data_autoverificacion.token && data_autoverificacion.username)) {
        const valido = validateToken(data_autoverificacion.token)
        if (valido) {
            //validar token con mongodb
            const token_datos = await TokenVC.find({ correo: usuario_data.correo, token: data_autoverificacion.token })
            if (!token_datos || token_datos == [] || token_datos.length == 0) {
                clearFileSession('omitirVerificacionCuentaFile');
            }
            else {
                let validado2 = false
                for (let i = 0; i < token_datos.length; i++) {
                    if (data_autoverificacion.token == token_datos[i].token) {
                        validado2 = true
                        break
                    }
                }

                if (validado2) {
                    autoverificacion = true
                }
                else {
                    clearFileSession('omitirVerificacionCuentaFile');
                }
            }
        }
        else {//limpiar archivo y token
            clearFileSession('omitirVerificacionCuentaFile');
            LimpiarJWTUsuarioVC(username, data_autoverificacion.token)
        }
    }
    //guardar correo en variables globales
    ACTUALIZAR_DATOS_LOGIN(usuario_data);
    if (autoverificacion) {//se autovalida
        (async () => {
            await ActualizarUsuarioActivo({ correo: usuario_data.correo });
            comprobarActividadOnline()
        })();
        //JWT , mantener sesion iniciada en cache
        (async () => {
            if (mantener_sesion_iniciada) {
                const token_sesion = await generarteToken('sesion');
                saveSessionFile({ username: usuario_data.correo, token: token_sesion })//guardar sesion en fichero local
                await AñadirJWTUsuario(usuario_data.correo, token_sesion)//guardar en mongodb
            }
        })();
        console.log("-Autoverificacion de cuenta")
    }
    else {
        mantener_sesion_iniciada_usuario = mantener_sesion_iniciada
        //crear verificacion por codigo de correo
        const code_generado = String(generarCodigoVerificacion())
        const hashed_ValidationCode = await bcrypt.hash(code_generado, saltos_code)
        const { asunto, htmlContenido } = ValidarCuentaUsuario({ apodo: usuario_data.apodo, code: code_generado })
        //insertar codigo en mongodb
        const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
        InsertarCuentaVC({ correo: usuario_data.correo, code: hashed_ValidationCode, id: deviceId })
        //mandar correo
        enviarEmail({ correoDestino: usuario_data.correo, asunto: asunto, htmlContenido: htmlContenido })
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
    if (intentos_codigo_validacion < 0) { return { success: false, message: "Fallo al iniciar sesion:intentos acabados" } }
    //mirar si es codigo valido
    if (code.length > 6) return { success: false, message: "Código muy largo" }
    if (isNaN(Number(code))) return { success: false, message: "Código no numérico" }
    //cojer el ultimo codigo generado
    const code_db = await CuentaValidationCode.find({ correo }).sort({ expira: -1 }).limit(1);
    if (code_db == [] || !code_db || code_db.length == 0) {//no hay codigos
        mantener_sesion_iniciada_usuario = null
        bloquear_accion = false
        return { success: false, message: "Fallo al iniciar sesion: no hay codigos" };
    }
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina

    if (deviceId !== code_db[0].id_dp && (code_db[0].id_dp != "")) {//no son el mismo dispositivo
        contraseña_hashed = null;
        apodo_usuario = null;
        bloquear_accion = false
        return { success: false, message: "Fallo al iniciar sesion: este codigo no pertenece a este dispositivo" };
    }
    //comparar codigo de usuario con el de mongodb
    const ok = await bcrypt.compare(String(code), code_db[0].code);
    if (!ok) {//los codigos no son iguales
        console.error(`Código incorrecto, intentos restantes: ${intentos_codigo_validacion}`)
        bloquear_accion = false
        return { success: false, message: "Fallo al iniciar sesion: codigo incorrecto", intentos: intentos_codigo_validacion };
    };
    //mostrar como usuario activo en mongodb
    (async () => {
        await ActualizarUsuarioActivo({ correo: correo });
        comprobarActividadOnline()
    })();
    //JWT , mantener sesion iniciada en cache
    (async () => {
        if (mantener_sesion_iniciada_usuario) {
            const token_sesion = await generarteToken('sesion');
            saveSessionFile({ username: correo, token: token_sesion })//guardar sesion en fichero local
            await AñadirJWTUsuario(correo, token_sesion)//guardar en mongodb
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
    const data = readFileSession('sessionFile')
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
