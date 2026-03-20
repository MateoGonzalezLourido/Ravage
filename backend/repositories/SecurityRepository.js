import { ValidationCode, CuentaValidationCode, DatosCuentaVC, TokenSession, TokenVC, TokenDPC, DispositivosBloqueados } from '../models/Security.js';
import { createHash } from '../utils/libs.js';
import { getIdDispositivo } from '../STORAGE/Variables_sesion.js';
import { encriptarDatosSistema, desencriptarDatosSistema, hashDatosSistema } from '../services/cryptoService.js';

export async function InsertarVC({ correo, code, id, data = {} }) {
    const codehash = createHash("sha256").update(code).digest("hex");
    const correoHash = hashDatosSistema(correo);
    const idHash = hashDatosSistema(id);
    try {
        await ValidationCode.create({ 
            code: codehash, 
            correo: encriptarDatosSistema(correo), 
            correo_hash: correoHash, 
            id_dp: encriptarDatosSistema(id), 
            id_dp_hash: idHash,
            data: encriptarDatosSistema(data) 
        });
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}


export async function InsertarCuentaVC({ correo, code, id, data = {} }) {
    const codehash = createHash("sha256").update(code).digest("hex");
    const correoHash = hashDatosSistema(correo);
    const idHash = hashDatosSistema(id);
    try {
        await CuentaValidationCode.create({ 
            code: codehash, 
            correo: encriptarDatosSistema(correo), 
            correo_hash: correoHash, 
            id_dp: encriptarDatosSistema(id), 
            id_dp_hash: idHash,
            data: encriptarDatosSistema(data) 
        });
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function InsertarDatosCuentaVC({ correo, code, id, tipo }) {
    const correoHash = hashDatosSistema(correo);
    const idHash = hashDatosSistema(id);
    try {
        await DatosCuentaVC.create({ 
            code, 
            correo: encriptarDatosSistema(correo), 
            correo_hash: correoHash, 
            id_dp: encriptarDatosSistema(id), 
            id_dp_hash: idHash,
            tipo 
        });
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function BorrarVC(correo) {
    const correoHash = hashDatosSistema(correo);
    await ValidationCode.deleteMany({ correo_hash: correoHash });
}

export async function BorrarCuentaVC(correo) {
    const correoHash = hashDatosSistema(correo);
    await CuentaValidationCode.deleteMany({ correo_hash: correoHash });
}

export async function BorrarDatosCuentaVC(correo, code) {
    const correoHash = hashDatosSistema(correo);
    await DatosCuentaVC.deleteMany({ correo_hash: correoHash, code });
}

export async function BuscarVC(correo, code, id_dp) {
    const codehash = createHash("sha256").update(code).digest("hex");
    const correoHash = hashDatosSistema(correo);
    const idHash = hashDatosSistema(id_dp);
    const doc = await ValidationCode.findOne({ correo_hash: correoHash, code: codehash, id_dp_hash: idHash }).lean();
    if (doc) {
        doc.id_dp = doc.id_dp ? desencriptarDatosSistema(doc.id_dp) : "";
        doc.correo = doc.correo ? desencriptarDatosSistema(doc.correo) : "";
        doc.data = doc.data ? desencriptarDatosSistema(doc.data) : {};
    }
    return doc;
}

export async function BuscarCuentaVC(correo, code, id_dp) {
    const codehash = createHash("sha256").update(code).digest("hex");
    const correoHash = hashDatosSistema(correo);
    const idHash = hashDatosSistema(id_dp);
    const doc = await CuentaValidationCode.findOne({ correo_hash: correoHash, code: codehash, id_dp_hash: idHash }).lean();
    if (doc) {
        doc.id_dp = doc.id_dp ? desencriptarDatosSistema(doc.id_dp) : "";
        doc.correo = doc.correo ? desencriptarDatosSistema(doc.correo) : "";
        doc.data = doc.data ? desencriptarDatosSistema(doc.data) : {};
    }
    return doc;
}

// ... more security helpers

/*TOKENS JWT */
export async function AñadirJWTUsuario(correo, token = "") {
    const tokenhash = createHash("sha256").update(token).digest("hex");
    const deviceId = getIdDispositivo();
    const correoHash = hashDatosSistema(correo);
    const idHash = hashDatosSistema(deviceId);

    await TokenSession.create({
        correo: encriptarDatosSistema(correo),
        correo_hash: correoHash,
        token: tokenhash,
        expira: new Date(Date.now() + ((7 * 24 * 60 * 60 * 1000) - (90 * 60 * 1000))),
        id_dp: encriptarDatosSistema(deviceId),
        id_dp_hash: idHash
    });
}
export async function AñadirJWTUsuarioVC(correo, token = "") {
    const tokenhash = createHash("sha256").update(token).digest("hex");
    const deviceId = getIdDispositivo();
    const correoHash = hashDatosSistema(correo);
    const idHash = hashDatosSistema(deviceId);

    await TokenVC.create({
        correo: encriptarDatosSistema(correo),
        correo_hash: correoHash,
        token: tokenhash,
        expira: new Date(Date.now() + (90 * 60 * 1000)),
        id_dp: encriptarDatosSistema(deviceId),
        id_dp_hash: idHash
    });
}
export async function AñadirJWTDPConfianza(correo, token = "") {
    const tokenhash = createHash("sha256").update(token).digest("hex");
    const deviceId = getIdDispositivo();
    const correoHash = hashDatosSistema(correo);
    const idHash = hashDatosSistema(deviceId);

    await TokenDPC.create({
        correo: encriptarDatosSistema(correo),
        correo_hash: correoHash,
        token: tokenhash,
        id_dp: encriptarDatosSistema(deviceId),
        id_dp_hash: idHash
    });
}


export async function LimpiarJWTUsuario(correo, token) {
    const tokenhash = createHash("sha256").update(token).digest("hex");
    const correoHash = hashDatosSistema(correo);
    await TokenSession.deleteMany({ correo_hash: correoHash, token: tokenhash });
}
export async function LimpiarJWTUsuarioVC(correo, token = null) {
    const correoHash = hashDatosSistema(correo);
    const query = { correo_hash: correoHash };
    if (token) {
        query.token = createHash("sha256").update(token).digest("hex");
    }
    await TokenVC.deleteMany(query);
}