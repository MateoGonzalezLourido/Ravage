const dotenv = require("dotenv");
dotenv.config();
const bcrypt = require('bcryptjs')
const { machineIdSync } = require('node-machine-id');

const saltos_contraseña = Number(process.env.SALTOS_ENCRIPTAR_CONTRASENA)
const saltos_code = Number(process.env.SALTOS_ENCRIPTAR_CODE)

const { User, InsertarDatosCuentaVC, DatosCuentaVC, BorrarDatosCuentaVC, cambiarContraseñaUsuario, cambiarCorreoUsuario, cambiarApodoUsuario } = require('../db/mongo.js')
const { getCorreoSesion, getApodoSesion, setApodoSesion, setCorreoSesion } = require('../STORAGE/Variables_sesion.js')
const { CodigoCambiarDatosCuenta, ConfirmacionCambioContraseña, ConfirmacionCambioCorreo, ConfirmacionCambioApodo } = require('./MENSAJERIA/Estructuras_correos.js')
const { generarCodigoVerificacion, enviarEmail } = require('./MENSAJERIA/Servicio_mensajeria_correo.js')
const { comprobaciones_Correo, comprobar_apodo, comprobarContrasenaValidaciones, cerrarSesionUsuario } = require('./sesionUsuario.js')



//cambios de datos de la cuenta
const n_intentos_codigo_validacion = 5;
let intentos_codigo_validacion = n_intentos_codigo_validacion;
let bloquear_accion = false
async function permitirCambioContraseñaUsuario(contraseña = null) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    const correo = getCorreoSesion()
    //sin data solo mandar si no hay bloqueador de tiempo
    if (!contraseña) {
        const data_usuario = (await User.find({ correo: correo }))[0]
        if (!data_usuario || (!data_usuario.exp_bloq_contrasena)) {
            bloquear_accion = false
            return { success: false, message: "Usuario no encontrado" }
        }
        if (new Date(data_usuario.exp_bloq_contrasena) >= new Date()) {
            bloquear_accion = false
            return { success: false, message: "Tiempo de bloqueo no cumplido" }
        }
        bloquear_accion = false
        return { success: true }
    }

    //comprobar contraseña
    let result = comprobarContrasenaValidaciones(contraseña)
    if (!result.success) {
        bloquear_accion = false
        return { success: false, message: result.message }
    }
    //tiempo de bloqueo expirado?
    const data_usuario = (await User.find({ correo: correo }))[0]
    if (!data_usuario || (!data_usuario.exp_bloq_contrasena)) {
        bloquear_accion = false
        return { success: false, message: "Usuario no encontrado" }
    }
    //comprobacion de seguridad
    if (new Date(data_usuario.exp_bloq_contrasena) >= new Date()) {
        bloquear_accion = false
        return { success: false, message: "Tiempo de bloqueo no cumplido" }
    }
    const iguales = await bcrypt.compare(contraseña, data_usuario.contrasena)
    if (iguales) {
        bloquear_accion = false
        return { success: false, message: "La contraseña es la misma" }
    }
    const apodo = getApodoSesion()
    //todo correcto, mandar correo con codigo
    const code_generado = String(generarCodigoVerificacion())
    const hashed_ValidationCode = await bcrypt.hash(code_generado, saltos_code)
    const { asunto, htmlContenido } = CodigoCambiarDatosCuenta({ apodo: apodo, codigo: code_generado, tipo: "contraseña" })
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
//TODO: ARREGLAR ESTE
async function permitirCambioCorreoUsuario(correo = null) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    const correo_viejo = getCorreoSesion()
    //sin data solo mandar si no hay bloqueador de tiempo
    if (!correo) {
        const data_usuario = (await User.find({ correo: correo_viejo }))[0]
        if (!data_usuario || (!data_usuario.exp_bloq_correo)) {
            bloquear_accion = false
            return { success: false, message: "Usuario no encontrado" }
        }
        if (new Date(data_usuario.exp_bloq_correo) >= new Date()) {
            bloquear_accion = false
            return { success: false, message: "Tiempo de bloqueo no cumplido" }
        }
        bloquear_accion = false
        return { success: true }
    }

    //comprobar contraseña
    let result = comprobaciones_Correo(correo)
    if (!result.success) {
        bloquear_accion = false
        return { success: false, message: result.message }
    }
    //tiempo de bloqueo expirado?
    const data_usuario = (await User.find({ correo: correo_viejo }))[0]
    if (!data_usuario || (!data_usuario.exp_bloq_correo)) {
        bloquear_accion = false
        return { success: false, message: "Usuario no encontrado" }
    }
    //comprobacion de seguridad
    if (new Date(data_usuario.exp_bloq_correo) >= new Date()) {
        bloquear_accion = false
        return { success: false, message: "Tiempo de bloqueo no cumplido" }
    }
    if (data_usuario.correo == correo) {
        bloquear_accion = false
        return { success: false, message: "El correo es el mismo" }
    }
    //ya existe alguien con ese correo? 
    const data_usuario2 = await User.exists({ correo: correo })
    if (data_usuario2) {
        bloquear_accion = false
        return { success: false, message: "Usuario ya existente" }
    }
    const apodo = getApodoSesion()
    //todo correcto, mandar correo con codigo
    const code_generado = String(generarCodigoVerificacion())
    const hashed_ValidationCode = await bcrypt.hash(code_generado, saltos_code)
    const { asunto, htmlContenido } = CodigoCambiarDatosCuenta({ apodo: apodo, codigo: code_generado, tipo: "correo" })
    //insertar codigo en mongodb
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
    InsertarDatosCuentaVC({ correo: correo_viejo, code: hashed_ValidationCode, id: deviceId, tipo: "correo" })
    //mandar correo
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    //intentos para poder poner el codigo correcto de verificacion
    intentos_codigo_validacion = n_intentos_codigo_validacion
    bloquear_accion = false
    return { success: true }
}
async function permitirCambioApodoUsuario(apodo = null) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true

    const correo = getCorreoSesion()
    //sin data solo mandar si no hay bloqueador de tiempo
    if (!apodo) {
        const data_usuario = (await User.find({ correo: correo }))[0]
        if (!data_usuario || (!data_usuario.exp_bloq_apodo)) {
            bloquear_accion = false
            return { success: false, message: "Usuario no encontrado" }
        }
        if (new Date(data_usuario.exp_bloq_apodo) >= new Date()) {
            bloquear_accion = false
            return { success: false, message: "Tiempo de bloqueo no cumplido" }
        }
        bloquear_accion = false
        return { success: true }
    }
    //comprobar contraseña

    //comprobar contraseña
    let result = comprobar_apodo(apodo)
    if (!result.success) {
        bloquear_accion = false
        return { success: false, message: result.message }
    }
    //tiempo de bloqueo expirado?
    const data_usuario = (await User.find({ correo: correo }))[0]
    if (!data_usuario || (!data_usuario.exp_bloq_apodo)) {
        bloquear_accion = false
        return { success: false, message: "Usuario no encontrado" }
    }
    //comprobacion de seguridad
    if (new Date(data_usuario.exp_bloq_apodo) >= new Date()) {
        bloquear_accion = false
        return { success: false, message: "Tiempo de bloqueo no cumplido" }
    }
    if (data_usuario.apodo == apodo) {
        bloquear_accion = false
        return { success: false, message: "El apodo es el mismo" }
    }
    //*EN ESTE NO SE MANDA CORREO DE VERIFICACION
    bloquear_accion = false
    return { success: true }
}
async function ValidarCodeCambioDatosCuenta({ data, code = "", tipo = "" }) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    const correo = getCorreoSesion()
    if (tipo != "apodo") {
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
        let code_db = (await DatosCuentaVC.find({ correo: correo, tipo: tipo }).sort({ expira: -1 }).limit(1))[0];
        if (!code_db || code_db == [] || code_db.length == 0) {//no hay codes
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
    }
    //crear nueva cuenta de usuario
    if (tipo === "contraseña") {
        const contraseña_hashed = await bcrypt.hash(data, saltos_contraseña)
        const nuevoUsuario = await cambiarContraseñaUsuario(contraseña_hashed);
        if (!nuevoUsuario) {//error
            return { success: false, message: "Fallo al cambiar contraseña" }
        }
        BorrarDatosCuentaVC(correo, code)//borrar codigos
        bloquear_accion = false
        //cerrar sesion
        await cerrarSesionUsuario(correo)
    }
    else if (tipo === "correo") {
        const nuevoUsuario = await cambiarCorreoUsuario(data);
        setCorreoSesion(data)
        if (!nuevoUsuario) {//error
            return { success: false, message: "Fallo al cambiar correo" }
        }
        BorrarDatosCuentaVC(correo, code)//borrar codigos
        bloquear_accion = false
    }
    else if (tipo === "apodo") {
        const nuevoUsuario = await cambiarApodoUsuario(data);
        setApodoSesion(data)
        if (!nuevoUsuario) {//error
            return { success: false, message: "Fallo al cambiar apodo" }
        }
        BorrarDatosCuentaVC(correo, code)//borrar codigos
        bloquear_accion = false
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
    else {
        asunto = "Confirmación Cambio Datos Cuenta"
        htmlContenido = ""
    }
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    //limpiar datos 
    if (tipo != "apodo") {
        BorrarDatosCuentaVC(correo, code)
        contraseña_hashed = null;
    }
    bloquear_accion = false
    return { success: true };
}

module.exports = {
    permitirCambioContraseñaUsuario,
    ValidarCodeCambioDatosCuenta,
    permitirCambioCorreoUsuario,
    permitirCambioApodoUsuario
}
