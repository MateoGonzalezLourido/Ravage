const fs = require("fs")
const path = require('path');
const dotenv = require("dotenv");
dotenv.config();
const { app } = require('electron')
const { getSecretKEY } = require('../STORAGE/Variables_sesion.js')
const { ActualizarSecretKeyUsuario } = require('../db/mongo.js')

const crypto = require('crypto')
//rutas
const ruta_app_data = app.getPath('userData')
const name_carpeta = '.APP_DATA'
const algorithm = "aes-256-gcm";

const RTDF = {
    sessionDir: path.join(ruta_app_data, name_carpeta),
    sessionFile: path.join(ruta_app_data, name_carpeta, 'sesionfile.json'),
    omitirVerificacionCuentaFile: path.join(ruta_app_data, name_carpeta, 'auto_login.json'),
    dispositivoConfianza: path.join(ruta_app_data, name_carpeta, 'dp_confi.json')
}
//guardar archivos
async function saveSessionFile({ username, token = "" }) {//guardar/ crear archivo
    const data = { username, token }
    //semiencriptar username
    //crear carpeta si no existe
    if (!fs.existsSync(RTDF.sessionDir)) fs.mkdirSync(RTDF.sessionDir, { recursive: true });
    //sobrescribir/crear archivo con los datos
    fs.writeFile(RTDF.sessionFile, JSON.stringify(data), "utf8", (err) => {
        if (err) {//si falla, limpiar si existe
            clearFileSession('sessionFile')
            console.error("Error al guardar sesión:", err);
        }
    });
}
async function saveOmitirVerificacionCuentaFile({ username, token = "" }) {//guardar/ crear archivo
    const data = await CifrarDatosArchivos({ username, token })
    //crear carpeta si no existe
    if (!fs.existsSync(RTDF.sessionDir)) fs.mkdirSync(RTDF.sessionDir, { recursive: true });
    //sobrescribir/crear archivo con los datos
    fs.writeFile(RTDF.omitirVerificacionCuentaFile, JSON.stringify(data), "utf8", (err) => {
        if (err) {//si falla, limpiar si existe
            clearFileSession("omitirVerificacionCuentaFile")
            console.error("Error al guardar autoverifiacion de cuenta:", err);
        }
    });
}
async function saveDispositivoConfianzaFile({ username, token = "" }) {//guardar/ crear archivo
    const data = await CifrarDatosArchivos({ username, token })
    //crear carpeta si no existe
    if (!fs.existsSync(RTDF.sessionDir)) fs.mkdirSync(RTDF.sessionDir, { recursive: true });
    //sobrescribir/crear archivo con los datos
    fs.writeFile(RTDF.dispositivoConfianza, JSON.stringify(data), "utf8", (err) => {
        if (err) {//si falla, limpiar si existe
            clearFileSession('dispositivoConfianza')
            console.error("Error al guardar autoverifiacion de cuenta:", err);
        }
    });
}
//leer archivos
async function readFileSession(ruta, cifrado = true) {
    try {
        if (!cifrado) {
            const raw = fs.readFileSync(RTDF[ruta], 'utf8')
            if (!raw) return null
            return JSON.parse(raw)
        }
        //si no existe el archivo?
        if (!fs.existsSync(RTDF[ruta])) return null;
        //leer el archivo
        const rawstr = fs.readFileSync(RTDF[ruta], 'utf8');
        if (!rawstr) return null;//no recupero nada
        const raw = JSON.parse(rawstr);
        //pasarlo a json usable
        let secretKey = getSecretKEY()

        if (!secretKey) {
            await ActualizarSecretKeyUsuario()
            return null
        }
        secretKey = Buffer.from(secretKey, "hex")

        const decipher = crypto.createDecipheriv(
            algorithm,
            secretKey,
            Buffer.from(raw.iv, "hex")
        );
        decipher.setAuthTag(Buffer.from(raw.tag, "hex"));

        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(raw.data, "hex")),
            decipher.final()
        ]);

        return JSON.parse(decrypted.toString());
    } catch {
        return null
    }
}

//limpiar archios
async function clearFileSession(ruta) {//borrar archivo
    if (fs.existsSync(RTDF[ruta])) {//existe el archivo?
        fs.unlinkSync(RTDF[ruta]);//borrar archivo
    }
}
async function limpiarArchivosCompleto() {//quita todos los archivos de la ruta
    const exclusiones = ['sessionDir']
    for (const ruta of Object.keys(RTDF)) {
        if (exclusiones.indexOf(ruta) == -1) {//no exta excluido
            fs.unlinkSync(RTDF[ruta]);//borrar archivo
        }
    }
}
//cifrar archivos
async function CifrarDatosArchivos(data) {
    let secretKey = getSecretKEY()
    if (!secretKey) secretKey = await ActualizarSecretKeyUsuario()

    secretKey = Buffer.from(secretKey, "hex")
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(data)),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag(); // integridad
    // Devuelve lo que guardas en disco
    return {
        iv: iv.toString("hex"),
        tag: tag.toString("hex"),
        data: encrypted.toString("hex")
    };
}

module.exports = {
    saveSessionFile,
    clearFileSession,
    readFileSession,
    saveOmitirVerificacionCuentaFile,
    saveDispositivoConfianzaFile,
    limpiarArchivosCompleto
};