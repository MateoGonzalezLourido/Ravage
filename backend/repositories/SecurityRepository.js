import { ValidationCode, CuentaValidationCode, DatosCuentaVC, TokenSession, TokenVC, TokenDPC, DispositivosBloqueados } from '../models/Security.js';
import { createHash } from '../utils/libs.js';

export async function InsertarVC({ correo, code, id }) {
    const codehash = createHash("sha256").update(code).digest("hex");
    try {
        await ValidationCode.create({ code: codehash, correo, id_dp: id });
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function InsertarCuentaVC({ correo, code, id }) {
    const codehash = createHash("sha256").update(code).digest("hex");
    try {
        await CuentaValidationCode.create({ code: codehash, correo, id_dp: id });
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

export async function LimpiarJWTUsuario(correo, token) {
    const tokenhash = createHash("sha256").update(token).digest("hex");
    await TokenSession.deleteMany({ correo, token: tokenhash });
}
// ... more security helpers
