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
    contraseña: {
        type: String,
        required: true,
        minlength: 8
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
        minlength: 8
    },
    correo: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    expira: { type: Date, default: new Date(Date.now() + 10 * 60 * 1000) }
})

const User = mongoose.model("User", UserSchema);
const ValidationCode = mongoose.model("ValidationCode", ValidationCodeSchema);

async function connectDB() {
    await mongoose.connect(uri);
    console.log("-Conectado a MongoDB");
}

async function InsertarUsuario({ apodo = "Usuario", contraseña, correo, token = "" }) {//la contraseña ya biene hasheada

    if (!contraseña || !correo) throw new Error("Faltan datos para insertar usuario");

    await User.create({
        apodo: apodo,
        correo: correo,
        contraseña: contraseña,
        token
    });

    console.log("Usuario insertado correctamente");
}
async function InsertarValidationCode({ correo = null, code = null }) {
    if (!contraseña || !code) throw new Error("Faltan datos para insertar codigo");

    await User.create({
        code: code,
        correo: correo
    });

    console.log("Usuario insertado correctamente");
}
async function LoginConCredenciales({ correo = null, contraseña = null, token = "" }) {
    if (token != "" && !correo) {//validar por token + correo
        const usuario = await User.findOne({ token });
        if (!usuario) throw new Error("Sesión expirada");
        if (!(usuario.correo === correo)) throw new Error("Credenciales incorrectas");
        return { apodo: usuario.apodo, correo: usuario.email };
    }

    if (!correo || !contraseña) throw new Error("Faltan datos para iniciar sesión");
    //validar por credenciales correo + contraseña
    const usuario = await User.findOne({ email: correo });
    if (!usuario) throw new Error("Credenciales incorrectas");

    const ok = await bcrypt.compare(contraseña, usuario.contraseña);
    if (!ok) throw new Error("Credenciales incorrectas");

    return { apodo: usuario.apodo, correo: usuario.email };
}
async function BorrarValidationCodes(correo) {
    await Verification.deleteMany({ correo: correo });
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