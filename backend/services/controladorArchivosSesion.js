const fs = require("fs")
const path = require('path');
const dotenv = require("dotenv");
dotenv.config();
const { app } = require('electron')

//rutas
const ruta_app_data = app.getPath('userData')
const name_carpeta = '.APP_DATA'
const RTDF = {
    sessionDir: path.join(ruta_app_data, name_carpeta),
    sessionFile: path.join(ruta_app_data, name_carpeta, 'sesionfile.json'),
    omitirVerificacionCuentaFile: path.join(ruta_app_data, name_carpeta, 'auto_login.json'),
    dispositivoConfianza: path.join(ruta_app_data, name_carpeta, 'dp_confi.json')
}

async function saveSessionFile({ username, token = "" }) {//guardar/ crear archivo
    const data = { username, token };
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
/*CREAR GUARDADO DE OMITIR VERIFIACION DE CUENTA */
async function saveOmitirVerificacionCuentaFile({ username, token = "" }) {//guardar/ crear archivo
    const data = { username, token };
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
    const data = { username, token };
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



module.exports = {
    saveSessionFile,
    clearFileSession,
    readFileSession,
    saveOmitirVerificacionCuentaFile,
    saveDispositivoConfianzaFile
};