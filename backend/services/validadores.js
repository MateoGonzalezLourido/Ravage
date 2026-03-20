
//TODO: añadir mas verificaciones
function comprobaciones_Correo(correo) {
    if (typeof correo !== 'string') return { success: false, message: "Investigación de tipos no autorizada" };
    
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
    const usuario_data = (await User.find({ correo: correo }).limit(1))[0]
    if (!usuario_data) return false
    const ok = await compare(String(contraseña), usuario_data.contrasena);
    return ok
}
function comprobarContrasenaValidaciones(contraseña) {
    if (typeof contraseña !== 'string') return { success: false, message: "Investigación de tipos no autorizada" };
    
    if (contraseña.length < 8) {
        return { success: false, message: "La contraseña debe tener al menos 8 caracteres" };
    }

    return { success: true, message: "Contraseña válida" };
}
export{
    comprobar_contraseña_cuenta,
    comprobarContrasenaValidaciones,
    comprobar_apodo,
    comprobaciones_Correo
}