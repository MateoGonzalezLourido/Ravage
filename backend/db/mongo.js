const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

dotenv.config();
const uri = process.env.URI_MONGODB;
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
    token: [{
        type: [String],
        default: []
    }],
    token_OVC: [{
        type: [String],
        default: []
    }],
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

const User = mongoose.model("User", UserSchema, "usuarios");
const ValidationCode = mongoose.model("ValidationCode", ValidationCodeSchema, "validationcodes");
const CuentaValidationCode = mongoose.model("CuentaValidationCode", ValidationCodeSchema, "cuentavalidationcode");
const ActiveUser = mongoose.model("ActiveUser", ActiveUserSchema, "usuariosactivos");

async function connectDB() {
    await mongoose.connect(uri);
    console.log("-Conectado a MongoDB");
}

async function InsertarUsuario({ apodo = "Usuario", contraseña, correo, token = "" }) {//la contraseña ya biene hasheada

    if (!contraseña || !correo) throw new Error("Faltan datos para insertar usuario");

    await User.create({
        apodo: apodo,
        correo: correo,
        contrasena: contraseña,
        token
    });

    console.log("Usuario insertado correctamente");
    return true
}
async function InsertarValidationCode({ correo = null, code = null }) {
    if (!correo || !code) { throw new Error("Faltan datos para insertar codigo"); }

    await ValidationCode.create({
        code: code,
        correo: correo
    });

    console.log("Codigo insertado correctamente");
    return true
}
async function InsertarCuentaValidationCode({ correo = null, code = null }) {
    if (!correo || !code) { throw new Error("Faltan datos para insertar codigo"); }
    await CuentaValidationCode.create({
        code: code,
        correo: correo
    });

    console.log("Codigo insertado correctamente");
    return true
}
async function InsertarUsuarioActivo({ correo = null }) {
    if (!correo) { throw new Error("Faltan datos para insertar usuario activo"); }

    const nuevoUsuarioActivo = await ActiveUser.create({
        correo: correo
    });

    console.log("Usuario activo insertado correctamente");
    return nuevoUsuarioActivo
}
async function LoginConCredenciales({ correo = null, contraseña = null, token = null }) {
    if (token && correo) {//validar por token + correo

        const usuario = await User.find({ correo }).limit(1);

        if (!usuario) {
            console.log("NO SE HAN ENCONTRADO DATOS")
            return {}
        }
        //validar token
        let validado = false
        for (let i = 0; i < usuario[0].token.length; i++) {
            if (token === usuario[0].token[i][0]) {
                validado = true
                break
            }
        }
        if (!validado) {
            console.log("SESION EXPIRADA: TOKEN")
            return {}
        }

        if (!(usuario[0].correo === correo)) {
            console.log("Correos incorrectos")
            return {}
        }
        return usuario[0]
    }

    if (!correo || !contraseña) throw new Error("Faltan datos para iniciar sesión");
    //validar por credenciales correo + contraseña
    const usuario = await User.find({ correo }).limit(1);
    if (!usuario) throw new Error("Credenciales incorrectas");

    const ok = await bcrypt.compare(contraseña, usuario[0].contrasena);
    if (!ok) throw new Error("Credenciales incorrectas");

    console.log(`Sesion iniciada: ${usuario[0].apodo}`)
    return usuario[0]
}

async function BorrarValidationCodes(correo) {
    await ValidationCode.deleteMany({ correo: correo });
}
async function BorrarCuentaValidationCodes(correo) {
    await CuentaValidationCode.deleteMany({ correo: correo });
}
async function BorrarUsuarioActivo(correo) {
    await ActiveUser.deleteMany({ _id: correo });
}
async function AñadirJWTUsuario(correo, token = "") {
    await User.updateOne(
        { correo },
        { $push: { token: token } }
    );
}
async function AñadirJWTUsuarioVerificacionCuenta(correo, token = "") {
    await User.updateOne(
        { correo },
        { $push: { token_OVC: token } }
    );
}
async function LimpiarJWTUsuario(correo, token = "") {
    await User.updateOne(
        { correo },
        { $pull: { tokens: token } }
    );
}
async function LimpiarJWTUsuarioVerificacionCuenta(correo, token = "") {
    console.log(token)
    await User.updateOne(
        { correo },
        { $pull: { token_OVC: token } }
    );
}
async function closeDB() {
    await mongoose.disconnect();
}

module.exports = { connectDB, closeDB, InsertarUsuario, LoginConCredenciales, LimpiarJWTUsuario, InsertarValidationCode, BorrarValidationCodes, User, ValidationCode, CuentaValidationCode, InsertarCuentaValidationCode, BorrarCuentaValidationCodes, ActiveUser, InsertarUsuarioActivo, BorrarUsuarioActivo, LimpiarJWTUsuario, AñadirJWTUsuario, AñadirJWTUsuarioVerificacionCuenta, LimpiarJWTUsuarioVerificacionCuenta }