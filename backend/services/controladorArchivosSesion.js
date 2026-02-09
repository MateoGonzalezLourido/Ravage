const fs = require("fs")
const path = require('path');
const dotenv = require("dotenv");
dotenv.config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { app } = require('electron')
const { machineIdSync } = require('node-machine-id');
const saltos_token = Number(process.env.SALTOS_ENCRIPTAR_TOKEN)
const crypto = require("crypto")
const SECRET_KEY_JWT = process.env.SECRET_KEY_JWT;//codigo para crear jwt (un valor definido por mi)

//rutas
const ruta_app_data = app.getPath('userData')
const name_carpeta = '.APP_DATA'
const RTDF = {
    sessionDir: path.join(ruta_app_data, name_carpeta),
    sessionFile: path.join(ruta_app_data, name_carpeta, 'sesionfile.json'),
    omitirVerificacionCuentaFile: path.join(ruta_app_data, name_carpeta, 'auto_login.json')
}

async function saveSessionFile({ username, token = "" }) {//guardar/ crear archivo
    const data = { username, token };
    //semiencriptar username
    //crear carpeta si no existe
    if (!fs.existsSync(RTDF.sessionDir)) fs.mkdirSync(RTDF.sessionDir, { recursive: true });
    //sobrescribir/crear archivo con los datos
    fs.writeFile(RTDF.sessionFile, JSON.stringify(data), "utf8", (err) => {
        if (err) {//si falla, limpiar si existe
            clearFileSession(username, 'sesion')
            console.error("Error al guardar sesión:", err);
        }
    });
    console.log("cache de sesion actualizada")
}
/*CREAR GUARDADO DE OMITIR VERIFIACION DE CUENTA */
async function saveOmitirVerificacionCuentaFile({ username, token = "" }) {//guardar/ crear archivo
    const data = { username, token };
    //crear carpeta si no existe
    if (!fs.existsSync(RTDF.sessionDir)) fs.mkdirSync(RTDF.sessionDir, { recursive: true });
    //sobrescribir/crear archivo con los datos
    fs.writeFile(RTDF.omitirVerificacionCuentaFile, JSON.stringify(data), "utf8", (err) => {
        if (err) {//si falla, limpiar si existe
            clearFileSession(username, 'cuenta')
            console.error("Error al guardar autoverifiacion de cuenta:", err);
        }
    });
    console.log("cache de autoverifiacion de cuenta actualizada")
}
/*generales */
function readFileSession(ruta) {
    //si no existe el archivo?
    if (!fs.existsSync(RTDF[ruta])) return null;
    //leer el archivo
    const raw = fs.readFileSync(RTDF[ruta], 'utf8');
    if (!raw) return null;//no recupero nada
    //pasarlo a json usable
    const data = JSON.parse(raw);
    // devuelves objeto {username, token} o null
    if (data.username && data.token) return data;
    return null;
}

async function clearFileSession(ruta) {//borrar archivo
    if (fs.existsSync(RTDF[ruta])) {//existe el archivo?
        fs.unlinkSync(RTDF[ruta]);//borrar archivo
    }
}

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
    saveSessionFile,
    clearFileSession,
    readFileSession,
    generarteToken,
    validateToken,
    saveOmitirVerificacionCuentaFile,
};