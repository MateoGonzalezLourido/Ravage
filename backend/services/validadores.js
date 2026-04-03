import { User } from '../models/User.js';
import * as storage from '../STORAGE/Variables_sesion.js';
import { compare,validator } from '../utils/libs.js';
import { hashDatosSistema } from './cryptoService.js';

function comprobaciones_Correo(correo) {
    if (typeof correo !== 'string') return { success: false, message: "Investigación de tipos no autorizada" };
    
    if (correo.length > 255) {
        return { success: false, message: "El correo es demasiado largo (máximo 255 caracteres)" };
    }

    if (!validator.isEmail(correo)) {
        return { success: false, message: "Correo electrónico no válido" };
    }
    
    if (/[A-Z]/.test(correo)) {
        return { success: false, message: "El correo debe estar en minúsculas" };
    }

    return { success: true, message: "Correo válido" };
}

function comprobar_apodo(apodo) {
    if (typeof apodo !== 'string') return { success: false, message: "Investigación de tipos no autorizada" };

    if (!validator.isAlphanumeric(apodo, 'es-ES', { ignore: '_-' })) {
        return { success: false, message: "Apodo: solo letras, números, guión y guión bajo" };
    }
    
    if (apodo.length < 3 || apodo.length > 20) {
        return { success: false, message: "Apodo: debe tener entre 3 y 20 caracteres" };
    }

    return { success: true, message: "Apodo válido" };
}

async function comprobar_contraseña_cuenta(contraseña) {
    const correo = storage.getCorreoSesion()
    const usuario_data = await User.findOne({ correo_hash: hashDatosSistema(correo) }).lean();
    if (!usuario_data) return false
    const ok = await compare(String(contraseña), usuario_data.contrasena);
    return ok
}

//aqui se valida que haya un mensaje que enviar, pero no protege al usuario
function comprobarContrasenaValidaciones(contraseña) {
    if (typeof contraseña !== 'string') return { success: false, message: "Investigación de tipos no autorizada" };
    
    if (contraseña.length < 8) {
        return { success: false, message: "La contraseña debe tener al menos 8 caracteres" };
    }

    if (contraseña.length > 128) {
        return { success: false, message: "La contraseña es demasiado larga (máximo 128 caracteres)" };
    }

    return { success: true, message: "Contraseña válida" };
}

function comprobar_idAmigo(idAmigo) {
    if (typeof idAmigo !== 'string') return { success: false, message: "ID de amigo no válido" };
    
    // Formato: 10 caracteres, hexadecimal, mayúsculas
    const regex = /^[0-9A-F]{10}$/;
    if (!regex.test(idAmigo)) {
        return { success: false, message: "El ID de amigo debe ser de 10 caracteres hexadecimales (0-9, A-F) en mayúsculas" };
    }
    
    return { success: true, message: "ID de amigo válido" };
}

function comprobar_codigo_verificacion(codigo) {
    const codStr = String(codigo);
    if (codStr.length !== 6 || !validator.isNumeric(codStr)) {
        return { success: false, message: "El código de verificación deben ser 6 dígitos numéricos" };
    }
    return { success: true, message: "Código válido" };
}

function comprobar_mensaje(mensaje) {
    if (typeof mensaje !== 'string') return { success: false, message: "Mensaje no válido" };
    
    const trimMsg = mensaje.trim();
    if (trimMsg.length === 0) {
        return { success: false, message: "El mensaje no puede estar vacío" };
    }
    
    if (mensaje.length > 1000) {
        return { success: false, message: "El mensaje es demasiado largo (máximo 1000 caracteres)" };
    }
    
    return { success: true, message: "Mensaje válido" };
}

function comprobar_nombre_archivo(nombre) {
    if (typeof nombre !== 'string') return { success: false, message: "Nombre de archivo no válido" };
    
    const trimNombre = nombre.trim();
    if (trimNombre.length === 0) {
        return { success: false, message: "El nombre de archivo no puede estar vacío" };
    }
    
    if (nombre.length > 255) {
        return { success: false, message: "El nombre de archivo es demasiado largo (máximo 255 caracteres)" };
    }

    // Caracteres no permitidos en la mayoría de sistemas de archivos
    const regexIlegal = /[\\/:*?"<>|]/;
    if (regexIlegal.test(nombre)) {
        return { success: false, message: "El nombre de archivo contiene caracteres no permitidos" };
    }
    
    return { success: true, message: "Nombre de archivo válido" };
}

export {
    comprobar_contraseña_cuenta,
    comprobarContrasenaValidaciones,
    comprobar_apodo,
    comprobaciones_Correo,
    comprobar_idAmigo,
    comprobar_codigo_verificacion,
    comprobar_mensaje,
    comprobar_nombre_archivo
}