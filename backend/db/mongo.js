const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
dotenv.config();
const storage = require('../STORAGE/Variables_sesion.js')
const crypto = require("crypto")
const { clearFileSession } = require('../services/controladorArchivosSesion.js')
const { validateToken } = require('../services/CreadorTokens.js')
//esquemas de datos
const UserSchema = new mongoose.Schema({
    apodo: {
        type: String,
        required: true,
        minlength: 3,
        maxlength: 30,
        trim: true,
        default: "Usuario",
        match: /^[a-zA-Z0-9_-]+$/
    },
    correo: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        trim: true,
        minlength: 2,
        maxlength: 255
    },
    contrasena: {
        type: String,
        required: true,
        minlength: 5,
        trim: true,
    },
    exp_bloq_apodo: {
        type: Date,
        default: () => new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hora después
    },
    exp_bloq_correo: {
        type: Date,
        default: () => new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 horas después
    },
    exp_bloq_contrasena: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas después
    },
    users_bloq: {
        type: [[mongoose.Schema.Types.ObjectId]],
        default: []
    },
    users_silence: {
        type: [[mongoose.Schema.Types.ObjectId]],
        default: []
    },
    contactos: {
        type: [{
            id: { type: mongoose.Schema.Types.ObjectId, required: true },
            apodo: { type: String, default: "" }
        }],
        default: []
    },
    chats: {
        type: [mongoose.Schema.Types.ObjectId],
        default: []
    },
    visible: {
        type: Boolean,
        default: true
    },
    bloqueada: {
        type: Boolean,
        default: false
    },
    secretKey: {
        type: String,
        default:""
    },
    createdAt: { type: Date, default: Date.now }
})
const ValidationCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true
    },
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
})
const DatosCuentaValidationCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        minlength: 6
    },
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    tipo: {
        type: String,
        required: true,
        lowercase: true
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
})
const ActiveUserSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: {
        type: String,
        required: true,
        default: "",
    }
})
const TokenSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    token: {
        type: String,
        required: true,
        default: ""
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
})
const TokenDPCSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    token: {
        type: String,
        required: true,
        default: ""
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
})
const DPBLOQUEADOSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
})
const ChatSchema = new mongoose.Schema({
    nombre: {//solo si es un grupo (si es de dos se coje el apodo que le tengas a ese usuario)
        type: String,
        default: ""
    },
    usuarios: {
        type: [mongoose.Schema.Types.ObjectId]
    },
    mensajes: {
        type: [
            {
                emisor: { type: [mongoose.Schema.Types.ObjectId], required: true },
                contenido: {
                    type: [{
                        asunto: { type: String, default: "" },
                        id_file: { type: String, unique: true }
                    }]
                },
                data: { type: Date, default: Date.now }
            }
        ]
    }
})
//expiracion codigos y tokens
TokenSchema.index({ expira: 1 }, { expireAfterSeconds: 90 * 60 });//90minutos
ValidationCodeSchema.index({ expira: 1 }, { expireAfterSeconds: 10 * 60 });//10minutos
ActiveUserSchema.index({ expira: 1 }, { expireAfterSeconds: 5 * 60 });//5minutos
DatosCuentaValidationCodeSchema.index({ expira: 1 }, { expireAfterSeconds: 10 * 60 });//10minutos
//las tablas de datos de Ravage
const User = mongoose.model("User", UserSchema, "usuarios");
const ValidationCode = mongoose.model("ValidationCodes", ValidationCodeSchema, "validationcodes");
const CuentaValidationCode = mongoose.model("CuentaValidationCode", ValidationCodeSchema, "cuentavalidationcode");
const DatosCuentaVC = mongoose.model("datoscuentavc", DatosCuentaValidationCodeSchema, "datoscuentavc");
const ActiveUser = mongoose.model("ActiveUser", ActiveUserSchema, "usuariosactivos");
const TokenSession = mongoose.model("tksession", TokenSchema, "tksession");
const TokenVC = mongoose.model("tokenvcv", TokenSchema, "tokenvcv");
const TokenDPC = mongoose.model("tokendpc", TokenDPCSchema, "tokendpc");
const DispositivosBloqueados = mongoose.model("dpbloqueados", DPBLOQUEADOSchema, "dpbloqueados");
const ChatRavage = mongoose.model("chats", ChatSchema, "chats");
//conectar db
async function connectDB() {
    //no se pueden poner comprobaciones de si esta conectado al iniciar la app porque tarda mucho y falla


    await mongoose.connect(process.env.URI_MONGODB, {
        tls: true,                          //usar tls
        tlsInsecure: false,                 // verifica certificados
        serverSelectionTimeoutMS: 5000,     //lo que puede tardar maximo
        socketTimeoutMS: 45000
    })
        .then(() => console.log("+ Conectado a MongoDB Atlas"))
        .catch(() => console.error("- Error de conexión"));
}
//cerrar db
async function closeDB() {
    if (!estaConectado) return;
    await mongoose.disconnect();
    console.log("- Cerrado MongoDB");
}
function estaConectado() {
    return mongoose.connection.readyState !== 0;
}

//reconectar mongo si cae
mongoose.connection.on('disconnected', () => {
    console.warn('- MongoDB desconectado.');
});
//loging usuario
async function LoginUsuarioDB({ correo = null, contraseña = null, token = null, id_dp = null }) {
    if (token && correo && id_dp) {//validar por token + correo
        //token de validacion de sesion
        let token_valido = validateToken(token);
        if (!token_valido) {//token no valido
            LimpiarJWTUsuario(correo, token)//limpiar token de mongodb (si existe)
            clearFileSession('sessionFile');// datos incorrectos → limpiar sesión
            console.error("Token invalido o expirado")
            return { success: false };
        }

        //verificar si mongodb tiene ese token
        const tokenhash = crypto.createHash("sha256").update(token).digest("hex");
        const token_datos = await TokenSession.find({ correo, token: tokenhash, id_dp })

        if (!token_datos || token_datos == [] || token_datos.length == 0) {
            clearFileSession('sessionFile');// datos incorrectos → limpiar sesión
            console.error("Token invalido o expirado")
            return { success: false };
        }

        //obtener usuario+datos
        const usuario_datos = (await User.find({ correo }).limit(1))[0]
        if (!usuario_datos || usuario_datos == [] || usuario_datos.length == 0) {
            console.error("LOG, NO SE HAN ENCONTRADO DATOS DEL USUARIO")
            return { success: false }
        }
        //sesion iniciada
        return { success: true, data: usuario_datos }
    }
    //log por correo y contraseña
    if (!correo || !contraseña) {
        console.error("Faltan datos para iniciar sesión");
        return { success: false };
    }
    //validar por credenciales correo + contraseña
    const usuario_datos = (await User.find({ correo }).limit(1))[0];
    if (!usuario_datos) {
        console.error("Credenciales incorrectas");
        return { success: false }
    }
    //comparar contraseña del usuario con la de la base de datos
    const ok = await bcrypt.compare(contraseña, usuario_datos.contrasena);
    if (!ok) {
        console.error("Credenciales incorrectas");
        return { success: false }
    }
    //sesion iniciada
    console.log(`Datos de usuario obtenidos: ${usuario_datos.apodo}`)
    return { success: true, data: usuario_datos }
}
//instertar datos
async function InsertarUsuario({ apodo = "Usuario", contraseña, correo }) {//la contraseña ya biene hasheada
    if (apodo == "") apodo = "Usuario"
    if (!contraseña || !correo) throw new Error("Faltan datos para insertar usuario");
    const key = ActualziarSecretKeyUsuario
    await User.create({
        apodo: apodo,
        correo: correo,
        contrasena: contraseña
    });
    console.log("Usuario insertado correctamente");
    return true
}
async function InsertarVC({ correo = null, code = null, id = "" }) {
    if (!correo || !code) throw new Error("Faltan datos para insertar codigo");

    const codehash = crypto.createHash("sha256").update(code).digest("hex");

    await ValidationCode.create({
        code: codehash,
        correo: correo,
        id_dp: id
    });

    console.log("Codigo insertado correctamente");
    return true
}
async function InsertarCuentaVC({ correo = null, code = null, id = "" }) {
    if (!correo || !code) throw new Error("Faltan datos para insertar codigo");

    const codehash = crypto.createHash("sha256").update(code).digest("hex");

    await CuentaValidationCode.create({
        code: codehash,
        correo: correo,
        id_dp: id
    });

    console.log("Codigo insertado correctamente");
    return true
}
async function InsertarDatosCuentaVC({ correo = null, code = null, id = "", tipo = "" }) {
    if (!correo || !code) throw new Error("Faltan datos para insertar codigo");

    await DatosCuentaVC.create({
        code: code,
        correo: correo,
        id_dp: id,
        tipo: tipo
    });

    console.log("Codigo insertado correctamente");
    return true
}
async function ActualizarUsuarioActivo({ correo = null }) {
    if (!correo) throw new Error("Faltan datos para insertar usuario activo");
    const deviceId = storage.getIdDispositivo()
    //esto lo crea si no existe
    const nuevoUsuarioActivo = await ActiveUser.updateOne(
        { correo, id_dp: deviceId },
        { $set: { expira: new Date() } },
        { upsert: true } // crea si no existe
    );

    return nuevoUsuarioActivo
}
async function añadirUsuariosBloqueados(id, apodo) {
    const correo = storage.getCorreoSesion()
    let lista_bloqueados = storage.getUsuariosBloqueados()
    const index = lista_bloqueados.findIndex(sub => sub.includes(id))
    if (index != -1) return false //ya existe

    lista_bloqueados.push([id, apodo])

    await User.updateOne(
        { correo: correo },//filtro
        {
            $set: {
                users_bloq: lista_bloqueados
            }
        },
        { upsert: false } // crea si no existe
    )
    storage.setUsuariosBloqueados(lista_bloqueados)
    return true
}
async function añadirUsuariosSilenciados(id, apodo) {
    const correo = storage.getCorreoSesion()
    let lista_silenciados = storage.getUsuariosSilence()
    const index = lista_silenciados.findIndex(sub => sub.includes(id))
    if (index != -1) return false //ya existe

    lista_silenciados.push([id, apodo])

    await User.updateOne(
        { correo: correo },//filtro
        {
            $set: {
                users_silence: lista_silenciados
            }
        },
        { upsert: false } // crea si no existe
    )
    storage.setUsuariosBloqueados(lista_silenciados)
    return true
}
//borrar datos
async function BorrarVC(correo) {
    await ValidationCode.deleteMany({ correo: correo });
}
async function BorrarCuentaVC(correo) {
    await CuentaValidationCode.deleteMany({ correo: correo });
}
async function BorrarDatosCuentaVC(correo, code) {
    await DatosCuentaVC.deleteMany({ correo: correo, code: code });
}
async function BorrarUsuarioActivo() {
    if (!estaConectado) return;

    const deviceId = storage.getIdDispositivo()
    await ActiveUser.deleteOne({ id_dp: deviceId });
}
async function eliminarUsuariosBloqueados(id) {
    const correo = storage.getCorreoSesion()
    let lista_bloqueados = storage.getUsuariosBloqueados()
    const index = lista_bloqueados.findIndex(sub => sub.includes(id))
    if (index == -1) return false

    lista_bloqueados.splice(index, 1)

    await User.updateOne(
        { correo: correo },//filtro
        {
            $set: {
                users_bloq: lista_bloqueados
            }
        },
        { upsert: false } // crea si no existe
    )
    storage.setUsuariosBloqueados(lista_bloqueados)
    return true
}
async function eliminarUsuariosSilenciados(id) {
    const correo = storage.getCorreoSesion()
    let lista_silenciados = storage.getUsuariosBloqueados()
    const index = lista_silenciados.findIndex(sub => sub.includes(id))
    if (index == -1) return false

    lista_silenciados.splice(index, 1)

    await User.updateOne(
        { correo: correo },//filtro
        {
            $set: {
                users_silence: lista_silenciados
            }
        },
        { upsert: false } // crea si no existe
    )
    storage.setUsuariosSilence(lista_silenciados)
    return true
}
//añadir tokens
async function AñadirJWTUsuario(correo, token = "") {
    //exìra en 7dias, expira= (7dias - 90min del expire de mongo)
    const tokenhash = crypto.createHash("sha256").update(token).digest("hex");
    const deviceId = storage.getIdDispositivo()

    await TokenSession.create({
        correo,
        token: tokenhash,
        expira: new Date(Date.now() + ((7 * 24 * 60 * 60 * 1000) - (90 * 60 * 1000))),
        id_dp: deviceId
    });
}
async function AñadirJWTUsuarioVC(correo, token = "") {
    //exìra en 90min
    const tokenhash = crypto.createHash("sha256").update(token).digest("hex");
    const deviceId = storage.getIdDispositivo()

    await TokenVC.create({
        correo,
        token: tokenhash,
        expira: new Date(Date.now()),
        id_dp: deviceId
    });
}
async function AñadirJWTDPConfianza(correo, token = "") {
    //exìra en 90min
    const tokenhash = crypto.createHash("sha256").update(token).digest("hex");
    const deviceId = storage.getIdDispositivo()

    await TokenDPC.create({
        correo,
        token: tokenhash,
        id_dp: deviceId
    });
}
//limpiar tokens
async function LimpiarJWTUsuario(correo, token = null) {
    if (!token) await TokenVC.deleteMany({ correo: correo })//borra todos (por segurida)
    else await TokenSession.deleteMany({ correo: correo, token: token });//borra ese solo
}
async function LimpiarJWTUsuarioVC(correo, token = null) {
    if (!token) await TokenVC.deleteMany({ correo: correo });
    else await TokenVC.deleteMany({ correo: correo, token: token });
}

//cambiar datos usuario
async function cambiarContraseñaUsuario(contraseña) {//48h para volver a cambiarla
    const correo = storage.getCorreoSesion()
    const fecha_bloqueo = new Date(Date.now() + (48 * 60 * 20 * 1000))
    await User.updateOne(
        { correo: correo },//filtro
        {
            $set: {
                contrasena: contraseña,
                exp_bloq_contrasena: fecha_bloqueo
            }
        },
        { upsert: false } // crea si no existe
    )
    storage.setFechaBloqueoContraseña(fecha_bloqueo)
    return true
}
async function cambiarCorreoUsuario(correo) {//14dias para volver a cambiarlo
    const correo_viejo = storage.getCorreoSesion()
    const fecha_bloqueo = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    //actualizar todas las tablas importantes
    await User.updateOne(
        { correo: correo_viejo },              // filtro
        {
            $set: {
                correo: correo,
                exp_bloq_correo: fecha_bloqueo // corrección a ms
            }
        },
        { upsert: false }                       // opciones
    );
    //limpiar datos relacionados con codigos y tokens
    await BorrarUsuarioActivo()
    //actualizar
    storage.setCorreoSesion(correo)
    storage.setFechaBloqueoCorreo(fecha_bloqueo)
    //limpiar
    BorrarCuentaVC(correo_viejo)
    ActualizarUsuarioActivo(correo_viejo)
    LimpiarJWTUsuarioVC(correo_viejo)
    LimpiarJWTUsuario(correo_viejo)


    return true
}
async function cambiarApodoUsuario(apodo) {//24h para vovler a cambiarlo
    const correo = storage.getCorreoSesion()
    const fecha_bloqueo = new Date(Date.now() + (24 * 60 * 20 * 1000))
    await User.updateOne(
        { correo: correo },//filtro
        {
            $set: {
                apodo: apodo,
                exp_bloq_apodo: fecha_bloqueo
            }
        },
        { upsert: false } // crea si no existe
    );
    storage.setApodoSesion(apodo)
    storage.setFechaBloqueoApodo(fecha_bloqueo)
    return true
}
async function ActualizarSecretKeyUsuario() {
    const correo = storage.getCorreoSesion()
    const key = crypto.randomBytes(32).toString("hex");
    try {
        await User.updateOne(
            { correo: correo },//filtro
            {
                $set: {
                    secretKey: key,
                }
            },
            { upsert: false } // crea si no existe
        );
        return key
    }
    catch {
        return false
    }
}

module.exports = { connectDB, closeDB, InsertarUsuario, LoginUsuarioDB, LimpiarJWTUsuario, InsertarVC, BorrarVC, User, ValidationCode, CuentaValidationCode, InsertarCuentaVC, BorrarCuentaVC, BorrarUsuarioActivo, LimpiarJWTUsuario, AñadirJWTUsuario, AñadirJWTUsuarioVC, LimpiarJWTUsuarioVC, TokenSession, TokenVC, ActualizarUsuarioActivo, cambiarContraseñaUsuario, cambiarCorreoUsuario, cambiarApodoUsuario, DatosCuentaVC, InsertarDatosCuentaVC, BorrarDatosCuentaVC, eliminarUsuariosBloqueados, eliminarUsuariosSilenciados, añadirUsuariosBloqueados, añadirUsuariosSilenciados, TokenDPC, DispositivosBloqueados, ActualizarSecretKeyUsuario }