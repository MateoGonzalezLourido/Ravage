import { mongoose } from '../utils/libs.js';

const EncryptedDataSchema = new mongoose.Schema({
    data: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true }
}, { _id: false });

const EntradaSchema = new mongoose.Schema({
    tipo: { type: String, required: true },
    data: { type: EncryptedDataSchema, required: true }
});


const BuzonSchema = new mongoose.Schema({
    id_usuario: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    entrada: [EntradaSchema]
});

const MAX_ENTRADAS = 200;

BuzonSchema.pre('save', function (next) {
    if (this.entrada.length > MAX_ENTRADAS) {
        this.entrada = this.entrada.slice(-MAX_ENTRADAS);
    }
    next();
});

BuzonSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const BuzonUsuarios = mongoose.model("BuzonUsuarios", BuzonSchema, "buzon");
