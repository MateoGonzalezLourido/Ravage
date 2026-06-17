import { mongoose } from '../utils/libs.js';

const BloqueMembresiaSchema = new mongoose.Schema({
    entro: { type: mongoose.Schema.Types.ObjectId, default: null },
    salio: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { _id: false });

const MembresiaChatSchema = new mongoose.Schema({
    usuario_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    chat_id:    { type: mongoose.Schema.Types.ObjectId, required: true },
    bloques:    { type: [BloqueMembresiaSchema], default: [] }
});

MembresiaChatSchema.index({ usuario_id: 1, chat_id: 1 }, { unique: true });

export const MembresiaChat = mongoose.model('MembresiaChat', MembresiaChatSchema, 'membresias_chat');
