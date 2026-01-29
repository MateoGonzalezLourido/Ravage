const dotenv = require("dotenv");
dotenv.config();
const saltos_contraseña = Number(process.env.SALTOS_ENCRIPTAR_CONTRASENA)
const saltos_code = Number(process.env.SALTOS_ENCRIPTAR_CODE)

const { ActualizarUsuarioActivo, User, InsertarContraseñaVC, ContraseñaVC, BorrarContraseñaVC, cambiarContraseñaUsuario } = require('../db/mongo.js')
const { getCorreoSesion, getApodoSesion } = require('../STORAGE/Variables_sesion.js')
const { CodigoCambiarContraseña, ConfirmacionCambioContraseña } = require('./MENSAJERIA/Estructuras_correos.js')
const { generarCodigoVerificacion, enviarEmail } = require('./MENSAJERIA/Servicio_mensajeria_correo.js')
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
let contraseña_hashed;
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
    const { asunto, htmlContenido } = CodigoCambiarContraseña({ apodo: apodo, code: code_generado })
    //insertar codigo en mongodb
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
    InsertarContraseñaVC({ correo: correo, code: hashed_ValidationCode, id: deviceId })
    //mandar correo
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    //intentos para poder poner el codigo correcto de verificacion
    intentos_codigo_validacion = n_intentos_codigo_validacion
    bloquear_accion = false
    contraseña_hashed = contraseña
    return { success: true }
}
async function ValidarCodeContraseñaUsuario({ code = "" }) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true

    intentos_codigo_validacion--
    //verificar si ya habia cabado los intentos
    if (intentos_codigo_validacion < 0) {
        bloquear_accion = false
        return { success: false, message: "Fallo al cambiar contraseña: intentos acabados" }
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
    const code_db = (await ContraseñaVC.find({ correo }).sort({ expira: -1 }).limit(1))[0];
    if (code_db == []) {//no hay codes
        contraseña_hashed = null;
        bloquear_accion = false
        return { success: false, message: "Fallo al cambiar contraseña: no hay codigos" };
    }
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina

    if (deviceId !== code_db.id_dp && (code_db.id_dp != "")) {//no son el mismo dispositivo
        contraseña_hashed = null;
        bloquear_accion = false
        return { success: false, message: "Fallo al cambiar contraseña: este codigo no pertenece a este dispositivo" };
    }
    //comparar codigo de usuario con el de mongodb
    const ok = await bcrypt.compare(String(code), code_db.code);
    if (!ok) {//no son iguales
        console.error(`Código incorrecto, intentos restantes: ${intentos_codigo_validacion}`)
        bloquear_accion = false
        return { success: false, message: "Fallo al cambiar contraseña: codigo incorrecto", intentos: intentos_codigo_validacion };
    };
    //crear nueva cuenta de usuario
    contraseña_hashed = await bcrypt.hash(contraseña_hashed, saltos_contraseña)
    const nuevoUsuario = await cambiarContraseñaUsuario({ contraseña: contraseña_hashed });
    if (!nuevoUsuario) {//error
        BorrarVC(correo)//borrar codigos
        contraseña_hashed = null;
        bloquear_accion = false
        return { success: false, message: "Fallo al cambiar contraseña" }
    }

    //mandar correo confirmando creacion de cuenta
    const apodo = getApodoSesion()
    const { asunto, htmlContenido } = ConfirmacionCambioContraseña({ apodo: apodo })
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    //limpiar datos 
    BorrarContraseñaVC(correo)
    contraseña_hashed = null;
    bloquear_accion = false
    return { success: true };
}

module.exports = {
    comprobarActividadOnline,
    permitirCambioContraseñaUsuario,
    ValidarCodeContraseñaUsuario
}
