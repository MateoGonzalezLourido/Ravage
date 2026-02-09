const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
dotenv.config();
const storage = require('../STORAGE/Variables_sesion.js')
const { machineIdSync } = require('node-machine-id');
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
        type: [[String]],
        default: []
    },
    users_silence: {
        type: [[String]],
        default: []
    },
    createdAt: { type: Date, default: Date.now }
})
const ValidationCodeSchema = new mongoose.Schema({
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
async function LoginUsuario({ correo = null, contraseña = null, token = null }) {
    if (token && correo) {//validar por token + correo
        //obtener usuario+datos
        const usuario_datos = (await User.find({ correo }).limit(1))[0]
        const token_datos = (await TokenSession.find({ correo }))
        if (!usuario_datos) {
            console.error("LOG, NO SE HAN ENCONTRADO DATOS DEL USUARIO")
            return {}
        }
        if (!token_datos || token_datos == [] || token_datos.length == 0) {
            console.error("LOG, NO SE HA ENCONTRADO EL TOKEN")
            return {}
        }
        //validar token
        let validado = false
        for (let i = 0; i < token_datos.length; i++) {
            if (token === token_datos[i].token) {
                validado = true
                break
            }
        }
        if (!validado) {
            console.error("LOG, SESION EXPIRADA: TOKEN")
            return {}
        }

        if (!(usuario_datos.correo === correo)) {
            console.error("LOG, CORREOS INCORRECTOS")
            return {}
        }
        //sesion iniciada
        return usuario_datos
    }
    //log por correo y contraseña
    if (!correo || !contraseña) {
        console.error("Faltan datos para iniciar sesión");
        return;
    }
    //validar por credenciales correo + contraseña
    const usuario_datos = (await User.find({ correo }).limit(1))[0];
    if (!usuario_datos) {
        console.error("Credenciales incorrectas");
        return {}
    }
    //comparar contraseña del usuario con la de la base de datos
    const ok = await bcrypt.compare(contraseña, usuario_datos.contrasena);
    if (!ok) {
        console.error("Credenciales incorrectas");
        return {}
    }
    //sesion iniciada
    console.log(`Datos de usuario obtenidos: ${usuario_datos.apodo}`)
    return usuario_datos
}
//instertar datos
async function InsertarUsuario({ apodo = "Usuario", contraseña, correo }) {//la contraseña ya biene hasheada
    if (apodo == "") apodo = "Usuario"
    if (!contraseña || !correo) throw new Error("Faltan datos para insertar usuario");
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

    await ValidationCode.create({
        code: code,
        correo: correo,
        id_dp: id
    });

    console.log("Codigo insertado correctamente");
    return true
}
async function InsertarCuentaVC({ correo = null, code = null, id = "" }) {
    if (!correo || !code) throw new Error("Faltan datos para insertar codigo");

    await CuentaValidationCode.create({
        code: code,
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
    const deviceId = String(machineIdSync());
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

    const deviceId = String(machineIdSync());
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
    await TokenSession.create({
        correo,
        token,
        expira: new Date(Date.now() + ((7 * 24 * 60 * 60 * 1000) - (90 * 60 * 1000)))
    });
}
async function AñadirJWTUsuarioVC(correo, token = "") {
    //exìra en 90min
    await TokenVC.create({
        correo,
        token,
        expira: new Date(Date.now())
    });
}
//limpiar tokens
async function LimpiarJWTUsuario(correo, token = null) {
    if (!token) await TokenVC.deleteMany({ correo: correo });
    else await TokenSession.deleteMany({ correo: correo, token: token });
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


module.exports = { connectDB, closeDB, InsertarUsuario, LoginUsuario, LimpiarJWTUsuario, InsertarVC, BorrarVC, User, ValidationCode, CuentaValidationCode, InsertarCuentaVC, BorrarCuentaVC, BorrarUsuarioActivo, LimpiarJWTUsuario, AñadirJWTUsuario, AñadirJWTUsuarioVC, LimpiarJWTUsuarioVC, TokenSession, TokenVC, ActualizarUsuarioActivo, cambiarContraseñaUsuario, cambiarCorreoUsuario, cambiarApodoUsuario, DatosCuentaVC, InsertarDatosCuentaVC, BorrarDatosCuentaVC, eliminarUsuariosBloqueados, eliminarUsuariosSilenciados, añadirUsuariosBloqueados, añadirUsuariosSilenciados }