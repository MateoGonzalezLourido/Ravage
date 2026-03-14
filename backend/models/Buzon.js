import { mongoose } from '../utils/libs.js';

const EntradaSchema = new mongoose.Schema({
    tipo: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true }
});

const BuzonSchema = new mongoose.Schema({
    entrada: [EntradaSchema]
});

export const BuzonUsuarios = mongoose.model("BuzonUsuarios", BuzonSchema, "buzon");
