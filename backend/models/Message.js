import { mongoose } from '../utils/libs.js';

const EncryptedDataSchema = new mongoose.Schema({
    data: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true }
}, { _id: false });

const ArchivoSchema = new mongoose.Schema({
    nombre: { type: EncryptedDataSchema, default: null },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    iv: String,
    tag: String
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
    data: { type: Date, default: Date.now },
    especial: { type: mongoose.Schema.Types.Mixed, default: null },
    ratchet_info: {
        iteration: { type: Number, default: 0 },
        chain_id: { type: String, default: null } // Opcional, por si se reinicia la cadena
    }
});


const ArchivoSchemaGridfs = new mongoose.Schema({
    filename: { type: EncryptedDataSchema, default: null },

    gridfsId: mongoose.Types.ObjectId,
    size: Number,
    mimetype: String,
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});
MessageSchema.index({ id_chat: 1, data: -1 });
ArchivoSchemaGridfs.index({ filename: 1 });
export const MessagesRavage = mongoose.model("MessagesRavage", MessageSchema, "messages");
export const ArchivosRavage = mongoose.model("ArchivosRavage", ArchivoSchemaGridfs, "archivos");
