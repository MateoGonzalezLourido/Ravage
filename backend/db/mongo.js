const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
dotenv.config();

//esquemas de datos
const UserSchema = new mongoose.Schema({
    apodo: {
        type: String,
        required: true,
        minlength: 3,
        maxlength: 30,
        trim: true,
        default: "Usuario"
    },
    correo: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    contrasena: {
        type: String,
        required: true,
        minlength: 5
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
const ActiveUserSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
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
TokenSchema.index({ expira: 1 }, { expireAfterSeconds: 90 * 60 });
ValidationCodeSchema.index({ expira: 1 }, { expireAfterSeconds: 10 * 60 });
//las tablas de datos de Ravage
const User = mongoose.model("User", UserSchema, "usuarios");
const ValidationCode = mongoose.model("ValidationCodes", ValidationCodeSchema, "validationcodes");
const CuentaValidationCode = mongoose.model("CuentaValidationCode", ValidationCodeSchema, "cuentavalidationcode");
const ActiveUser = mongoose.model("ActiveUser", ActiveUserSchema, "usuariosactivos");
const TokenSession = mongoose.model("tksession", TokenSchema, "tksession");
const TokenVC = mongoose.model("tokenvcv", TokenSchema, "tokenvcv");

//conectar db
async function connectDB() {
    //usar tls
    await mongoose.connect(process.env.URI_MONGODB, {
        tls: true,
        tlsInsecure: false,                 // verifica certificados
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
    })
        .then(() => console.log("✅ Conectado a MongoDB Atlas"))
        .catch(err => console.error("❌ Error de conexión:", err));
}
//cerrar db
async function closeDB() {
    await mongoose.disconnect();
    console.log("-Cerrado MongoDB");
}
//reconectar mongo si cae
mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB desconectado.');
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
async function InsertarUsuarioActivo({ correo = null }) {
    if (!correo) throw new Error("Faltan datos para insertar usuario activo");

    const nuevoUsuarioActivo = await ActiveUser.create({
        correo: correo
    });

    console.log("Usuario activo insertado correctamente");
    return nuevoUsuarioActivo
}
//borrar datos
async function BorrarVC(correo) {
    await ValidationCode.deleteMany({ correo: correo });
}
async function BorrarCuentaVC(correo) {
    await CuentaValidationCode.deleteMany({ correo: correo });
}
async function BorrarUsuarioActivo(correo) {
    await ActiveUser.deleteMany({ _id: correo });
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
async function LimpiarJWTUsuario(correo, token = "") {
    await TokenSession.deleteMany({ correo: correo, token: token });
}
async function LimpiarJWTUsuarioVC(correo, token = "") {
    await TokenVC.deleteMany({ correo: correo, token: token });
}


module.exports = { connectDB, closeDB, InsertarUsuario, LoginUsuario, LimpiarJWTUsuario, InsertarVC, BorrarVC, User, ValidationCode, CuentaValidationCode, InsertarCuentaVC, BorrarCuentaVC, InsertarUsuarioActivo, BorrarUsuarioActivo, LimpiarJWTUsuario, AñadirJWTUsuario, AñadirJWTUsuarioVC, LimpiarJWTUsuarioVC, TokenSession, TokenVC }