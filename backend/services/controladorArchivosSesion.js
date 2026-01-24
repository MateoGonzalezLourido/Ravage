// backend/services/sessionFile.js
const fs = require("fs");
const path = require('path');
const dotenv = require("dotenv");
dotenv.config();

const sessionFile = path.join(process.cwd(), 'APP_DATA', 'sesionfile.json');// conseguir la ruta absoluta del APP_DATA ...

async function saveSession({ username, token = "" }) {//guardar/ crear archivo
    const data = { username, token };
    fs.writeFile(sessionFile, JSON.stringify(data), (err) => {
        if (err) console.error("Error al guardar sesión:", err);
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


function clearSession() {//borrar archivo
    if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
    }
}

function comprobarExistenciaArchivos() {
    const sessionDir = path.join(__dirname, 'APP_DATA');
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const sessionFile = path.join(sessionDir, 'sesionfile.json');
    if (!fs.existsSync(sessionFile)) fs.writeFileSync(sessionFile, JSON.stringify({}), 'utf8');
}

//jwt
const jwt = require('jsonwebtoken');

const SECRET_KEY_JWT = process.env.SECRET_KEY_JWT; // ⚠ cambiar por env variable en producción

function generateToken(username) {
    return jwt.sign(
        { username },           // payload
        SECRET_KEY_JWT,             // clave secreta
        { expiresIn: '7d' }    // duración del token
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
    readSession,
    clearSession,
    generateToken,
    validateToken
};