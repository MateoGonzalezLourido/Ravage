import { mongoose } from '../utils/libs.js';

const EncryptedDataSchema = new mongoose.Schema({
    data: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true }
}, { _id: false });

const ChatUsuarioSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    grupo: { type: Boolean, default: false },
    ultimoCambio: { type: Date, default: Date.now },
    ultimomensaje: { type: EncryptedDataSchema, default: null },
    fijado: { type: Boolean, default: false },
    silenciado: { type: Boolean, default: false },
    bloqueado: { type: Boolean, default: false },
    mensaje_bloqueo_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    nombre_bloqueo: { type: EncryptedDataSchema, default: null },
    participantes_bloqueo: { type: [mongoose.Schema.Types.ObjectId], default: null }
}, { _id: false });

const ContactoUsuarioSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    apodo: { type: EncryptedDataSchema, default: null }
}, { _id: false });

const UserSchema = new mongoose.Schema({
    apodo: {
        type: EncryptedDataSchema,
        required: true
    },
    correo: {
        type: EncryptedDataSchema,
        required: true
    },
    correo_hash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    contrasena: {
        type: String,
        required: true,
        minlength: 8,
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
    invisible: {
        type: Boolean,
        default: false
    },
    idamigo: {
        type: EncryptedDataSchema,
        required: true
    },
    idamigo_hash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    secretKey: {
        type: String,
        default: ""
    },
    publicKey: {
        type: String,
        default: ""
    },
    createdAt: { type: Date, default: Date.now }
});


export const User = mongoose.model("User", UserSchema, "usuarios");
