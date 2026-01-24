// backend/services/users.js
const { InsertarUsuario, LoginConCredenciales, User, LimpiarJWTUsuario, BorrarValidationCodes, InsertarValidationCode } = require('../db/mongo.js')
const bcrypt = require('bcryptjs')
const { saveSession, readSession, clearSession, generateToken, validateToken } = require('./controladorArchivosSesion.js')
const { enviarEmail, generarCodigo } = require('./Servicio_mensajeria_correo.js')

async function AUTO_LOGIN_USUARIO() {
    //leer fichero con datos de sesion anterior
    const data = readSession()
    //verificar si son legitimos los datos
    if (!data || (!data.username || !session.token)) return false; //fichero vacio o faltan datos
    const resultado = comprobaciones_Correo(data.username)
    if (!resultado.res) {
        clearSession(); // datos corruptos → limpiar sesión
        return { success: false }
    }
    const token_valido = validateToken(session.token);
    if (!token_valido) {
        clearSession(); // token inválido → limpiar sesión
        LimpiarJWTUsuario(data.username)//borrar jwt de DB
        console.log("Token inválido o expirado")
        return { success: false };
    }
    // verificar si esa cuenta sigue existiendo en la base de datos
    const { apodo, correo } = LoginConCredenciales({ correo: data.username, token: session.token })
    if (apodo && correo) {//tenemos todos los datos correctos
        return { data: { apodo, correo } }
    }
    else {
        clearSession(); // datos incorrectos → limpiar sesión
        throw new Error("Error en auto login: datos recibidos incorrectos")
    }
}

let hashed;
let apodo_usuario;
async function registerUsuario({ apodo = "Usuario", correo = null, password = null }) {
    if (!correo || !password) return { success: false, message: "Faltan datos para registrar el usuario" }

    const resultado = comprobaciones_Correo(correo)
    if (!resultado.success) return { success: false, message: resultado.message }
    //verificar si no existe un usuario igual
    const existe = await User.findOne({ email: correo });
    if (existe) return { success: false, message: "Correo ya registrado" };

    hashed = await bcrypt.hash(password, 10);//contraseña hasheada
    apodo_usuario = apodo

    //crear verificacion por codigo de correo
    const ValidationCode = String(generarCodigo())
    //const hashedValidationCode = await bcrypt.hash(ValidationCode, 10)
    const asunto = "Verificación de correo"
    const htmlContenido = `<span style="text-decoration:underline">Hola, ${apodo}</span>
    <span style="font-size:20px">Codigo de verificacion de correo:</br><font style="color:green">${ValidationCode}</font></span>
    <span>Si no has sido tú puedes decírnoslo por este correo.</span>
    <span style="font-style: italic;color=gray">AVISO: Este código caducará en 10minutos, así que te recomendamos que hagas la verificación lo antes posible.</span>
    <span>Mateo's Stage</span>`
    InsertarValidationCode({ correo: correo, code: ValidationCode })
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })

    return { success: true }
}

async function ValidarCodeRegistroUsuario({ correo, code }) {
    //TODO: ESTO DA ERROR-> code_db
    const code_db = await ValidationCode.find({ correo }).toArray();
    if (!code_db) {
        hashed = null;
        apodo_usuario = null;
        return { success: false, message: "Fallo al crear el usuario:datos no encontrados" };
    }
    const ok = false
    for (let i = 0; i < code_db.length; i++) {
        if (bcrypt.compare(code, code_db[i])) {
            ok = true
            break
        }
    }
    if (!ok) {
        hashed = null;
        apodo_usuario = null;
        BorrarValidationCodes(correo)
        return { success: false, message: "Fallo al crear el usuario:codigo incorrecto" };
    }

    const nuevoUsuario = await InsertarUsuario({ apodo: apodo_usuario, contraseña: hashed, correo: correo });//crear usuario en DB
    if (!nuevoUsuario) {
        hashed = null;
        apodo_usuario = null;
        return { success: false, message: "Fallo al crear el usuario" };
    }

    BorrarValidationCodes(correo)//borrar codigos
    hashed = null;
    apodo_usuario = null;

    return { success: true, data: { apodo_usuario, correo } };
}

async function loginUsuario({ username, contraseña }) {
    const resultado = comprobaciones_Correo(username)
    if (!resultado.res) return { success: false, message: resultado.mes }

    const { apodo, correo } = LoginConCredenciales({ correo: username, contraseña: contraseña })
    if (!apodo || !correo) return { success: false, message: 'Usuario no encontrado' }

    //crear verificacion por codigo de correo
    const ValidationCode = generarCodigo()
    const asunto = "Verificación de cuenta"
    const htmlContenido = `<span style="text-decoration:underline">Hola, ${apodo}</span>
    <span style="font-size:20px">Codigo de verificacion de cuenta:</br><font style="color:green">${ValidationCode}</font></span>
    <span>Si no has sido tú puedes decírnoslo por este correo.</span>
    <span style="font-style: italic;color=gray">AVISO: Este código caducará en 10minutos, así que te recomendamos que hagas la verificación lo antes posible.</span>
    <span>Mateo's Stage</span>`
    InsertarValidationCode({ correo: correo, code: ValidationCode })
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
}

async function ValidarCodeLogin(correo, code) {
    const code_db = await ValidationCode.find({ correo }).toArray();
    if (!code_db) return { success: false, message: "Fallo al crear el usuario:datos no encontrados" };
    const ok = false
    for (let i = 0; i < code_db.length; i++) {
        if (bcrypt.compare(code, code_db[i])) {
            ok = true
            break
        }
    }
    if (!ok) {
        BorrarValidationCodes(correo)
        return { success: false, message: "Fallo al crear el usuario:codigo incorrecto" };
    }

    //JWT 
    const token = generateToken(username);
    saveSession({ username: correo, token: token })//guardar sesion en fichero local

    BorrarValidationCodes(correo)//borrar codigos

    return { success: true, data: { apodo, correo } }
}

async function cerrarSesionUsuario(correo) {
    clearSession()//limpiar autologin
    LimpiarJWTUsuario(correo)//borrar jwt de DB

    console.log("*Sesion cerrada")
}

function comprobaciones_Correo(correo) {
    let success = true;
    let message = "Username válido";
    const partes_correo = correo.split("@");
    //validaciones
    if (/[A-Z]/.test(correo)) { success = false; message = "El correo no puede contener mayúsculas"; }
    else if (correo.indexOf("@") == -1) { success = false; message = "No es un correo"; }

    //resultado
    return { success: success, message: message }
}

module.exports = { registerUsuario, loginUsuario, AUTO_LOGIN_USUARIO, cerrarSesionUsuario, ValidarCodeRegistroUsuario, ValidarCodeLogin }
