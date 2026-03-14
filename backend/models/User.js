import { mongoose } from '../utils/libs.js';

const ChatUsuarioSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    grupo: { type: Boolean, default: false },
    ultimoCambio: { type: Date, default: Date.now },
    ultimomensaje: { type: String, default: "" },
    fijado: { type: Boolean, default: false }
}, { _id: false });

const ContactoUsuarioSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    apodo: { type: String, default: "", maxlength: 30 }
}, { _id: false });

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
        default: () => new Date(Date.now() + 1 * 60 * 60 * 1000)
    },
    exp_bloq_correo: {
        type: Date,
        default: () => new Date(Date.now() + 72 * 60 * 60 * 1000)
    },
    exp_bloq_contrasena: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
    users_bloq: {
        type: [mongoose.Schema.Types.ObjectId],
        default: []
    },
    users_silence: {
        type: [mongoose.Schema.Types.ObjectId],
        default: []
    },
    contactos: {
        type: [ContactoUsuarioSchema],
        default: []
    },
    chats: {
        type: [ChatUsuarioSchema],
        default: []
    },
    visible: {
        type: Boolean,
        default: true
    },
    mostrarCorreo: {
        type: Boolean,
        default: true
    },
    bloqueada: {
        type: Boolean,
        default: false
    },
    bloquearChatsNuevos: {
        type: Boolean,
        default: false
    },
    idamigo: {
        type: String,
        default: "",
        required: true,
        unique: true
    },
    secretKey: {
        type: String,
        default: ""
    },
    createdAt: { type: Date, default: Date.now }
});

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
});

ActiveUserSchema.index({ expira: 1 }, { expireAfterSeconds: 5 * 60 });

export const User = mongoose.model("User", UserSchema, "usuarios");
export const ActiveUser = mongoose.model("ActiveUser", ActiveUserSchema, "usuariosactivos");
