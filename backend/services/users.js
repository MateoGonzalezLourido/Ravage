// backend/services/users.js
const { InsertarUsuario, LoginConCredenciales, User, LimpiarJWTUsuario } = require('../db/mongo.js')
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

async function registerUsuario(apodo = "Usuario", correo = null, password = null) {
    if (!correo || !password) return { success: false, message: "Faltan datos para registrar el usuario" }
    const resultado = comprobaciones_Correo(data.correo)
    if (!resultado.res) return { success: false, message: resultado.mes }
    //verificar si no existe un usuario igual
    const existe = await User.findOne({ email: correo });
    if (existe) return { success: false, message: "Correo ya registrado" };

    const hashed = await bcrypt.hash(password, 10);//contraseña hasheada

    //crear verificacion por codigo de correo
    const ValidationCode = generarCodigo()
    const asunto = "Verificación de correo"
    const htmlContenido = `<span style="text-decoration:underline">Hola, ${apodo}</span>
    <span style="font-size:20px">Codigo de verificacion de correo:</br><font style="color:green">${ValidationCode}</font></span>
    <span>Si no has sido tú puedes decírnoslo por este correo.</span>
    <span style="font-style= italic;color=gray">AVISO: Este código caducará en 10minutos, así que te recomendamos que hagas la verificación lo antes posible.</span>
    <span>Mateo's Stage</span>`
    InsertarValidationCode({ correo: correo, code: ValidationCode })
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })


    const nuevoUsuario = await InsertarUsuario({ apodo: apodo, contraseña: hashed, correo: correo })//crear usuario en DB
    if (!nuevoUsuario) return { success: false, message: "Fallo al crear el usuario" };
    saveSession({ username: correo, token: user.token })//guardar sesion en fichero local

    return { success: true, data: { apodo, correo } };
}

async function loginUsuario(username, contraseña) {
    const resultado = comprobaciones_Correo(username)
    if (!resultado.res) return { success: false, message: resultado.mes }

    const { apodo, correo } = LoginConCredenciales({ correo: data.username, contraseña: contraseña })
    if (!apodo || !correo) return { success: false, message: 'Usuario no encontrado' }

    //crear verificacion por codigo de correo
    const ValidationCode = generarCodigo()
    const asunto = "Verificación de cuenta"
    const htmlContenido = `<span style="text-decoration:underline">Hola, ${apodo}</span>
    <span style="font-size:20px">Codigo de verificacion de cuenta:</br><font style="color:green">${ValidationCode}</font></span>
    <span>Si no has sido tú puedes decírnoslo por este correo.</span>
    <span style="font-style= italic;color=gray">AVISO: Este código caducará en 10minutos, así que te recomendamos que hagas la verificación lo antes posible.</span>
    <span>Mateo's Stage</span>`
    InsertarValidationCode({ correo: correo, code: ValidationCode })
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })

    //JWT 
    const token = generateToken(username);
    saveSession(username, token)// guardamos token en JSON

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
    else if (data.username.indexOf("@") == -1) { success = false; message = "No es un correo"; }
    else if (partes_correo.length = 2 && partes_correo[0].length <= 64 && partes_correo[1].length <= 255) { success = false; message = "El correo no cumple la estrucutra propia de este"; }
    //resultado
    return { success: success, message: message }
}

module.exports = { registerUsuario, loginUsuario, AUTO_LOGIN_USUARIO, cerrarSesionUsuario }
