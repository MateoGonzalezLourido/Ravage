import { mongoose } from '../utils/libs.js';

const EncryptedDataSchema = new mongoose.Schema({
    data: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true }
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
    grupo: {
        type: Boolean,
        default: false
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
            ESCANER_ESTEGANOGRAFIA: true,
            ESCANER_URL: true,
            ESCANER_URL_MALICIOSA: true,
            ESCANER_XSS: true,
            ESCANER_CODIGO: true,
            ESCANER_ZALGO: true,
            ESCANER_COMANDOS_TERMINAL: true,
            ESCANER_CRYPTO_BILLETERAS: true,
            ESCANER_DIRECCIONES_IP: true,
            ESCANER_HOMOGLIFOS: true
        }
    },
    fecha_creacion: { type: Date, default: Date.now }
});



export const ChatsRavage = mongoose.model("ChatsRavage", ChatSchema, "chats");
