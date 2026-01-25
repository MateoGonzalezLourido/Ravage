// backend/services/sessionFile.js
const fs = require("fs")
const path = require('path');
const dotenv = require("dotenv");
dotenv.config();
const jwt = require('jsonwebtoken');
const { app } = require('electron')

const SECRET_KEY_JWT = process.env.SECRET_KEY_JWT;

const ruta_app_data = app.getPath('userData')
const name_carpeta = '.APP_DATA'
const RTDF = {
    sessionDir: path.join(ruta_app_data, name_carpeta),
    sessionFile: path.join(ruta_app_data, name_carpeta, 'sesionfile.json'),
    omitirVerificacionCuentaFile: path.join(ruta_app_data, name_carpeta, 'auto_login.json')
}

async function saveSession({ username, token = "" }) {//guardar/ crear archivo
    const data = { username, token };
    if (!fs.existsSync(RTDF.sessionDir)) fs.mkdirSync(RTDF.sessionDir, { recursive: true });

    fs.writeFile(RTDF.sessionFile, JSON.stringify(data), "utf8", (err) => {
        if (err) {
            clearSession()
            console.error("Error al guardar sesión:", err);
        }
    });
    console.log("cache de sesion actualizada")
}
function readFileSession(ruta) {
    if (!fs.existsSync(RTDF[ruta])) return null;
    const raw = fs.readFileSync(RTDF[ruta], 'utf8');
    if (!raw) return null;

    const data = JSON.parse(raw);
    // devuelves objeto {username, token} o null
    if (data.username && data.token) return data;
    return null;
}

async function clearFileSession(ruta) {//borrar archivo
    if (fs.existsSync(RTDF[ruta])) {
        fs.unlinkSync(RTDF[ruta]);
    }
}

/*CREAR GUARDADO DE OMITIR VERIFIACION DE CUENTA */
async function saveOmitirVerificacionCuenta({ username, token = "" }) {//guardar/ crear archivo
    const data = { username, token };
    if (!fs.existsSync(RTDF.sessionDir)) fs.mkdirSync(RTDF.sessionDir, { recursive: true });
    fs.writeFile(RTDF.omitirVerificacionCuentaFile, JSON.stringify(data), "utf8", (err) => {
        if (err) {
            clearVerificacionCuenta()
            console.error("Error al guardar autoverifiacion de cuenta:", err);
        }
    });
    console.log("cache de autoverifiacion de cuenta actualizada")
}

/*JWT */

function generateToken(username) {
    return jwt.sign(
        { username },           // payload
        SECRET_KEY_JWT,             // clave secreta
        { expiresIn: '7d' }    // duración del token
    );
}
function generateTokenCuentaValidation(username) {
    return jwt.sign(
        { username },           // payload
        SECRET_KEY_JWT,             // clave secreta
        { expiresIn: '1h30m' }    // duración del token
    );
}
function validateToken(token) {
    try {
        const decoded = jwt.verify(token, SECRET_KEY_JWT);
        return decoded.username; // si válido, devuelve username
    } catch {
        return null; // token inválido o expirado
    }
}

module.exports = {
    saveSession,
    clearFileSession,
    readFileSession,
    generateToken,
    validateToken,
    saveOmitirVerificacionCuenta,
    generateTokenCuentaValidation
};