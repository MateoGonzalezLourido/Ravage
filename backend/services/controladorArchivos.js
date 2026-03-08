import path from 'path';
import os from 'os'
import { app } from 'electron';
import { getSecretKEY } from '../STORAGE/Variables_sesion.js';
import { ActualizarSecretKeyUsuario } from '../db/mongo.js';
import { randomBytes, createCipheriv, createDecipheriv, fs } from '../utils/libs.js';

const SECRET_KEY_COKKIE = Buffer.from(process.env.SECRET_KEY_COKKIE, 'hex');

//rutas
const ruta_app_data = app.getPath('userData')
const name_carpeta = '.APP_DATA'
const algorithm = "aes-256-gcm";

const RTDF = {
    sessionDir: path.join(ruta_app_data, name_carpeta),
    sessionFile: path.join(ruta_app_data, name_carpeta, 'sesionfile.json'),
    omitirVerificacionCuentaFile: path.join(ruta_app_data, name_carpeta, 'auto_login.json'),
    dispositivoConfianza: path.join(ruta_app_data, name_carpeta, 'dp_confi.json'),
    ajustesAPP: path.join(ruta_app_data, name_carpeta, 'ajustes_app.json'),
    infoAPP: path.join(ruta_app_data, name_carpeta, 'info_app.json')
}
//guardar archivos
async function saveSessionFile({ username, token = "" }) {//guardar/ crear archivo
    const data = await CifrarDatosArchivos({ username, token }, 'sessionFile')
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
            console.error("Error al guardar dispositibvo de confianza:", err);
        }
    });
}
const AJUSTES_APP_DEFAULT = {
    MSBienvenida: true,
    URL_DESCARGA: path.join(app.getPath("downloads"))
}
async function saveAjustesAppFile({ data = {} }) {//guardar/ crear archivo
    let data_usar = getAjustesAppFile()
    for (const [key, value] of Object.entries(data)) {
        if (data_usar[key]) {//si existe->actualizar
            data_usar[key] = value
        }
    }
    //crear carpeta si no existe (apunta a la carpeta, no al archivo)
    if (!fs.existsSync(RTDF.sessionDir)) fs.mkdirSync(RTDF.sessionDir, { recursive: true });
    //sobrescribir/crear archivo con los datos
    fs.writeFile(RTDF.ajustesAPP, JSON.stringify(data), "utf8", (err) => {
        if (err) {
            console.error("Error al guardar ajustes de app:", err);
        }
    });
}
//leer archivos
async function readFileSession(ruta, cifrado = true) {
    try {
        //para archivos sin cifrado .json
        if (!cifrado) {
            const raw = fs.readFileSync(RTDF[ruta], 'utf8')
            if (!raw) return null
            return JSON.parse(raw)
        }
        //*para archivos con cifrado .json

        //si no existe el archivo?
        if (!fs.existsSync(RTDF[ruta])) return null;
        //leer el archivo
        const rawstr = fs.readFileSync(RTDF[ruta], 'utf8');
        if (!rawstr) return null;//no recupero nada
        const raw = JSON.parse(rawstr);
        //pasarlo a json usable
        let secretKey = getSecretKEY()
        if (ruta == 'sessionFile') {//especial
            secretKey = SECRET_KEY_COKKIE
        }
        else {//por defecto
            secretKey = getSecretKEY()
            if (!secretKey) {
                await ActualizarSecretKeyUsuario()
                return null
            }
            secretKey = Buffer.from(secretKey, "hex")
        }

        const decipher = createDecipheriv(
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
    } catch (e) {
        console.error(e)

        return null
    }
}

async function getAjustesAppFile(nombre = null) {
    //si no existe, crearlo con valores por defecto
    if (!fs.existsSync(RTDF.ajustesAPP)) {
        await saveAjustesAppFile({ data: AJUSTES_APP_DEFAULT })
        return { ...AJUSTES_APP_DEFAULT }
    }
    try {
        function conseguir_ajuste(){
        
                const obj = JSON.parse(raw)
                if (!nombre) return obj
                else return (obj[nombre] || { ...AJUSTES_APP_DEFAULT })
            
        }
        const raw = fs.readFileSync(RTDF.ajustesAPP, 'utf8')
        return (raw ? conseguir_ajuste (): { ...AJUSTES_APP_DEFAULT })
    } catch (e) {
        console.error('Error al leer ajustes de app:', e)
        return { ...AJUSTES_APP_DEFAULT }
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
async function CifrarDatosArchivos(data, especial) {
    let secretKey;
    if (!especial) {
        secretKey = getSecretKEY()
        if (!secretKey) secretKey = await ActualizarSecretKeyUsuario()
    }
    else if (especial == 'sessionFile') {
        secretKey = SECRET_KEY_COKKIE
    }
    secretKey = Buffer.from(secretKey, "hex")
    const iv = randomBytes(12);
    const cipher = createCipheriv(algorithm, secretKey, iv);
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

export {
    saveSessionFile,
    clearFileSession,
    readFileSession,
    saveOmitirVerificacionCuentaFile,
    saveDispositivoConfianzaFile,
    limpiarArchivosCompleto,
    saveAjustesAppFile,
    getAjustesAppFile
};