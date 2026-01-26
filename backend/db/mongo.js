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
        trim: true
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
        default: () => new Date(Date.now() + 10 * 60 * 1000)
    },
    id: {
        type: String,
        required: true,
        unique: true,
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
        unique: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    token: {
        type: String,
        require: true,
        default: ""
    },
    expira: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 60 * 1000)
    }
})
//expiracion codigos y tokens
TokenSchema.index({ expira: 1 }, { expireAfterSeconds: 0 });
ValidationCodeSchema.index({ expira: 1 }, { expireAfterSeconds: 0 });
//las tablas de datos de Ravage
const User = mongoose.model("User", UserSchema, "usuarios");
const ValidationCode = mongoose.model("ValidationCode", ValidationCodeSchema, "validationcodes");
const CuentaValidationCode = mongoose.model("CuentaValidationCode", ValidationCodeSchema, "cuentavalidationcode");
const ActiveUser = mongoose.model("ActiveUser", ActiveUserSchema, "usuariosactivos");
const TokenSession = mongoose.model("TokenSession", TokenSchema, "tokensession");
const TokenVC = mongoose.model("TokenValidationAcount", TokenSchema, "tokenvalidationacount");

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
    console.warn('⚠️ MongoDB desconectado. Reconectando...');
    connectDB()
});
mongoose.connection.on('error', err => {
    console.error('MongoDB error:', err);
});
//loging usuario
async function LoginUsuario({ correo = null, contraseña = null, token = null }) {
    if (token && correo) {//validar por token + correo
        //obtener usuario+datos
        const usuario_datos = (await User.find({ correo }).limit(1))[0]
        const token_datos = (await TokenSession.find({ correo }))
        if (!usuario_datos) {
            console.log("LOG, NO SE HAN ENCONTRADO DATOS DEL USUARIO")
            return {}
        }
        if (!token_datos) {
            console.log("LOG, NO SE HA ENCONTRADO EL TOKEN")
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
            console.log("LOG, SESION EXPIRADA: TOKEN")
            return {}
        }

        if (!(usuario_datos.correo === correo)) {
            console.log("LOG, CORREOS INCORRECTOS")
            return {}
        }
        //sesion iniciada
        return usuario_datos
    }
    //log por correo y contraseña
    if (!correo || !contraseña) throw new Error("Faltan datos para iniciar sesión");
    //validar por credenciales correo + contraseña
    const usuario = (await User.find({ correo }).limit(1))[0];
    console.log(usuario)
    if (!usuario) throw new Error("Credenciales incorrectas");
    //comparar contraseña del usuario con la de la base de datos
    const ok = await bcrypt.compare(contraseña, usuario.contrasena);
    if (!ok) throw new Error("Credenciales incorrectas");
    //sesion iniciada
    console.log(`Sesion iniciada: ${usuario.apodo}`)
    return usuario
}
//instertar datos
async function InsertarUsuario({ apodo = "Usuario", contraseña, correo }) {//la contraseña ya biene hasheada
    if (!contraseña || !correo) throw new Error("Faltan datos para insertar usuario");
    await User.create({
        apodo: apodo,
        correo: correo,
        contrasena: contraseña
    });
    console.log("Usuario insertado correctamente");
    return true
}
async function InsertarVC({ correo = null, code = null }) {
    if (!correo || !code) throw new Error("Faltan datos para insertar codigo");

    await ValidationCode.create({
        code: code,
        correo: correo
    });

    console.log("Codigo insertado correctamente");
    return true
}
async function InsertarCuentaVC({ correo = null, code = null }) {
    if (!correo || !code) throw new Error("Faltan datos para insertar codigo");

    await CuentaValidationCode.create({
        code: code,
        correo: correo
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
    //exìra en 7dias
    await TokenSession.updateOne(
        { correo },
        { token: token },
        { expira: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    );
}
async function AñadirJWTUsuarioVC(correo, token = "") {
    //exìra en 90min
    await TokenVC.updateOne(
        { correo },
        { token: token },
        { expira: new Date(Date.now() + 90 * 60 * 1000) }
    );
}
//limpiar tokens
async function LimpiarJWTUsuario(correo, token = "") {
    await TokenSession.deleteMany({ correo: correo, token: token });
}
async function LimpiarJWTUsuarioVC(correo, token = "") {
    await TokenVC.deleteMany({ correo: correo, token: token });
}


module.exports = { connectDB, closeDB, InsertarUsuario, LoginUsuario, LimpiarJWTUsuario, InsertarVC, BorrarVC, User, ValidationCode, CuentaValidationCode, InsertarCuentaVC, BorrarCuentaVC, InsertarUsuarioActivo, BorrarUsuarioActivo, LimpiarJWTUsuario, AñadirJWTUsuario, AñadirJWTUsuarioVC, LimpiarJWTUsuarioVC, TokenSession, TokenVC }