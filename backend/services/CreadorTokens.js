import jwt from 'jsonwebtoken';
import pkgMachineId from 'node-machine-id';
const { machineIdSync } = pkgMachineId;
import crypto from 'crypto';
const SECRET_KEY_JWT = process.env.SECRET_KEY_JWT;//codigo para crear jwt (un valor definido por mi)


/*JWT */

export async function generarteToken(duracion = "cuenta") {
    const duraciones = {
        sesion: '7d',
        cuenta: '90m'
    }
    // 1. Identificador único del dispositivo
    const deviceId = String(machineIdSync());

    // 2. Token aleatorio de sesión
    const sessionToken = crypto.randomBytes(32).toString("hex");
    // 5. Crear JWT que solo contiene el hash
    const jwtToken = jwt.sign(
        { payload: sessionToken, deviceId },
        SECRET_KEY_JWT,
        { expiresIn: duraciones[duracion] }
    );

    return jwtToken;
}

export async function validateToken(jwtToken) {
    try {
        const decoded = jwt.verify(jwtToken, SECRET_KEY_JWT);
        return decoded;   // o true si prefieres booleano
    } catch {
        return null;
    }
}