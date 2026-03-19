import { mongoose } from '../utils/libs.js';

const ChatSchema = new mongoose.Schema({
    nombre: {
        type: String,
        default: ""
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
    claves_cifradas: [{
        usuario_id: mongoose.Schema.Types.ObjectId,
        clave_envuelta: String // ChatKey cifrada con la RSA pública del usuario
    }],
    fecha_creacion: { type: Date, default: Date.now }
});

export const ChatsRavage = mongoose.model("ChatsRavage", ChatSchema, "chats");
