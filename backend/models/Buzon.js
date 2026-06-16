import { mongoose } from '../utils/libs.js';

const EncryptedDataSchema = new mongoose.Schema({
    data: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    compressed: { type: Boolean, default: false }
}, { _id: false });

const EntradaSchema = new mongoose.Schema({
    tipo: { type: String, required: true },
    data: { type: EncryptedDataSchema, required: true }
});

const MAX_ENTRADAS = 200;

const BuzonSchema = new mongoose.Schema({
    entrada: [EntradaSchema],
    updatedAt: { type: Date, default: Date.now }
});

// TTL sobre updatedAt: elimina documentos de cuentas inactivas (sin actividad en 90 días).
// updatedAt se actualiza manualmente en cada escritura del repositorio.
BuzonSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const BuzonUsuarios = mongoose.model("BuzonUsuarios", BuzonSchema, "buzon");

export { BuzonUsuarios, MAX_ENTRADAS };
