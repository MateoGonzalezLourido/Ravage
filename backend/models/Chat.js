import { mongoose } from '../utils/libs.js';

const EncryptedDataSchema = new mongoose.Schema({
    data: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    compressed: { type: Boolean, default: false }
}, { _id: false });

const ChatSchema = new mongoose.Schema({
    nombre: {
        type: EncryptedDataSchema,
        default: null
    },

    usuarios: {
        type: [mongoose.Schema.Types.ObjectId],
        default: []
    },
    admins: {
        type: [mongoose.Schema.Types.ObjectId],
        default: []
    },
    ratchet_keys: [{
        emisor_id: mongoose.Schema.Types.ObjectId,
        receptor_id: mongoose.Schema.Types.ObjectId, // A quien va dirigida esta copia de la clave
        clave_envuelta: String, // ChainKey del emisor cifrada con RSA pública del receptor
        counter: { type: Number, default: 0 }
    }],
    escaneres_seguridad: {
        type: Object,
        default: {
            ESCANER_ESTEGANOGRAFIA: 1,
            ESCANER_URL: 0,
            ESCANER_URL_MALICIOSA: 1,
            ESCANER_XSS: 0,
            ESCANER_CODIGO: 0,
            ESCANER_ZALGO: 1,
            ESCANER_COMANDOS_TERMINAL: 1,
            ESCANER_CRYPTO_BILLETERAS: 1,
            ESCANER_DIRECCIONES_IP: 0,
            ESCANER_HOMOGLIFOS: 1
        }
    },
    fecha_creacion: { type: Date, default: Date.now },
    msfijado: { type: mongoose.Schema.Types.ObjectId, default: null }
});



export const ChatsRavage = mongoose.model("ChatsRavage", ChatSchema, "chats");
