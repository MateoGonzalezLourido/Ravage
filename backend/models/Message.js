import { mongoose } from '../utils/libs.js';

const ArchivoSchema = new mongoose.Schema({
    nombre: { type: String, default: "_archivo_.txt", maxlength: 255 },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    iv: String,
    tag: String
}, { _id: false });

const MessageSchema = new mongoose.Schema({
    id_chat: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    emisor: { type: mongoose.Schema.Types.ObjectId, required: true },
    contenido: {
        type: [{
            asunto: { type: String, default: "", maxlength: 1000 },
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
    especial: { type: mongoose.Schema.Types.Mixed, default: null }
});

const ArchivoSchemaGridfs = new mongoose.Schema({
    filename: { type: String, maxlength: 255 },
    gridfsId: mongoose.Types.ObjectId,
    size: Number,
    mimetype: String,
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

export const MessagesRavage = mongoose.model("MessagesRavage", MessageSchema, "messages");
export const ArchivosRavage = mongoose.model("ArchivosRavage", ArchivoSchemaGridfs, "archivos");
