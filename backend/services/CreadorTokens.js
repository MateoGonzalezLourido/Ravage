const jwt = require('jsonwebtoken');
const { machineIdSync } = require('node-machine-id');
const crypto = require("crypto")
const dotenv = require("dotenv");
dotenv.config();
const SECRET_KEY_JWT = process.env.SECRET_KEY_JWT;//codigo para crear jwt (un valor definido por mi)


/*JWT */

async function generarteToken(duracion = "cuenta") {
    const duraciones = {
        sesion: '7d',
        cuenta: '90m'
    }
    // 1. Identificador único del dispositivo
    const deviceId = String(machineIdSync());

    // 2. Token aleatorio de sesión
    const sessionToken = crypto.randomBytes(32).toString("hex");

    // 3. Hash seguro para almacenar en Mongo
    const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");

    // 5. Crear JWT que solo contiene el hash
    const jwtToken = jwt.sign(
        { payload: tokenHash, deviceId },
        SECRET_KEY_JWT,
        { expiresIn: duraciones[duracion] }
    );

    return jwtToken;
}

async function validateToken(token) {
    try {
        const decoded = jwt.verify(token, SECRET_KEY_JWT);
        return decoded.payload; // retorna el token hash
    } catch {
        return null; // token inválido o expirado
    }
}


module.exports = {
    generarteToken,
    validateToken
}