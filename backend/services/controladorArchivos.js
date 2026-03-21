import { randomBytes, createCipheriv, createDecipheriv, fs, path, app } from '../utils/libs.js';
import { getSecretKEY } from '../STORAGE/Variables_sesion.js';
import { ActualizarSecretKeyUsuario } from '../repositories/UserRepository.js';

const SECRET_KEY_COKKIE = Buffer.from(process.env.SECRET_KEY_COKKIE, 'hex');
const algorithm = "aes-256-gcm";

// Rutas estandarizadas
const name_carpeta = '.APP_DATA';
const ruta_app_data = app ? app.getPath('userData') : path.join(process.cwd(), '.test_data');

const RTDF = {
    sessionDir: path.join(ruta_app_data, name_carpeta),
    sessionFile: path.join(ruta_app_data, name_carpeta, 'sesionfile.json'),
    omitirVerificacionCuentaFile: path.join(ruta_app_data, name_carpeta, 'auto_login.json'),
    dispositivoConfianza: path.join(ruta_app_data, name_carpeta, 'dp_confi.json'),
    ajustesAPP: path.join(ruta_app_data, name_carpeta, 'ajustes_app.json'),
    infoAPP: path.join(ruta_app_data, name_carpeta, 'info_app.json'),
    identity: path.join(ruta_app_data, name_carpeta, 'identity.json'),
    cacheArchivosDescargados: path.join(ruta_app_data, name_carpeta, 'cache_archivos.json'),
    cacheChatsFrecuentes: path.join(ruta_app_data, name_carpeta, 'cache_chats_frec.json'),
    cacheUsuariosFrecuentes: path.join(ruta_app_data, name_carpeta, 'cache_users_frec.json')
};

import {AJUSTES_APP_DEFAULT} from '../STORAGE/ajustes_defecto.js'

// --- UTILIDADES INTERNAS REUTILIZABLES ---

/**
 * Asegura que el directorio de datos existe de forma asíncrona.
 */
async function asegurarCarpeta() {
    try {
        if (!fs.existsSync(RTDF.sessionDir)) {
            await fs.promises.mkdir(RTDF.sessionDir, { recursive: true });
        }
    } catch (err) {
        console.error("Error al crear directorio de datos:", err);
    }
}

/**
 * Función genérica para guardar datos cifrados en disco.
 */
async function guardarArchivoGenerico(rutaKey, data, especial = false) {
    await asegurarCarpeta();
    try {
        const dataFinal = await CifrarDatosArchivos(data, especial);
        await fs.promises.writeFile(
            RTDF[rutaKey],
            JSON.stringify(dataFinal, null, 2),
            { encoding: "utf8" }
        );
    } catch (err) {
        console.error(`Error al guardar en ${rutaKey}:`, err);
        // Solo limpiar si es un error crítico de corrupción (archivo ilegible),
        // pero no por errores temporales de permisos.
        if (err.code !== 'EACCES') await clearFileSession(rutaKey);
    }
}

// --- FUNCIONES PÚBLICAS REFACTOREADAS ---

async function saveSessionFile({ username, token = "" }) {
    await guardarArchivoGenerico('sessionFile', { username, token }, 'sessionFile');
}

async function saveOmitirVerificacionCuentaFile({ username, token = "" }) {
    await guardarArchivoGenerico('omitirVerificacionCuentaFile', { username, token }, 'global');
}

async function saveDispositivoConfianzaFile({ username, token = "" }) {
    await guardarArchivoGenerico('dispositivoConfianza', { username, token }, 'global');
}

async function saveIdentityFile({ privateKey }) {
    await guardarArchivoGenerico('identity', { privateKey }, 'global');
}

async function saveCacheArchivosDescargadosFile(data) {
    await guardarArchivoGenerico('cacheArchivosDescargados', data, 'global');
}

async function saveCacheChatsFile(data) {
    await guardarArchivoGenerico('cacheChatsFrecuentes', data, 'global');
}

async function saveCacheUsuariosFile(data) {
    await guardarArchivoGenerico('cacheUsuariosFrecuentes', data, 'global');
}


async function saveAjustesAppFile({ data = {}, create = true }) {
    await asegurarCarpeta();
    let data_usar = create ? AJUSTES_APP_DEFAULT : await getAjustesAppFile();
    
    if (!create) {
        // Combinar datos actuales con los nuevos
        data_usar = { ...data_usar, ...data };
    }

    try {
        const encrypted = await CifrarDatosArchivos(data_usar, 'global');
        await fs.promises.writeFile(
            RTDF.ajustesAPP, 
            JSON.stringify(encrypted, null, 2), 
            { encoding: "utf8" }
        );
    } catch (err) {
        console.error("Error al guardar ajustes de app:", err);
    }
}

async function readFileSession(rutaKey, cifrado = true) {
    const filePath = RTDF[rutaKey];
    if (!filePath || !fs.existsSync(filePath)) return null;

    try {
        const rawstr = await fs.promises.readFile(filePath, { encoding: "utf8" });
        if (!rawstr) return null;
        
        const raw = JSON.parse(rawstr);
        if (!cifrado) return raw;

        // Determinar la clave secreta a usar
        let secretKey;
        const useGlobalKey = ['sessionFile', 'identity', 'cacheChatsFrecuentes', 'cacheUsuariosFrecuentes', 'cacheArchivosDescargados', 'dispositivoConfianza', 'omitirVerificacionCuentaFile'].includes(rutaKey);
        
        if (useGlobalKey) {
            secretKey = SECRET_KEY_COKKIE;
        } else {
            const currentKey = getSecretKEY();
            if (!currentKey) {
                await ActualizarSecretKeyUsuario();
                return null;
            }
            secretKey = currentKey;
        }

        const finalKey = Buffer.isBuffer(secretKey) ? secretKey : Buffer.from(secretKey, "hex");
        
        const decipher = createDecipheriv(algorithm, finalKey, Buffer.from(raw.iv, "hex"));
        decipher.setAuthTag(Buffer.from(raw.tag, "hex"));

        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(raw.data, "hex")),
            decipher.final()
        ]);

        return JSON.parse(decrypted.toString());
    } catch (e) {
        console.error(`Error al leer archivo ${rutaKey}:`, e);
        return null;
    }
}

async function getAjustesAppFile(nombre = null) {
    if (!fs.existsSync(RTDF.ajustesAPP)) {
        await saveAjustesAppFile({ data: AJUSTES_APP_DEFAULT });
        return nombre ? AJUSTES_APP_DEFAULT[nombre] : { ...AJUSTES_APP_DEFAULT };
    }

    try {
        const rawstr = await fs.promises.readFile(RTDF.ajustesAPP, { encoding: "utf8" });
        if (!rawstr) return { ...AJUSTES_APP_DEFAULT };

        const raw = JSON.parse(rawstr);
        let obj;

        // Si el archivo ya está cifrado (tiene iv, tag, data)
        if (raw.iv && raw.tag && raw.data) {
            const decipher = createDecipheriv(algorithm, SECRET_KEY_COKKIE, Buffer.from(raw.iv, "hex"));
            decipher.setAuthTag(Buffer.from(raw.tag, "hex"));
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(raw.data, "hex")),
                decipher.final()
            ]);
            obj = JSON.parse(decrypted.toString());
        } else {
            // Retrocompatibilidad: si era plano
            obj = raw;
            // Migrar a cifrado la próxima vez que se guarde
        }

        const merged = { ...AJUSTES_APP_DEFAULT, ...obj };
        if (!nombre) return merged;
        return merged[nombre];
    } catch (e) {
        console.error('Error al leer ajustes de app:', e);
        return { ...AJUSTES_APP_DEFAULT };
    }
}

async function clearFileSession(rutaKey) {
    const filePath = RTDF[rutaKey];
    try {
        if (filePath && fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    } catch (e) {
        console.error(`No se pudo eliminar el archivo ${rutaKey}:`, e);
    }
}

async function limpiarArchivosCompleto() {
    const exclusiones = ['sessionDir'];
    for (const key of Object.keys(RTDF)) {
        if (!exclusiones.includes(key)) {
            await clearFileSession(key);
        }
    }
}

async function CifrarDatosArchivos(data, especial) {
    let secretKey;
    if (especial === 'global' || especial === 'sessionFile') {
        secretKey = SECRET_KEY_COKKIE;
    } else {
        secretKey = getSecretKEY() || await ActualizarSecretKeyUsuario();
    }

    if (!secretKey) throw new Error("No se pudo obtener la clave secreta para el cifrado.");

    const finalKey = Buffer.isBuffer(secretKey) ? secretKey : Buffer.from(secretKey, "hex");
    const iv = randomBytes(12);
    const cipher = createCipheriv(algorithm, finalKey, iv);
    
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(data)),
        cipher.final()
    ]);
    
    return {
        iv: iv.toString("hex"),
        tag: cipher.getAuthTag().toString("hex"),
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
    getAjustesAppFile,
    saveIdentityFile,
    saveCacheArchivosDescargadosFile
};
export async function saveCacheChatsFile(data) {
    await guardarArchivoGenerico('cacheChatsFrecuentes', data);
}

export async function saveCacheUsuariosFile(data) {
    await guardarArchivoGenerico('cacheUsuariosFrecuentes', data);
}
