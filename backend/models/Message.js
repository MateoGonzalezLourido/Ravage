import { mongoose } from '../utils/libs.js';

const EncryptedDataSchema = new mongoose.Schema({
    data: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    compressed: { type: Boolean, default: false }
}, { _id: false });

const ArchivoSchema = new mongoose.Schema({
    nombre: { type: EncryptedDataSchema, default: null },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    iv: String,
    tag: String,
    key_enc: { type: EncryptedDataSchema, default: null }
}, { _id: false });

// Clave del mensaje (messageKey del ratchet) envuelta con la clave pública X25519 de UN
// participante. Mismo formato que `ratchet_keys.clave_envuelta` en Chat.js.
// Sustituye al antiguo `key_enc`/`asunto` cifrados con INTERNAL_ENCRYPTION_KEY: aquella copia
// era legible por cualquiera que tuviese la clave maestra (idéntica en todas las
// instalaciones), lo que anulaba la garantía E2EE. Aquí solo el titular de la clave privada
// correspondiente puede desenvolverla, y sirve igual para recuperar el mensaje cuando el
// estado del ratchet se desincroniza.
const ClaveRecuperacionSchema = new mongoose.Schema({
    usuario_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    clave: {
        ephPub: { type: String, required: true },
        iv: { type: String, required: true },
        data: { type: String, required: true },
        tag: { type: String, required: true },
        _id: false
    }
}, { _id: false });

const MessageSchema = new mongoose.Schema({
    id_chat: { type: mongoose.Schema.Types.ObjectId, required: true },
    emisor: { type: mongoose.Schema.Types.ObjectId, required: true },
    contenido: {
        type: [{
            asunto: { type: EncryptedDataSchema, default: null },
            archivos: {
                type: [ArchivoSchema],
            }
        }],
        default: []
    },

    encriptado: {
        iv: String,
        tag: String,
        data: String // Contenido cifrado (JSON stringified content)
    },
    // Escrow de la clave del mensaje, una entrada por participante del chat.
    claves_recuperacion: { type: [ClaveRecuperacionSchema], default: [] },
    data: { type: Date, default: Date.now },
    especial: { type: mongoose.Schema.Types.Mixed, default: null },
    ratchet_info: {
        iteration: { type: Number, default: 0 },
        chain_id: { type: String, default: null } // Opcional, por si se reinicia la cadena
    }
});

MessageSchema.index({ id_chat: 1, data: -1 });
MessageSchema.index({ data: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
export const MessagesRavage = mongoose.model("MessagesRavage", MessageSchema, "messages");
