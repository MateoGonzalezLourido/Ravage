const { InsertarUsuario, LoginUsuario, User, ValidationCode, LimpiarJWTUsuario, BorrarVC, InsertarVC, InsertarCuentaVC, BorrarCuentaVC, InsertarUsuarioActivo, CuentaValidationCode, BorrarUsuarioActivo, AñadirJWTUsuario, AñadirJWTUsuarioVC, LimpiarJWTUsuarioVC, TokenVC, TokenSession } = require('../db/mongo.js')
const bcrypt = require('bcryptjs')
const { saveSessionFile, clearFileSession, generarteToken, validateToken, saveOmitirVerificacionCuentaFile, readFileSession } = require('./controladorArchivosSesion.js')
const { enviarEmail, generarCodigoVerificacion } = require('./MENSAJERIA/Servicio_mensajeria_correo.js')
const { ValidarCorreoEstructura, ConfirmacionCuentaCreadaEstructura, ValidarCuentaUsuario, ConfirmacionInicioSesion } = require('./MENSAJERIA/Estructuras_correos.js')
const state = require('../STORAGE/Variables_sesion.js')
const { machineIdSync } = require('node-machine-id');
const dotenv = require("dotenv");
dotenv.config();

async function autoLoginUsuario() {//aqui se usa username y correo, pero son lo mismo
    //leer fichero con datos de sesion anterior
    const data = readFileSession('sessionFile')
    //verificar si estan todos los datos
    if (!data || (!data.username || !data.token)) return { success: false }; //fichero vacio o faltan datos
    //comprobacion inicial de si es un correo
    const VCorreo = comprobaciones_Correo(data.username)
    if (!VCorreo.success) {//no es valido
        clearFileSession('sessionFile'); // datos corruptos → limpiar sesión
        return { success: false }
    }
    //token de validacion de sesion
    const token_valido = validateToken(data.token);
    if (!token_valido) {//token no valido
        LimpiarJWTUsuario(data.correo, data.token)//limpiar token de mongodb
        clearFileSession('sessionFile');// datos incorrectos → limpiar sesión
        console.log("Token invalido o expirado")
        return { success: false };
    }
    //verificar si mongodb tiene ese token
    const token_datos = (await TokenSession.find({ correo: data.username, token: data.token }))
    if (!token_datos) {
        clearFileSession('sessionFile');// datos incorrectos → limpiar sesión
        console.log("Token invalido o expirado")
        return { success: false };
    }
    // verificar si esa cuenta sigue existiendo en la base de datos
    const usuario_datos = await LoginUsuario({ correo: data.username })
    //mostrar como usuario activo en mongodb
    if (usuario_datos.apodo && usuario_datos.correo) {
        // se ha encontrado el usuario
        //establecer variables globales
        state.setApodoSesion(usuario_datos.apodo)
        state.setCorreoSesion(data.username)
            //añadir usuario activo
            (async () => {
                const NuevoUsuarioActivo = await InsertarUsuarioActivo({ correo: data.username });
                if (NuevoUsuarioActivo) {
                    //guardar id de sesion para borrar cuando deje de estarlo
                    state.setIdSesion(NuevoUsuarioActivo)
                }
            })();
        return { success: true };
    }
    else {//no se ha encontrado el usuario
        LimpiarJWTUsuario(data.username, data.token)//limpiar token de mongodb
        clearFileSession('sessionFile'); // datos incorrectos → limpiar sesión
        console.log("Error en auto login: no existe este usuario o los datos estan mal")
        return { success: false };
    }
}

//variables importantes para unir funciones log o reg con su validacion por correo
let contraseña_hashed;
let apodo_usuario;
let mantener_sesion_iniciada_usuario;
const n_intentos_codigo_validacion = 5;
let intentos_codigo_validacion = n_intentos_codigo_validacion;

async function registerUsuario({ apodo = "Usuario", correo = null, password = null }) {
    if (!correo || !password) return { success: false, message: "Faltan datos para registrar el usuario" }
    //comprobacion inicial de si es un correo
    const resultado = comprobaciones_Correo(correo)
    if (!resultado.success) return { success: false, message: resultado.message }
    //verificar si no existe un usuario igual
    const existe = await User.find({ correo: correo }).limit(1);
    if (existe) return { success: false, message: "Correo ya registrado" };

    //guardar vairables para pasarlas a la validacion por correo
    contraseña_hashed = await bcrypt.hash(password, process.env.SALTOS_ENCRIPTAR_CONTRASEÑA);//contraseña hasheada
    apodo_usuario = apodo

    //crear verificacion por codigo de correo
    const code_generado = String(generarCodigoVerificacion())
    const hashed_ValidationCode = await bcrypt.hash(code_generado, process.env.SALTOS_ENCRIPTAR_CODE)
    //generar correo
    const { asunto, htmlContenido } = ValidarCorreoEstructura({ apodo: apodo, code_generado: code_generado })
    //insertar codigo en mongodb
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
    InsertarVC({ correo: correo, code: hashed_ValidationCode, id: deviceId })
    //enviar correo
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })

    //intentos para poder poner el codigo correcto de verificacion
    intentos_codigo_validacion = n_intentos_codigo_validacion
    return { success: true }
}

async function ValidarCodeRegistroUsuario({ correo, code }) {
    intentos_codigo_validacion--
    //verificar si ya habia cabado los intentos
    if (intentos_codigo_validacion < 0) { return { success: false, message: "Fallo al crear el usuario:intentos acabados" } }
    //cojer el ultimo codigo generado
    const code_db = (await ValidationCode.find({ correo }).sort({ expira: -1 }).limit(1))[0];
    if (!code_db) {//no hay codes
        contraseña_hashed = null;
        apodo_usuario = null;
        return { success: false, message: "Fallo al crear el usuario: no hay codigos" };
    }
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
    if (deviceId !== code_db.id) {//no son el mismo dispositivo
        contraseña_hashed = null;
        apodo_usuario = null;
        return { success: false, message: "Fallo al crear el usuario: este codigo no pertenece a este dispositivo" };
    }
    //comparar codigo de usuario con el de mongodb
    const ok = await bcrypt.compare(String(code), code_db[0].code);
    if (!ok) {//no son iguales
        console.log(`Código incorrecto, intentos restantes: ${intentos_codigo_validacion}`)
        return { success: false, message: "Fallo al crear el usuario:codigo incorrecto", intentos: intentos_codigo_validacion };
    };
    //crear nueva cuenta de usuario
    const nuevoUsuario = await InsertarUsuario({ apodo: apodo_usuario, contraseña: contraseña_hashed, correo: correo });
    if (!nuevoUsuario) {//error
        BorrarVC(correo)//borrar codigos
        contraseña_hashed = null;
        apodo_usuario = null;
        return {
            success: false, message: "Fallo al crear el usuario"
        }
    }

    //mandar correo confirmando creacion de cuenta
    const { asunto, htmlContenido } = ConfirmacionCuentaCreadaEstructura(apodo_usuario)
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })
    //limpiar datos 
    BorrarVC(correo)
    apodo_usuario = null;
    contraseña_hashed = null;

    return { success: true };
}

async function loginUsuario({ username, contraseña, mantener_sesion_iniciada = true }) {//aqui se usa username en vez de correo, pero son lo mismo
    //limpiar cosas del registro si hubiese
    if (apodo_usuario || apodo_usuario) {
        contraseña_hashed = null;
        apodo_usuario = null;
    }
    //comprobacion inicial de si es un correo
    const resultado = comprobaciones_Correo(username)
    if (!resultado.success) return { success: false, message: resultado.message }

    //iniciar sesion
    const usuario_data = await LoginUsuario({ correo: username, contraseña: contraseña })
    if (!usuario_data || !usuario_data.correo) return { success: false, message: 'Usuario no encontrado' }
    state.setApodoSesion(usuario_data.apodo)
    //token
    //autovalidacion del codigo de verificacion de cuenta
    const data_autoverificacion = readFileSession("omitirVerificacionCuentaFile")
    let autoverificacion = false
    if (data_autoverificacion) {
        const valido = validateToken(data_autoverificacion.token)
        if (valido) {
            //validar token con mongodb
            const token_datos = (await TokenSession.find({ correo: usuario_data.correo, token: data_autoverificacion.token_OVC }))
            if (!token_datos) {
                clearFileSession('omitirVerificacionCuentaFile');
                return { success: false, message: 'Token no encontrado' }
            }

            let validado2 = false

            for (let i = 0; i < token_datos.token.length; i++) {
                if (data_autoverificacion.token === data.token_OVC[i]) {
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
        else {//limpiar archivo y token
            clearFileSession('omitirVerificacionCuentaFile');
            LimpiarJWTUsuarioVC(username, data_autoverificacion.token)
        }
    }
    if (autoverificacion) {//se autovalida
        (async () => {
            const NuevoUsuarioActivo = await InsertarUsuarioActivo({ correo: usuario_data.correo });
            if (NuevoUsuarioActivo) {
                state.setIdSesion(NuevoUsuarioActivo)
            }
        })();
        //JWT , mantener sesion iniciada en cache
        (async () => {
            if (mantener_sesion_iniciada) {
                const token = await generarteToken(usuario_data.correo, 'sesion');
                saveSessionFile({ username: usuario_data.correo, token: token })//guardar sesion en fichero local
                AñadirJWTUsuario(usuario_data.correo, token)//guardar en mongodb
            }
        })();
        state.setCorreoSesion(usuario_data.correo)
    }
    else {
        mantener_sesion_iniciada_usuario = mantener_sesion_iniciada
        //crear verificacion por codigo de correo
        const code_generado = String(generarCodigoVerificacion())
        const hashed_ValidationCode = await bcrypt.hash(code_generado, process.env.SALTOS_ENCRIPTAR_CODE)
        const { asunto, htmlContenido } = ValidarCuentaUsuario({ apodo: usuario_data.apodo, code: code_generado })
        //insertar codigo en mongodb
        const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
        InsertarCuentaVC({ correo: username, code: hashed_ValidationCode, id: deviceId })
        //mandar correo
        enviarEmail({ correoDestino: username, asunto: asunto, htmlContenido: htmlContenido })
        //intentos para poder poner el codigo correcto de verificacion
        intentos_codigo_validacion = n_intentos_codigo_validacion
    }

    return { success: true, autoverificacion: autoverificacion, data: { correo: username, apodo: usuario_data.apodo } }
}

async function ValidarCodeLogin({ correo, code }) {
    intentos_codigo_validacion--
    //verificar si ya habia cabado los intentos
    if (intentos_codigo_validacion < 0) { return { success: false, message: "Fallo al iniciar sesion:intentos acabados" } }
    //cojer el ultimo codigo generado
    const code_db = await CuentaValidationCode.find({ correo }).sort({ expira: -1 }).limit(1);
    if (!code_db) {//no hay codigos
        mantener_sesion_iniciada_usuario = null
        return { success: false, message: "Fallo al iniciar sesion: no hay codigos" };
    }
    const deviceId = String(machineIdSync()); // por defecto devuelve un hash único de la máquina
    if (deviceId !== code_db.id) {//no son el mismo dispositivo
        contraseña_hashed = null;
        apodo_usuario = null;
        return { success: false, message: "Fallo al iniciar sesion: este codigo no pertenece a este dispositivo" };
    }
    //comparar codigo de usuario con el de mongodb
    const ok = await bcrypt.compare(String(code), code_db[0].code);
    if (!ok) {//los codigos no son iguales
        console.log(`Código incorrecto, intentos restantes: ${intentos_codigo_validacion}`)
        return { success: false, message: "Fallo al iniciar sesion: codigo incorrecto", intentos: intentos_codigo_validacion };
    };
    //mostrar como usuario activo en mongodb
    (async () => {
        const NuevoUsuarioActivo = await InsertarUsuarioActivo({ correo: correo });
        if (NuevoUsuarioActivo) {
            //guardar id de sesion para borrar cuando deje de estarlo
            state.setIdSesion(NuevoUsuarioActivo)
        }
    })();

    //JWT , mantener sesion iniciada en cache
    (async () => {
        if (mantener_sesion_iniciada_usuario) {
            const token = await generarteToken(correo, 'sesion');
            saveSessionFile({ username: correo, token: token })//guardar sesion en fichero local
            AñadirJWTUsuario(correo, token)//guardar en mongodb
        }
    })();
    //guardar auto verificacion de cuenta en fichero local
    (async () => {
        if (mantener_sesion_iniciada_usuario) {
            const token = await generarteToken(correo, 'cuenta');
            saveOmitirVerificacionCuentaFile({ username: correo, token: token })
            AñadirJWTUsuarioVC(correo, token)//guardar en mongodb
        }
    })();
    //guardar correo en variables globales
    state.setCorreoSesion(correo)
    //borrar codigos
    BorrarCuentaVC(correo)

    //mandar correo confirmando creacion de cuenta
    const { asunto, htmlContenido } = ConfirmacionInicioSesion()
    enviarEmail({ correoDestino: correo, asunto: asunto, htmlContenido: htmlContenido })

    return { success: true, data: { correo: correo } };
}

async function cerrarSesionUsuario(correo) {
    //cojer datos del archivo de sesion para borrar el token
    const data = readFileSession('sessionFile')
    //limpiar archivo de sesion
    clearFileSession('sessionFile');
    //si existe ese archivo limpiar token
    if (data) LimpiarJWTUsuario(correo, data.token)//borrar jwt de DB
    //borrar usuario activo
    BorrarUsuarioActivo()

    console.log("*Sesion cerrada")
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

module.exports = { registerUsuario, loginUsuario, autoLoginUsuario, cerrarSesionUsuario, ValidarCodeRegistroUsuario, ValidarCodeLogin }
