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
    token: {
        type: [String],
        default: []
    },
    token_OVC: {
        type: [String],
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
        default: () => new Date(Date.now() + 10 * 60 * 1000)
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
//las tablas de datos de Ravage
const User = mongoose.model("User", UserSchema, "usuarios");
const ValidationCode = mongoose.model("ValidationCode", ValidationCodeSchema, "validationcodes");
const CuentaValidationCode = mongoose.model("CuentaValidationCode", ValidationCodeSchema, "cuentavalidationcode");
const ActiveUser = mongoose.model("ActiveUser", ActiveUserSchema, "usuariosactivos");

//conectar db
async function connectDB() {
    await mongoose.connect(process.env.URI_MONGODB);
    console.log("-Conectado a MongoDB");
}
//cerrar db
async function closeDB() {
    await mongoose.disconnect();
    console.log("-Cerrado MongoDB");
}
//loging usuario
async function LoginUsuario({ correo = null, contraseña = null, token = null }) {
    if (token && correo) {//validar por token + correo
        //obtener usuario+datos
        const usuario_datos = (await User.find({ correo }).limit(1))[0]
        if (!usuario_datos) {
            console.log("LOG, NO SE HAN ENCONTRADO DATOS DEL USUARIO")
            return {}
        }
        //validar token
        let validado = false
        for (let i = 0; i < usuario_datos.token.length; i++) {
            if (token === usuario_datos.token[i]) {
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
    await User.updateOne(
        { correo },
        { $push: { token: token } }
    );
}
async function AñadirJWTUsuarioVC(correo, token = "") {
    await User.updateOne(
        { correo },
        { $push: { token_OVC: token } }
    );
}
//limpiar tokens
async function LimpiarJWTUsuario(correo, token = "") {
    await User.updateOne(
        { correo },
        { $pull: { tokens: token } }
    );
}
async function LimpiarJWTUsuarioVC(correo, token = "") {
    await User.updateOne(
        { correo },
        { $pull: { token_OVC: token } }
    );
}


module.exports = { connectDB, closeDB, InsertarUsuario, LoginUsuario, LimpiarJWTUsuario, InsertarVC, BorrarVC, User, ValidationCode, CuentaValidationCode, InsertarCuentaVC, BorrarCuentaVC, InsertarUsuarioActivo, BorrarUsuarioActivo, LimpiarJWTUsuario, AñadirJWTUsuario, AñadirJWTUsuarioVC, LimpiarJWTUsuarioVC }