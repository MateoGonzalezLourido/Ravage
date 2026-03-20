import { mongoose } from '../utils/libs.js';

const ValidationCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        maxlength: 64 // SHA256 length
    },
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    },
    data: { // Data transitoria (hash, apodo, etc.)
        type: Object,
        default: {}
    }
});

const DatosCuentaValidationCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true
    },
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    tipo: {
        type: String,
        required: true,
        lowercase: true
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    },
    data: { // Data transitoria
        type: Object,
        default: {}
    }
});

const TokenSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    token: {
        type: String,
        required: true,
        default: ""
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
});

const TokenDPCSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    token: {
        type: String,
        required: true,
        default: ""
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
});

const DPBLOQUEADOSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
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
