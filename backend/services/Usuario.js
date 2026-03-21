import { hash, compare, machineIdSync } from '../utils/libs.js';
import { hashDatosSistema, desencriptarDatosSistema } from './cryptoService.js';


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
    enviarEmail
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
let intentos_codigo_validacion = n_intentos_codigo_validacion;
let bloquear_accion = false
async function permitirCambioContraseñaUsuario(contraseña = null) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    const correo = getCorreoSesion()
    
    // Si no se proporciona contraseña, solo verificar si el usuario puede realizar la acción (bloqueo por tiempo)
    if (!contraseña) {
        const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo) });
        if (!data_usuario) {
            bloquear_accion = false;
            return { success: false, message: "Usuario no encontrado" };
        }
        if (data_usuario.exp_bloq_contrasena && new Date(data_usuario.exp_bloq_contrasena) >= new Date()) {
            bloquear_accion = false;
            return { success: false, message: "Tiempo de bloqueo no cumplido" };
        }
        bloquear_accion = false;
        return { success: true };
    }

    // Comprobar formato de la nueva contraseña
    let result = comprobarContrasenaValidaciones(contraseña);
    if (!result.success) {
        bloquear_accion = false;
        return { success: false, message: result.message };
    }

    // Verificar bloqueo y contraseña actual
    const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo) });
    if (!data_usuario) {
        bloquear_accion = false;
        return { success: false, message: "Usuario no encontrado" };
    }

    if (data_usuario.exp_bloq_contrasena && new Date(data_usuario.exp_bloq_contrasena) >= new Date()) {
        bloquear_accion = false;
        return { success: false, message: "Tiempo de bloqueo no cumplido" };
    }

    const iguales = await compare(contraseña, data_usuario.contrasena);
    if (iguales) {
        bloquear_accion = false;
        return { success: false, message: "La contraseña es la misma" };
    }

    const apodo = getApodoSesion();
    const code_generado = String(generarCodigoVerificacion());
    const hashed_ValidationCode = await hash(code_generado, saltos_code);
    const { asunto, htmlContenido } = CodigoCambiarDatosCuenta({ apodo: apodo, codigo: code_generado, tipo: "contraseña" });
    
    const deviceId = String(machineIdSync());
    InsertarDatosCuentaVC({ correo: correo, code: hashed_ValidationCode, id: deviceId, tipo: "contraseña" });
    
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido });
    
    intentos_codigo_validacion = n_intentos_codigo_validacion;
    bloquear_accion = false;
    return { success: true };
}

//TODO: ARREGLAR ESTE
async function permitirCambioCorreoUsuario(correo = null) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true
    const correo_viejo = getCorreoSesion()
    
    // Si no se proporciona correo, solo verificar si el usuario puede realizar la acción
    if (!correo) {
        const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo_viejo) })
        if (!data_usuario) {
            bloquear_accion = false
            return { success: false, message: "Usuario no encontrado" }
        }
        if (data_usuario.exp_bloq_correo && new Date(data_usuario.exp_bloq_correo) >= new Date()) {
            bloquear_accion = false
            return { success: false, message: "Tiempo de bloqueo no cumplido" }
        }
        bloquear_accion = false
        return { success: true }
    }

    // Comprobar formato del nuevo correo
    let result = comprobaciones_Correo(correo)
    if (!result.success) {
        bloquear_accion = false
        return { success: false, message: result.message }
    }

    // Verificar bloqueo, correo actual y existencia del nuevo correo
    const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo_viejo) })
    if (!data_usuario) {
        bloquear_accion = false
        return { success: false, message: "Usuario no encontrado" }
    }

    if (data_usuario.exp_bloq_correo && new Date(data_usuario.exp_bloq_correo) >= new Date()) {
        bloquear_accion = false
        return { success: false, message: "Tiempo de bloqueo no cumplido" }
    }

    if (desencriptarDatosSistema(data_usuario.correo) == correo) {
        bloquear_accion = false
        return { success: false, message: "El correo es the mismo" }
    }

    const data_usuario2 = await User.exists({ correo_hash: hashDatosSistema(correo) })
    if (data_usuario2) {
        bloquear_accion = false
        return { success: false, message: "Usuario ya existente" }
    }

    const apodo = getApodoSesion()
    const code_generado = String(generarCodigoVerificacion())
    const hashed_ValidationCode = await hash(code_generado, saltos_code)
    const { asunto, htmlContenido } = CodigoCambiarDatosCuenta({ apodo: apodo, codigo: code_generado, tipo: "correo" })
    
    const deviceId = String(machineIdSync());
    InsertarDatosCuentaVC({ correo: correo_viejo, code: hashed_ValidationCode, id: deviceId, tipo: "correo" })
    
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    
    intentos_codigo_validacion = n_intentos_codigo_validacion
    bloquear_accion = false
    return { success: true }
}
async function permitirCambioApodoUsuario(apodo = null) {
    if (bloquear_accion) return { success: false, bloqueador: true, message: "bloqueador de acción temporal" }
    bloquear_accion = true

    const correo = getCorreoSesion()
    // Si no se proporciona apodo, solo verificar si el usuario puede realizar la acción
    if (!apodo) {
        const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo) })

        if (!data_usuario) {
            bloquear_accion = false
            return { success: false, message: "Usuario no encontrado" }
        }
        if (data_usuario.exp_bloq_apodo && new Date(data_usuario.exp_bloq_apodo) >= new Date()) {
            bloquear_accion = false
            return { success: false, message: "Tiempo de bloqueo no cumplido" }
        }
        bloquear_accion = false
        return { success: true }
    }

    // Comprobar formato del nuevo apodo
    let result = comprobar_apodo(apodo)
    if (!result.success) {
        bloquear_accion = false
        return { success: false, message: result.message }
    }

    // Verificar bloqueo y apodo actual
    const data_usuario = await User.findOne({ correo_hash: hashDatosSistema(correo) })
    if (!data_usuario) {
        bloquear_accion = false
        return { success: false, message: "Usuario no encontrado" }
    }

    if (data_usuario.exp_bloq_apodo && new Date(data_usuario.exp_bloq_apodo) >= new Date()) {
        bloquear_accion = false
        return { success: false, message: "Tiempo de bloqueo no cumplido" }
    }

    if (desencriptarDatosSistema(data_usuario.apodo) == apodo) {
        bloquear_accion = false
        return { success: false, message: "El apodo es el mismo" }
    }

    // En este no se manda correo de verificación
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
        const VCodigo = comprobar_codigo_verificacion(code)
        if (!VCodigo.success) {
            bloquear_accion = false
            return { success: false, message: VCodigo.message }
        }
        //cojer el ultimo codigo generado
        let code_db = await DatosCuentaVC.findOne({ correo_hash: hashDatosSistema(correo), tipo: tipo }).sort({ expira: -1 }).lean();
        if (!code_db) {
            bloquear_accion = false
            return { success: false, message: "Fallo al cambiar datos: no hay codigos" };
        }
        const deviceId = String(machineIdSync());
        const id_dp_desencriptado = desencriptarDatosSistema(code_db.id_dp);

        if (deviceId !== id_dp_desencriptado && (id_dp_desencriptado != "")) {
            bloquear_accion = false
            return { success: false, message: "Fallo al cambiar datos: este codigo no pertenece a este dispositivo" };
        }
        //comparar codigo de usuario con el de mongodb
        const ok = await compare(String(code), code_db.code);
        if (!ok) {//no son iguales
            console.error(`Código incorrecto, intentos restantes: ${intentos_codigo_validacion}`)
            bloquear_accion = false
            return { success: false, message: "Fallo al cambiar datos: codigo incorrecto", intentos: intentos_codigo_validacion };
        };
    }
    //crear nueva cuenta de usuario
    if (tipo === "contraseña") {
        const contraseña_hashed = await hash(data, saltos_contraseña)
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

export {
    permitirCambioContraseñaUsuario,
    ValidarCodeCambioDatosCuenta,
    permitirCambioCorreoUsuario,
    permitirCambioApodoUsuario
};
