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
    grupo: {
        type: Boolean,
        default: false
    },
    fecha_creacion: { type: Date, default: Date.now }
});

export const ChatsRavage = mongoose.model("ChatsRavage", ChatSchema, "chats");
