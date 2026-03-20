import { mongoose } from '../utils/libs.js';

const EncryptedDataSchema = new mongoose.Schema({
    data: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true }
}, { _id: false });

const ValidationCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        maxlength: 64 // SHA256 length
    },
    correo: { type: EncryptedDataSchema, required: true },
    correo_hash: { type: String, required: true, index: true },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: { type: EncryptedDataSchema, required: true },
    id_dp_hash: { type: String, required: true, index: true },
    data: { type: EncryptedDataSchema, default: null }
});

const DatosCuentaValidationCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true
    },
    correo: { type: EncryptedDataSchema, required: true },
    correo_hash: { type: String, required: true, index: true },
    tipo: {
        type: String,
        required: true,
        lowercase: true
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: { type: EncryptedDataSchema, required: true },
    id_dp_hash: { type: String, required: true, index: true },
    data: { type: EncryptedDataSchema, default: null }
});

const TokenSchema = new mongoose.Schema({
    correo: { type: EncryptedDataSchema, required: true },
    correo_hash: { type: String, required: true, index: true },
    token: {
        type: String,
        required: true,
        default: ""
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: { type: EncryptedDataSchema, required: true },
    id_dp_hash: { type: String, required: true, index: true }
});

const TokenDPCSchema = new mongoose.Schema({
    correo: { type: EncryptedDataSchema, required: true },
    correo_hash: { type: String, required: true, index: true },
    token: {
        type: String,
        required: true,
        default: ""
    },
    id_dp: { type: EncryptedDataSchema, required: true },
    id_dp_hash: { type: String, required: true, index: true }
});

const DPBLOQUEADOSchema = new mongoose.Schema({
    correo: { type: EncryptedDataSchema, required: true },
    correo_hash: { type: String, required: true, index: true },
    id_dp: { type: EncryptedDataSchema, required: true },
    id_dp_hash: { type: String, required: true, index: true }
});



TokenSchema.index({ expira: 1 }, { expireAfterSeconds: 90 * 60 });
ValidationCodeSchema.index({ expira: 1 }, { expireAfterSeconds: 10 * 60 });
DatosCuentaValidationCodeSchema.index({ expira: 1 }, { expireAfterSeconds: 10 * 60 });

export const ValidationCode = mongoose.model("ValidationCodes", ValidationCodeSchema, "validationcodes");
export const CuentaValidationCode = mongoose.model("CuentaValidationCode", ValidationCodeSchema, "cuentavalidationcode");
export const DatosCuentaVC = mongoose.model("datoscuentavc", DatosCuentaValidationCodeSchema, "datoscuentavc");
export const TokenSession = mongoose.model("tksession", TokenSchema, "tksession");
export const TokenVC = mongoose.model("tokenvcv", TokenSchema, "tokenvcv");
export const TokenDPC = mongoose.model("tokendpc", TokenDPCSchema, "tokendpc");
export const DispositivosBloqueados = mongoose.model("dpbloqueado", DPBLOQUEADOSchema, "dpbloqueado");
