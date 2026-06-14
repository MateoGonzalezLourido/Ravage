import { createLogger } from '../utils/logger.js';
const log = createLogger('archivo-ctrl');
import { randomBytes, createCipheriv, createDecipheriv, createHash, fs, path, app, gzipSync, gunzipSync } from '../utils/libs.js';
import { getSecretKEY } from '../STORAGE/Variables_sesion.js';
import { ActualizarSecretKeyUsuario } from '../repositories/UserRepository.js';

// Clave secreta para cifrar archivos locales (ajustes, sesión, etc.)
// Se inicializa de forma perezosa para evitar errores si process.env aún no está cargado
let _SECRET_KEY_COKKIE;
function getSecretKeyCokkie() {
    if (!_SECRET_KEY_COKKIE) {
        if (!process.env.SECRET_KEY_COKKIE) {
            log.error("FALTA process.env.SECRET_KEY_COKKIE. Asegúrate de que el .env esté cargado.");
            throw new Error("SECRET_KEY_COKKIE no definida");
        }
        _SECRET_KEY_COKKIE = Buffer.from(process.env.SECRET_KEY_COKKIE, 'hex');
    }
    return _SECRET_KEY_COKKIE;
}
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
    cacheHistorialBusquedasAñadir: path.join(ruta_app_data, name_carpeta, 'cache_hist_buscar_add.json'),
    securityPin: path.join(ruta_app_data, name_carpeta, 'pin_seguridad.json')
};

import { AJUSTES_APP_DEFAULT } from '../STORAGE/ajustes_defecto.js'

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
        log.error({ err }, "Error al crear directorio de datos");
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
            JSON.stringify(dataFinal),
            { encoding: "utf8" }
        );
    } catch (err) {
        log.error({ err }, `Error al guardar en ${rutaKey}`);
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

async function saveSecurityPinFile({ correo, pinHash }) {
    await guardarArchivoGenerico('securityPin', { correo, pinHash }, 'global');
}

async function saveDispositivoConfianzaFile({ username, token = "" }) {
    await guardarArchivoGenerico('dispositivoConfianza', { username, token }, 'global');
}

function _fingerprint(pem) {
    return createHash('sha256').update(pem.trim()).digest('hex').slice(0, 16);
}

/**
 * Guarda la identidad. Acepta el nuevo formato {primary, supportKeys}
 * o el antiguo {privateKey, publicKey} (lo migra automáticamente).
 */
async function saveIdentityFile(data) {
    let identity;
    if (data.primary) {
        identity = data;
    } else if (data.privateKey) {
        // formato antiguo → migrar
        identity = {
            primary: {
                id: _fingerprint(data.privateKey),
                privateKey: data.privateKey,
                publicKey: data.publicKey || '',
                createdAt: Date.now()
            },
            supportKeys: []
        };
    } else {
        throw new Error('saveIdentityFile: formato de datos inválido');
    }
    const { setCachedIdentity } = await import('./cryptoService.js');
    setCachedIdentity(identity);
    await guardarArchivoGenerico('identity', identity, 'global');
}

/** Lee y migra la identidad directamente desde disco, sin imports circulares */
async function _leerIdentidadLocal() {
    const raw = await readFileSession('identity');
    if (!raw) return null;
    if (raw.primary) return raw;
    if (raw.privateKey) {
        return {
            primary: {
                id: _fingerprint(raw.privateKey),
                privateKey: raw.privateKey,
                publicKey: raw.publicKey || '',
                createdAt: Date.now()
            },
            supportKeys: []
        };
    }
    return null;
}

async function importarClavePrivada(pemContent, label = '') {
    try {
        const pem = pemContent.trim();
        // Validar que sea una clave privada válida usando Node crypto
        const { createPrivateKey } = await import('node:crypto');
        createPrivateKey(pem);

        const id = _fingerprint(pem);
        const current = await _leerIdentidadLocal();

        if (!current) {
            // Sin identidad previa → esta clave se convierte en la principal
            const nuevo = { primary: { id, privateKey: pem, publicKey: '', createdAt: Date.now() }, supportKeys: [] };
            await saveIdentityFile(nuevo);
            return { ok: true, id, tipo: 'primary' };
        }

        if (current.primary?.id === id) return { ok: false, error: 'Esa clave ya es la clave principal' };
        if ((current.supportKeys || []).some(k => k.id === id)) return { ok: false, error: 'Esa clave ya está en la lista de soporte' };

        current.supportKeys = current.supportKeys || [];
        current.supportKeys.push({ id, privateKey: pem, addedAt: Date.now(), label });
        await saveIdentityFile(current);
        return { ok: true, id, tipo: 'support' };
    } catch (err) {
        log.error({ err }, '[Identity] Error importando clave privada');
        return { ok: false, error: err.message };
    }
}

async function cambiarClavePrincipal(keyId) {
    try {
        const current = await _leerIdentidadLocal();
        if (!current) return { ok: false, error: 'No hay identidad guardada' };

        const idx = (current.supportKeys || []).findIndex(k => k.id === keyId);
        if (idx === -1) return { ok: false, error: 'Clave no encontrada en el listado de soporte' };

        const newPrimary = current.supportKeys[idx];
        const oldPrimary = current.primary;

        current.primary = {
            id: newPrimary.id,
            privateKey: newPrimary.privateKey,
            publicKey: newPrimary.publicKey || '',
            createdAt: newPrimary.addedAt || Date.now()
        };
        current.supportKeys.splice(idx, 1);
        if (oldPrimary?.privateKey) {
            current.supportKeys.unshift({
                id: oldPrimary.id,
                privateKey: oldPrimary.privateKey,
                addedAt: oldPrimary.createdAt || Date.now(),
                label: 'Antigua principal'
            });
        }

        await saveIdentityFile(current);
        // Invalidar la cache de cryptoService para que la próxima llamada recargue
        const { clearCachedIdentity } = await import('./cryptoService.js');
        clearCachedIdentity();
        return { ok: true };
    } catch (err) {
        log.error({ err }, '[Identity] Error cambiando clave principal');
        return { ok: false, error: err.message };
    }
}

async function listarClavesIdentidad() {
    try {
        const current = await _leerIdentidadLocal();
        if (!current) return [];
        const lista = [];
        if (current.primary) {
            lista.push({ id: current.primary.id, tipo: 'primary', fecha: current.primary.createdAt });
        }
        for (const k of (current.supportKeys || [])) {
            lista.push({ id: k.id, tipo: 'support', fecha: k.addedAt, label: k.label || '' });
        }
        return lista;
    } catch (err) {
        log.error({ err }, '[Identity] Error listando claves');
        return [];
    }
}

async function eliminarClaveSoporte(keyId) {
    try {
        const current = await _leerIdentidadLocal();
        if (!current) return { ok: false, error: 'No hay identidad guardada' };

        const idx = (current.supportKeys || []).findIndex(k => k.id === keyId);
        if (idx === -1) return { ok: false, error: 'Clave no encontrada' };

        current.supportKeys.splice(idx, 1);
        await saveIdentityFile(current);
        return { ok: true };
    } catch (err) {
        log.error({ err }, '[Identity] Error eliminando clave de soporte');
        return { ok: false, error: err.message };
    }
}

async function saveCacheArchivosDescargadosFile(data) {
    await guardarArchivoGenerico('cacheArchivosDescargados', data, 'global');
}

async function saveCacheChatsFile(data) {
    await guardarArchivoGenerico('cacheChatsFrecuentes', data, 'global');
}



async function saveCacheHistorialBusquedasAñadirFile(data) {
    await guardarArchivoGenerico('cacheHistorialBusquedasAñadir', data, 'global');
}


async function saveAjustesAppFile({ data = {}, create = false }) {
    await asegurarCarpeta();

    // Si create es true, empezamos de cero con los valores por defecto.
    // Si create es false (por defecto ahora), leemos lo que ya hay.
    let data_usar = create ? { ...AJUSTES_APP_DEFAULT } : await getAjustesAppFile();

    // Combinar con los nuevos datos recibidos
    data_usar = { ...data_usar, ...data };

    try {
        const encrypted = await CifrarDatosArchivos(data_usar, 'global');
        await fs.promises.writeFile(
            RTDF.ajustesAPP,
            JSON.stringify(encrypted),
            { encoding: "utf8" }
        );
        return true;
    } catch (err) {
        log.error({ err }, "Error al guardar ajustes de app");
        return false;
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
        const useGlobalKey = ['sessionFile', 'identity', 'cacheChatsFrecuentes', 'cacheArchivosDescargados', 'dispositivoConfianza', 'omitirVerificacionCuentaFile', 'cacheHistorialBusquedasAñadir', 'securityPin'].includes(rutaKey);

        if (useGlobalKey) {
            secretKey = getSecretKeyCokkie();
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

        let decrypted = Buffer.concat([
            decipher.update(Buffer.from(raw.data, "hex")),
            decipher.final()
        ]);

        if (raw.compressed) {
            decrypted = gunzipSync(decrypted);
        }

        return JSON.parse(decrypted.toString());
    } catch (e) {
        log.error({ err: e }, `Error al leer archivo ${rutaKey}`);
        // Si el archivo está corrupto o la clave es incorrecta, lo eliminamos para que no cause errores persistentes
        await clearFileSession(rutaKey);
        return null;
    }
}
//@param nombre: string | array | null
async function getAjustesAppFile(nombre = null) {

    if (!fs.existsSync(RTDF.ajustesAPP)) {
        await saveAjustesAppFile({ create: true });
        return nombre ? AJUSTES_APP_DEFAULT[nombre] : { ...AJUSTES_APP_DEFAULT };
    }

    try {
        const rawstr = await fs.promises.readFile(RTDF.ajustesAPP, { encoding: "utf8" });
        if (!rawstr) return { ...AJUSTES_APP_DEFAULT };

        const raw = JSON.parse(rawstr);
        let obj;

        // Si el archivo ya está cifrado (tiene iv, tag, data)
        if (raw.iv && raw.tag && raw.data) {
            const decipher = createDecipheriv(algorithm, getSecretKeyCokkie(), Buffer.from(raw.iv, "hex"));
            decipher.setAuthTag(Buffer.from(raw.tag, "hex"));
            let decrypted = Buffer.concat([
                decipher.update(Buffer.from(raw.data, "hex")),
                decipher.final()
            ]);

            if (raw.compressed) {
                decrypted = gunzipSync(decrypted);
            }

            obj = JSON.parse(decrypted.toString());
        } else {
            // Retrocompatibilidad: si era plano
            obj = raw;
            // Migrar a cifrado la próxima vez que se guarde
        }

        const merged = { ...AJUSTES_APP_DEFAULT, ...obj };

        if (!nombre) return merged;

        if (Array.isArray(nombre)) {
            return nombre.reduce((acc, key) => {
                acc[key] = merged[key];
                return acc;
            }, {});
        }

        return merged[nombre];
    } catch (e) {
        log.error({ err: e }, "Error al leer ajustes de app");
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
        log.error({ err: e }, `No se pudo eliminar el archivo ${rutaKey}`);
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
        secretKey = getSecretKeyCokkie();
    } else {
        secretKey = getSecretKEY() || await ActualizarSecretKeyUsuario();
    }

    if (!secretKey) throw new Error("No se pudo obtener la clave secreta para el cifrado.");

    const finalKey = Buffer.isBuffer(secretKey) ? secretKey : Buffer.from(secretKey, "hex");
    const iv = randomBytes(12);
    const cipher = createCipheriv(algorithm, finalKey, iv);

    const compressedData = gzipSync(JSON.stringify(data));

    const encrypted = Buffer.concat([
        cipher.update(compressedData),
        cipher.final()
    ]);

    return {
        iv: iv.toString("hex"),
        tag: cipher.getAuthTag().toString("hex"),
        data: encrypted.toString("hex"),
        compressed: true
    };
}

/**
 * Descifra el archivo de identidad y escribe la clave privada RSA en texto plano
 * en la carpeta Descargas del usuario como "ravage_private_key.pem".
 * Se exporta en PEM limpio para que sea portable entre instalaciones.
 * @returns {{ ok: boolean, ruta?: string, error?: string }}
 */
async function exportarClavePrivadaADescargas() {
    try {
        const identity = await _leerIdentidadLocal();
        const pem = identity?.primary?.privateKey;
        if (!pem) {
            return { ok: false, error: 'No se encontró la clave privada principal. Asegúrate de haber iniciado sesión.' };
        }

        const downloadsDir = app.getPath('downloads');
        const destino = path.join(downloadsDir, 'ravage_private_key.pem');

        await fs.promises.writeFile(destino, pem, { encoding: 'utf-8', mode: 0o600 });
        log.info({ destino }, 'Clave privada principal exportada a Descargas');
        return { ok: true, ruta: destino };
    } catch (err) {
        log.error({ err }, 'Error exportando clave privada');
        return { ok: false, error: err.message };
    }
}

async function exportarClavePorId(keyId) {
    try {
        const identity = await _leerIdentidadLocal();
        if (!identity) return { ok: false, error: 'No hay identidad guardada' };

        let pem = null;
        let nombreArchivo = `ravage_key_${keyId.slice(0, 8)}.pem`;

        if (identity.primary?.id === keyId) {
            pem = identity.primary.privateKey;
            nombreArchivo = 'ravage_private_key.pem';
        } else {
            const soporte = (identity.supportKeys || []).find(k => k.id === keyId);
            if (soporte) pem = soporte.privateKey;
        }

        if (!pem) return { ok: false, error: 'Clave no encontrada' };

        const downloadsDir = app.getPath('downloads');
        const destino = path.join(downloadsDir, nombreArchivo);
        await fs.promises.writeFile(destino, pem, { encoding: 'utf-8', mode: 0o600 });
        log.info({ destino }, '[Identity] Clave exportada individualmente');
        return { ok: true, ruta: destino };
    } catch (err) {
        log.error({ err }, '[Identity] Error exportando clave por id');
        return { ok: false, error: err.message };
    }
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
    saveCacheArchivosDescargadosFile,
    saveCacheChatsFile,
    saveCacheHistorialBusquedasAñadirFile,
    exportarClavePrivadaADescargas,
    exportarClavePorId,
    importarClavePrivada,
    cambiarClavePrincipal,
    listarClavesIdentidad,
    eliminarClaveSoporte,
    saveSecurityPinFile
};