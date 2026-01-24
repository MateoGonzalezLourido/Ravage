// backend/services/users.js
const { InsertarUsuario, LoginConCredenciales, User, ValidationCode, LimpiarJWTUsuario, BorrarValidationCodes, InsertarValidationCode, InsertarCuentaValidationCode, BorrarCuentaValidationCodes, InsertarUsuarioActivo, CuentaValidationCode, BorrarUsuarioActivo, AñadirJWTUsuario, AñadirJWTUsuarioVerificacionCuenta, LimpiarJWTUsuarioVerificacionCuenta, generateTokenCuentaValidation } = require('../db/mongo.js')
const bcrypt = require('bcryptjs')
const { saveSession, readSession, clearSession, generateToken, validateToken, saveOmitirVerificacionCuenta, readOmitirVerificacionCuenta, clearVerificacionCuenta } = require('./controladorArchivosSesion.js')
const { enviarEmail, generarCodigo } = require('./Servicio_mensajeria_correo.js')
const state = require('../STATE/Variables_sesion.js')

async function AUTO_LOGIN_USUARIO() {
    //leer fichero con datos de sesion anterior
    const data = readSession()
    //verificar si son legitimos los datos
    if (!data || (!data.username || !data.token)) return false; //fichero vacio o faltan datos

    const resultado = comprobaciones_Correo(data.username)
    if (!resultado.success) {
        clearSession(); // datos corruptos → limpiar sesión
        return { success: false }
    }
    const token_valido = validateToken(data.token);
    if (!token_valido) {
        LimpiarJWTUsuario(result.correo, data.token)//limpiar token de mongodb
        clearSession(); // datos incorrectos → limpiar sesión
        console.log("Token invalido o expirado")
        return { success: false };
    }
    // verificar si esa cuenta sigue existiendo en la base de datos
    const result = await LoginConCredenciales({ correo: data.username, token: data.token })
    state.setApodoSesion(data.apodo)
    //mostrar como usuario activo en mongodb
    if (result.apodo && result.correo) {//tenemos todos los datos correctos
        state.setCorreoSesion(result.correo)
        const nuevoUsuarioActivo = await InsertarUsuarioActivo({ correo: data.username });
        state.setIdSesion(nuevoUsuarioActivo)
        return true;
    }
    else {
        LimpiarJWTUsuario(result.correo, data.token)//limpiar token de mongodb
        clearSession(); // datos incorrectos → limpiar sesión
        console.log("Error en auto login: datos recibidos incorrectos")
        return false;
    }
}

let contraseña_hashed;
let apodo_usuario;
let mantener_sesion_iniciada_usuario;
const n_intentos_codigo_validacion = 7;
let intentos_codigo_validacion = n_intentos_codigo_validacion;

async function registerUsuario({ apodo = "Usuario", correo = null, password = null }) {
    if (!correo || !password) return { success: false, message: "Faltan datos para registrar el usuario" }

    const resultado = comprobaciones_Correo(correo)
    if (!resultado.success) return { success: false, message: resultado.message }
    //verificar si no existe un usuario igual
    const existe = await User.findOne({ correo: correo });
    if (existe) return { success: false, message: "Correo ya registrado" };

    contraseña_hashed = await bcrypt.hash(password, 10);//contraseña hasheada
    apodo_usuario = apodo

    //crear verificacion por codigo de correo
    const code_generado = String(generarCodigo())
    const hashed_ValidationCode = await bcrypt.hash(code_generado, 10)
    //const hashedValidationCode = await bcrypt.hash(ValidationCode, 10)
    const asunto = "Verificación de correo"
    const htmlContenido = `<span style="text-decoration:underline">Hola, ${apodo}</span>
    <span style="font-size:20px">Codigo de verificacion de correo:</br><font style="color:green">${code_generado}</font></span>
    <span>Si no has sido tú puedes decírnoslo por este correo.</span>
    <span style="font-style: italic;color=gray">AVISO: Este código caducará en 10minutos, así que te recomendamos que hagas la verificación lo antes posible.</span>
    <span>Mateo's Stage</span>`
    InsertarValidationCode({ correo: correo, code: hashed_ValidationCode })
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    intentos_codigo_validacion = n_intentos_codigo_validacion //intentos para poder poner el codigo correcto de verificacion
    return { success: true }
}

async function ValidarCodeRegistroUsuario({ correo, code }) {
    intentos_codigo_validacion--
    if (intentos_codigo_validacion < 0) { return { success: false, message: "Fallo al crear el usuario:intentos acabados" } }
    //cojer el ultimo codigo generado
    const code_db = await ValidationCode.find({ correo })
        .sort({ expira: -1 }).limit(1);
    if (!code_db) {
        contraseña_hashed = null;
        apodo_usuario = null;
        return { success: false, message: "Fallo al crear el usuario:datos no encontrados" };
    }
    const ok = await bcrypt.compare(String(code), code_db[0].code);
    if (!ok) {
        console.log(`Código incorrecto, intentos restantes: ${intentos_codigo_validacion}`)
        return { success: false, message: "Fallo al crear el usuario:codigo incorrecto", intentos: intentos_codigo_validacion };
    };
    const nuevoUsuario = await InsertarUsuario({ apodo: apodo_usuario, contraseña: contraseña_hashed, correo: correo });//crear usuario en DB
    if (!nuevoUsuario) {
        BorrarValidationCodes(correo)//borrar codigos
        contraseña_hashed = null;
        apodo_usuario = null;
        return {
            success: false, message: "Fallo al crear el usuario"
        }
    }

    //limpiar datos y enviar correo de confirmacion
    contraseña_hashed = null;
    BorrarValidationCodes(correo)//borrar codigos
    //mandar correo confirmando creacion de cuenta
    const asunto = "Confirmación de cuenta"
    const htmlContenido = `<span>¡Bienvenido a RAVAGE, ${apodo_usuario}!</span>
    <span style="text-decoration:underline">Se ha creado correctamente su cuenta</span>
    <span>Si no has sido tú puedes decírnoslo por este correo.</span>`
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })

    apodo_usuario = null;

    return { success: true };
}

async function loginUsuario({ username, contraseña, mantener_sesion_iniciada = true }) {
    //limpiar cosas del registro
    if (apodo_usuario || apodo_usuario) {
        contraseña_hashed = null;
        apodo_usuario = null;
    }
    mantener_sesion_iniciada_usuario = mantener_sesion_iniciada
    const resultado = comprobaciones_Correo(username)
    if (!resultado.success) return { success: false, message: resultado.message }

    const data = await LoginConCredenciales({ correo: username, contraseña: contraseña })
    if (!data.apodo || !data.correo) return { success: false, message: 'Usuario no encontrado' }
    state.setApodoSesion(data.apodo)

    //autovalidacion del codigo de verificacion de cuenta
    const data_autoverificacion = readOmitirVerificacionCuenta()
    let autoverificacion = false
    if (data_autoverificacion) {
        const valido = validateToken(data_autoverificacion.token)
        if (valido) {
            let validado2 = false
            console.log(data)

            for (let i = 0; i < data.token_OVC.length; i++) {
                if (data_autoverificacion.token === data.token_OVC[i][0]) {
                    validado2 = true
                    break
                }
            }
            if (validado2) {
                autoverificacion = true
            }
            else {
                clearVerificacionCuenta()
            }
        }
        else {//limpiar archivo y token
            clearVerificacionCuenta()
            LimpiarJWTUsuarioVerificacionCuenta(username, data_autoverificacion.token)
        }
    }
    if (autoverificacion) {//se autovalida
        (async () => {
            const NuevoUsuarioActivo = await InsertarUsuarioActivo({ correo: data.correo });
            if (NuevoUsuarioActivo) {
                state.setIdSesion(NuevoUsuarioActivo)
            }
        })();
        //JWT , mantener sesion iniciada en cache
        (async () => {
            if (mantener_sesion_iniciada_usuario) {
                const token = generateToken(data.correo);
                saveSession({ username: data.correo, token: token })//guardar sesion en fichero local
                AñadirJWTUsuario(data.correo, token)//guardar en mongodb
            }
        })();
        state.setCorreoSesion(data.correo)
    }
    else {
        //crear verificacion por codigo de correo
        const code_generado = String(generarCodigo())
        const hashed_ValidationCode = await bcrypt.hash(code_generado, 10)
        const asunto = "Verificación de cuenta"
        const htmlContenido = `<span style="text-decoration:underline">Hola, ${data.apodo}</span>
        <span style="font-size:20px">Codigo de verificacion de cuenta:</br><font style="color:green">${code_generado}</font></span>
        <span>Debes usar este código para poder iniciar sesión.</span>
        <span>Si no has sido tú puedes decírnoslo por este correo.</span>
        <span style="font-style: italic;color=gray">AVISO: Este código caducará en 10minutos, así que te recomendamos que hagas la verificación lo antes posible.</span>
        <span>Mateo's Stage</span>`
        InsertarCuentaValidationCode({ correo: username, code: hashed_ValidationCode })
        enviarEmail({ correoDestino: username, asunto: asunto, htmlContenido: htmlContenido })

        intentos_codigo_validacion = n_intentos_codigo_validacion //intentos para poder poner el codigo correcto de verificacion
    }

    return { success: true, autoverificacion: autoverificacion, data: { correo: username, apodo: data.apodo } }
}

async function ValidarCodeLogin({ correo, code }) {
    intentos_codigo_validacion--
    if (intentos_codigo_validacion < 0) { return { success: false, message: "Fallo al iniciar sesion:intentos acabados" } }
    //cojer el ultimo codigo generado
    const code_db = await CuentaValidationCode.find({ correo })
        .sort({ expira: -1 }).limit(1);
    if (!code_db) {
        mantener_sesion_iniciada_usuario = null
        return { success: false, message: "Fallo al iniciar sesion:datos no encontrados" };
    }
    const ok = await bcrypt.compare(String(code), code_db[0].code);
    if (!ok) {
        console.log(`Código incorrecto, intentos restantes: ${intentos_codigo_validacion}`)
        return { success: false, message: "Fallo al iniciar sesion:codigo incorrecto", intentos: intentos_codigo_validacion };
    };
    //mostrar como usuario activo en mongodb
    (async () => {
        const NuevoUsuarioActivo = await InsertarUsuarioActivo({ correo: correo });
        if (NuevoUsuarioActivo) {
            state.setIdSesion(NuevoUsuarioActivo)
        }
    })();

    //JWT , mantener sesion iniciada en cache
    (async () => {
        if (mantener_sesion_iniciada_usuario) {
            const token = generateToken(correo);
            saveSession({ username: correo, token: token })//guardar sesion en fichero local
            AñadirJWTUsuario(correo, token)//guardar en mongodb
        }
    })();
    //guardar auto verificacion de cuenta en fichero local
    (async () => {
        if (mantener_sesion_iniciada_usuario) {
            const token = generateTokenCuentaValidation(correo);
            saveOmitirVerificacionCuenta({ username: correo, token: token })
            AñadirJWTUsuarioVerificacionCuenta(correo, token)//guardar en mongodb
        }
    })();
    state.setCorreoSesion(correo)
    BorrarCuentaValidationCodes(correo)//borrar codigos


    //mandar correo confirmando creacion de cuenta
    const asunto = "Alerta de sesión"
    const htmlContenido = `<span>Se ha iniciado sesión con tu cuenta</span>
    <span>Si no has sido tú puedes decírnoslo por este correo.</span>`
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })

    return { success: true, data: { correo: correo } };
}

async function cerrarSesionUsuario(correo) {
    ç
    const data = readSession()
    clearSession()//limpiar autologin
    LimpiarJWTUsuario(correo, data.token)//borrar jwt de DB
    BorrarUsuarioActivo()
    console.log("*Sesion cerrada")
}

function comprobaciones_Correo(correo) {
    let success = true;
    let message = "Username válido";
    //validaciones
    if (/[A-Z]/.test(correo)) { success = false; message = "El correo no puede contener mayúsculas"; }
    else if (correo.indexOf("@") == -1) { success = false; message = "No es un correo"; }

    //resultado
    return { success: success, message: message }
}

module.exports = { registerUsuario, loginUsuario, AUTO_LOGIN_USUARIO, cerrarSesionUsuario, ValidarCodeRegistroUsuario, ValidarCodeLogin }
