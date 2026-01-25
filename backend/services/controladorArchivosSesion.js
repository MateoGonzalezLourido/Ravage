// backend/services/sessionFile.js
const fs = require("fs")
const path = require('path');
const dotenv = require("dotenv");
dotenv.config();
const jwt = require('jsonwebtoken');
const { app } = require('electron')
const SECRET_KEY_JWT = process.env.SECRET_KEY_JWT;
const sessionDir = path.join(app.getPath('userData'), '.APP_DATA')
const sessionFile = path.join(app.getPath('userData'), '.APP_DATA', 'sesionfile.json');// conseguir la ruta absoluta del APP_DATA ...
const omitirVerificacionCuentaFile = path.join(app.getPath('userData'), '.APP_DATA', 'auto_login.json')

async function saveSession({ username, token = "" }) {//guardar/ crear archivo
    const data = { username, token };
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    fs.writeFile(sessionFile, JSON.stringify(data), "utf8", (err) => {
        if (err) {
            clearSession()
            console.error("Error al guardar sesión:", err);
        }
    });
    console.log("cache de sesion actualizada")
}

function readSession() {//leer archivo
    if (!fs.existsSync(sessionFile)) return null;
    const raw = fs.readFileSync(sessionFile, 'utf8');
    if (!raw) return null;

    const data = JSON.parse(raw);
    // devuelves objeto {username, token} o null
    if (data.username && data.token) return data;
    return null;
}


async function clearSession() {//borrar archivo
    if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
    }
}

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
        { expiresIn: '30m' }    // duración del token
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
/*CREAR GUARDADO DE OMITIR VERIFIACION DE CUENTA */
async function saveOmitirVerificacionCuenta({ username, token = "" }) {//guardar/ crear archivo
    const data = { username, token };
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFile(omitirVerificacionCuentaFile, JSON.stringify(data), "utf8", (err) => {
        if (err) {
            clearVerificacionCuenta()
            console.error("Error al guardar autoverifiacion de cuenta:", err);
        }
    });
    console.log("cache de autoverifiacion de cuenta actualizada")
}
function readOmitirVerificacionCuenta() {//leer archivo
    if (!fs.existsSync(omitirVerificacionCuentaFile)) return null;
    const raw = fs.readFileSync(omitirVerificacionCuentaFile, 'utf8');
    if (!raw) return null;

    const data = JSON.parse(raw);
    // devuelves objeto {username, token} o null
    if (data.username && data.token) return data;
    return null;
}
async function clearVerificacionCuenta() {//borrar archivo
    if (fs.existsSync(omitirVerificacionCuentaFile)) {
        fs.unlinkSync(omitirVerificacionCuentaFile);
    }
}

module.exports = {
    saveSession,
    readSession,
    clearSession,
    generateToken,
    validateToken,
    saveOmitirVerificacionCuenta,
    readOmitirVerificacionCuenta,
    clearVerificacionCuenta,
    generateTokenCuentaValidation
};