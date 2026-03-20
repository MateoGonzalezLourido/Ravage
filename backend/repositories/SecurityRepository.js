import { ValidationCode, CuentaValidationCode, DatosCuentaVC, TokenSession, TokenVC, TokenDPC, DispositivosBloqueados } from '../models/Security.js';
import { createHash } from '../utils/libs.js';
import { getIdDispositivo } from '../STORAGE/Variables_sesion.js';

export async function InsertarVC({ correo, code, id, data = {} }) {
    const codehash = createHash("sha256").update(code).digest("hex");
    try {
        await ValidationCode.create({ code: codehash, correo, id_dp: id, data });
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function InsertarCuentaVC({ correo, code, id, data = {} }) {
    const codehash = createHash("sha256").update(code).digest("hex");
    try {
        await CuentaValidationCode.create({ code: codehash, correo, id_dp: id, data });
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function InsertarDatosCuentaVC({ correo, code, id, tipo }) {
    try {
        await DatosCuentaVC.create({ code, correo, id_dp: id, tipo });
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function BorrarVC(correo) {
    await ValidationCode.deleteMany({ correo });
}

export async function BorrarCuentaVC(correo) {
    await CuentaValidationCode.deleteMany({ correo });
}

export async function BorrarDatosCuentaVC(correo, code) {
    await DatosCuentaVC.deleteMany({ correo, code });
}

export async function BuscarVC(correo, code, id_dp) {
    const codehash = createHash("sha256").update(code).digest("hex");
    return await ValidationCode.findOne({ correo, code: codehash, id_dp }).lean();
}

export async function BuscarCuentaVC(correo, code, id_dp) {
    const codehash = createHash("sha256").update(code).digest("hex");
    return await CuentaValidationCode.findOne({ correo, code: codehash, id_dp }).lean();
}

// ... more security helpers

/*TOKENS JWT */
export async function AñadirJWTUsuario(correo, token = "") {
    //exìra en 7dias, expira= (7dias - 90min del expire de mongo)
    const tokenhash = createHash("sha256").update(token).digest("hex");
    const deviceId = getIdDispositivo()

    await TokenSession.create({
        correo,
        token: tokenhash,
        expira: new Date(Date.now() + ((7 * 24 * 60 * 60 * 1000) - (90 * 60 * 1000))),
        id_dp: deviceId
    });

}
export async function AñadirJWTUsuarioVC(correo, token = "") {
    //exìra en 90min
    const tokenhash = createHash("sha256").update(token).digest("hex");
    const deviceId = getIdDispositivo()

    await TokenVC.create({
        correo,
        token: tokenhash,
        expira: new Date(Date.now() + (90 * 60 * 1000)),
        id_dp: deviceId
    });
}
export async function AñadirJWTDPConfianza(correo, token = "") {
    const tokenhash = createHash("sha256").update(token).digest("hex");
    const deviceId = getIdDispositivo();

    await TokenDPC.create({
        correo,
        token: tokenhash,
        id_dp: deviceId
    });
}


export async function LimpiarJWTUsuario(correo, token) {
    const tokenhash = createHash("sha256").update(token).digest("hex");
    await TokenSession.deleteMany({ correo, token: tokenhash });
}
export async function LimpiarJWTUsuarioVC(correo, token = null) {
    const query = { correo };
    if (token) {
        query.token = createHash("sha256").update(token).digest("hex");
    }
    await TokenVC.deleteMany(query);
}