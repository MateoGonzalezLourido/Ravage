const dotenv = require("dotenv");
dotenv.config();
const saltos_contraseña = Number(process.env.SALTOS_ENCRIPTAR_CONTRASENA)
const saltos_code = Number(process.env.SALTOS_ENCRIPTAR_CODE)

const { ActualizarUsuarioActivo, User, InsertarDatosCuentaVC, DatosCuentaVC, BorrarDatosCuentaVC, cambiarContraseñaUsuario, cambiarCorreoUsuario } = require('../db/mongo.js')
const { getCorreoSesion, getApodoSesion } = require('../STORAGE/Variables_sesion.js')
const { CodigoCambiarDatosCuenta, ConfirmacionCambioContraseña, ConfirmacionCambioCorreo, ConfirmacionCambioApodo } = require('./MENSAJERIA/Estructuras_correos.js')
const { generarCodigoVerificacion, enviarEmail } = require('./MENSAJERIA/Servicio_mensajeria_correo.js')
const { comprobaciones_Correo, comprobar_apodo } = require('./sesion.js')
//mantener sesion activa
function comprobarActividadOnline() {
    setInterval(() => {
        ActualizarUsuarioActivo()
    }, 4 * 60 * 1000)//4minutos, aunque mongo expire cada 5 minutos
}
//cambios de datos de la cuenta
const n_intentos_codigo_validacion = 5;
let intentos_codigo_validacion = n_intentos_codigo_validacion;
let bloquear_accion = false
async function permitirCambioContraseñaUsuario(contraseña) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    //comprobar contraseña
    let result = comprobarContraseñaValidaciones(contraseña)
    if (!result.success) {
        bloquear_accion = false
        return { success: false, message: result.message }
    }
    //tiempo de bloqueo expirado?
    const correo = getCorreoSesion()
    const data_usuario = await User.find({ correo: correo })
    if (!data_usuario) {
        bloquear_accion = false
        return { success: false, message: "Usuario no encontrado" }
    }
    if (data_usuario.exp_bloq_contrasena >= new Date()) {
        bloquear_accion = false
        return { success: false, message: "Tiempo de bloqueo no cumplido" }
    }
    const apodo = getApodoSesion()
    //todo correcto, mandar correo con codigo
    const code_generado = String(generarCodigoVerificacion())
    const hashed_ValidationCode = await bcrypt.hash(code_generado, saltos_code)
    const { asunto, htmlContenido } = CodigoCambiarDatosCuenta({ apodo: apodo, code: code_generado, tipo: "contraseña" })
    //insertar codigo en mongodb
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
    InsertarDatosCuentaVC({ correo: correo, code: hashed_ValidationCode, id: deviceId, tipo: "contraseña" })
    //mandar correo
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    //intentos para poder poner el codigo correcto de verificacion
    intentos_codigo_validacion = n_intentos_codigo_validacion
    bloquear_accion = false
    return { success: true }
}
async function permitirCambioCorreoUsuario(correo) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    //comprobar contraseña
    let result = comprobaciones_Correo(contraseña)
    if (!result.success) {
        bloquear_accion = false
        return { success: false, message: result.message }
    }
    //tiempo de bloqueo expirado?
    const correo = getCorreoSesion()
    const data_usuario = await User.find({ correo: correo })
    if (!data_usuario) {
        bloquear_accion = false
        return { success: false, message: "Usuario no encontrado" }
    }
    if (data_usuario.exp_bloq_correo >= new Date()) {
        bloquear_accion = false
        return { success: false, message: "Tiempo de bloqueo no cumplido" }
    }
    const apodo = getApodoSesion()
    //todo correcto, mandar correo con codigo
    const code_generado = String(generarCodigoVerificacion())
    const hashed_ValidationCode = await bcrypt.hash(code_generado, saltos_code)
    const { asunto, htmlContenido } = CodigoCambiarDatosCuenta({ apodo: apodo, code: code_generado, tipo: "correo" })
    //insertar codigo en mongodb
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
    InsertarDatosCuentaVC({ correo: correo, code: hashed_ValidationCode, id: deviceId, tipo: "correo" })
    //mandar correo
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    //intentos para poder poner el codigo correcto de verificacion
    intentos_codigo_validacion = n_intentos_codigo_validacion
    bloquear_accion = false
    return { success: true }
}
async function permitirCambioApodoUsuario(apodo) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    //comprobar contraseña
    let result = comprobar_apodo(apodo)
    if (!result.success) {
        bloquear_accion = false
        return { success: false, message: result.message }
    }
    //tiempo de bloqueo expirado?
    const correo = getCorreoSesion()
    const data_usuario = await User.find({ correo: correo })
    if (!data_usuario) {
        bloquear_accion = false
        return { success: false, message: "Usuario no encontrado" }
    }
    if (data_usuario.exp_bloq_correo >= new Date()) {
        bloquear_accion = false
        return { success: false, message: "Tiempo de bloqueo no cumplido" }
    }
    const apodo = getApodoSesion()
    //todo correcto, mandar correo con codigo
    const code_generado = String(generarCodigoVerificacion())
    const hashed_ValidationCode = await bcrypt.hash(code_generado, saltos_code)
    const { asunto, htmlContenido } = CodigoCambiarDatosCuenta({ apodo: apodo, code: code_generado, tipo: "apodo" })
    //insertar codigo en mongodb
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
    InsertarDatosCuentaVC({ correo: correo, code: hashed_ValidationCode, id: deviceId, tipo: "apodo" })
    //mandar correo
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    //intentos para poder poner el codigo correcto de verificacion
    intentos_codigo_validacion = n_intentos_codigo_validacion
    bloquear_accion = false
    return { success: true }
}
async function ValidarCodeCambioDatosCuenta({ data, code = "", tipo = "" }) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true

    intentos_codigo_validacion--
    //verificar si ya habia cabado los intentos
    if (intentos_codigo_validacion < 0) {
        bloquear_accion = false
        return { success: false, message: "Fallo al cambiar datos: intentos acabados" }
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
    const correo = getCorreoSesion()
    let code_db = (await DatosCuentaVC.find({ correo: correo, tipo: tipo }).sort({ expira: -1 }).limit(1))[0];
    if (code_db == []) {//no hay codes
        bloquear_accion = false
        return { success: false, message: "Fallo al cambiar datos: no hay codigos" };
    }
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina

    if (deviceId !== code_db.id_dp && (code_db.id_dp != "")) {//no son el mismo dispositivo
        bloquear_accion = false
        return { success: false, message: "Fallo al cambiar datos: este codigo no pertenece a este dispositivo" };
    }
    //comparar codigo de usuario con el de mongodb
    const ok = await bcrypt.compare(String(code), code_db.code);
    if (!ok) {//no son iguales
        console.error(`Código incorrecto, intentos restantes: ${intentos_codigo_validacion}`)
        bloquear_accion = false
        return { success: false, message: "Fallo al cambiar datos: codigo incorrecto", intentos: intentos_codigo_validacion };
    };
    //crear nueva cuenta de usuario
    if (tipo == "contraseña") {
        const contraseña_hashed = await bcrypt.hash(data, saltos_contraseña)
        const nuevoUsuario = await cambiarContraseñaUsuario({ contraseña: contraseña_hashed });
        if (!nuevoUsuario) {//error
            BorrarDatosCuentaVC(correo, code)//borrar codigos
            bloquear_accion = false
            return { success: false, message: "Fallo al cambiar contraseña" }
        }
    }
    else if (tipo == "correo") {
        const nuevoUsuario = await cambiarCorreoUsuario({ correo: correo });
        if (!nuevoUsuario) {//error
            BorrarDatosCuentaVC(correo, code)//borrar codigos
            bloquear_accion = false
            return { success: false, message: "Fallo al cambiar correo" }
        }
    }
    else if (tipo == "apodo") {
        const nuevoUsuario = await cambiarCorreoUsuario({ correo: correo });
        if (!nuevoUsuario) {//error
            BorrarDatosCuentaVC(correo, code)//borrar codigos
            bloquear_accion = false
            return { success: false, message: "Fallo al cambiar apodo" }
        }
    }

    //mandar correo confirmando creacion de cuenta
    const apodo = getApodoSesion()
    let asunto, htmlContenido
    if (tipo == "contraseña") {
        const { asunto2, htmlContenido2 } = ConfirmacionCambioContraseña({ apodo: apodo })
        asunto = asunto2
        htmlContenido = htmlContenido2
    }
    else if (tipo == "correo") {
        const { asunto2, htmlContenido2 } = ConfirmacionCambioCorreo({ apodo: apodo })
        asunto = asunto2
        htmlContenido = htmlContenido2
    }
    else if (tipo == "apodo") {
        const { asunto2, htmlContenido2 } = ConfirmacionCambioApodo({ apodo: apodo })
        asunto = asunto2
        htmlContenido = htmlContenido2
    }
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    //limpiar datos 
    BorrarDatosCuentaVC(correo, code)
    contraseña_hashed = null;
    bloquear_accion = false
    return { success: true };
}

module.exports = {
    comprobarActividadOnline,
    permitirCambioContraseñaUsuario,
    ValidarCodeCambioDatosCuenta,
    permitirCambioCorreoUsuario,
    permitirCambioApodoUsuario
}
