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
    token: {
        type: String
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

const User = mongoose.model("User", UserSchema, "usuarios");
const ValidationCode = mongoose.model("ValidationCode", ValidationCodeSchema, "validationcodes");

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
}
async function InsertarValidationCode({ correo = null, code = null }) {
    if (!correo || !code) { throw new Error("Faltan datos para insertar codigo"); }

    await ValidationCode.create({
        code: code,
        correo: correo
    });

    console.log("Usuario insertado correctamente");
}
async function LoginConCredenciales({ correo = null, contraseña = null, token =null }) {
    if (token  && correo) {//validar por token + correo
        const usuario = await User.findOne({ token });
        if (!usuario) throw new Error("Sesión expirada");
        if (!(usuario.correo === correo)) throw new Error("Credenciales incorrectas");
        return { apodo: usuario.apodo, correo: usuario.correo };
    }

    if (!correo || !contraseña) throw new Error("Faltan datos para iniciar sesión");
    //validar por credenciales correo + contraseña
    const usuario = await User.findOne({ correo: correo });
    if (!usuario) throw new Error("Credenciales incorrectas");

    const ok = await bcrypt.compare(contraseña, usuario.contrasena);
    if (!ok) throw new Error("Credenciales incorrectas");

    return { apodo: usuario.apodo, correo: usuario.correo };
}
async function BorrarValidationCodes(correo) {
    await ValidationCode.deleteMany({ correo: correo });
}
async function LimpiarJWTUsuario(correo) {
    await User.updateOne(
        { correo },
        { $unset: { token: "" } }
    );
}
async function closeDB() {
    await mongoose.disconnect();
}

module.exports = { connectDB, closeDB, InsertarUsuario, LoginConCredenciales, LimpiarJWTUsuario, InsertarValidationCode, BorrarValidationCodes, User, ValidationCode }