import { createLogger } from '../utils/logger.js';
const log = createLogger('crypto');
import { getCryptoPool } from '../utils/workers/workerPool.js';
import { 
    generateKeyPair,
    publicEncrypt, 
    privateDecrypt, 
    createCipheriv, 
    createDecipheriv, 
    randomBytes, 
    createHash, 
    createHmac,
    createPublicKey,
    createPrivateKey,
    constants,
    gzipSync,
    gunzipSync
} from '../utils/libs.js';
import { promisify } from 'node:util';
const generateKeyPairAsync = (typeof generateKeyPair === 'function') ? promisify(generateKeyPair) : null;
let systemKey = null;
let cachedIdentity = null;

// Cache de KeyObjects parseados para evitar parsear PEM en cada operación RSA
const _publicKeyCache = new Map();
const _privateKeyCache = new Map();

function getSystemKey() {
    if (!systemKey) {
        if (!process.env.INTERNAL_ENCRYPTION_KEY) {
            throw new Error("INTERNAL_ENCRYPTION_KEY not set in process.env");
        }
        systemKey = Buffer.from(process.env.INTERNAL_ENCRYPTION_KEY, 'hex');
    }
    return systemKey;
}

/**
 * Retorna la identidad (llaves) en cache o la lee de disco si es necesario.
 */
export async function getIdentity() {
    if (cachedIdentity) return cachedIdentity;
    const { readFileSession } = await import('./controladorArchivos.js');
    const data = await readFileSession('identity');
    if (data) {
        cachedIdentity = data;
    }
    return cachedIdentity;
}

/**
 * Actualiza la identidad en cache.
 */
export function setCachedIdentity(data) {
    cachedIdentity = data;
}

/**
 * Limpia la identidad en cache (ej: logout).
 */
export function clearCachedIdentity() {
    cachedIdentity = null;
    _publicKeyCache.clear();
    _privateKeyCache.clear();
}


/**
 * Encripta datos del sistema usando la llave interna (AES-256-GCM).
 */
export function encriptarDatosSistema(datos) {
    if (!datos) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', getSystemKey(), iv);
    
    const jsonStr = typeof datos === 'string' ? datos : JSON.stringify(datos);
    const compressed = gzipSync(Buffer.from(jsonStr, 'utf8'));

    const encrypted = Buffer.concat([
        cipher.update(compressed),
        cipher.final()
    ]);
    
    return {
        data: encrypted.toString('hex'),
        iv: iv.toString('hex'),
        tag: cipher.getAuthTag().toString('hex'),
        compressed: true
    };
}

/**
 * Desencripta datos del sistema usando la llave interna.
 */
export function desencriptarDatosSistema(encriptado) {
    if (!encriptado || typeof encriptado !== 'object' || !encriptado.data || !encriptado.iv || !encriptado.tag) return encriptado;
    try {
        const decipher = createDecipheriv('aes-256-gcm', getSystemKey(), Buffer.from(encriptado.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(encriptado.tag, 'hex'));
        
        let decrypted = Buffer.concat([
            decipher.update(Buffer.from(encriptado.data, 'hex')),
            decipher.final()
        ]);
        
        if (encriptado.compressed) {
            decrypted = gunzipSync(decrypted);
        }

        return decrypted.toString('utf8');
    } catch (e) {
        log.error({ err: e }, "Error al desencriptar datos del sistema");
        return null;
    }
}


/**
 * Genera un HMAC SHA-256 para búsquedas deterministas de forma segura frente a fuerza bruta.
 */
export function hashDatosSistema(datos) {
    if (!datos) return null;
    const secret = process.env.HMAC_SECRET || getSystemKey();
    return createHmac("sha256", secret).update(String(datos)).digest("hex");
}


/**
 * Servicio de Criptografía para E2EE
 * Utiliza X25519 para intercambio de llaves y AES-256-GCM para contenido.
 */

// Generar par de llaves de identidad (X25519) — delegado a worker thread
export async function generarLlavesX25519() {
    try {
        return await getCryptoPool().ejecutar('GENERAR_LLAVES_IDENTIDAD');
    } catch (err) {
        log.warn({ err }, 'Worker pool falló para X25519, fallback a main thread...');
        
        if (generateKeyPairAsync) {
            try {
                return await generateKeyPairAsync('x25519', {
                    publicKeyEncoding: { type: 'spki', format: 'pem' },
                    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                });
            } catch (e) {
                log.error({ err: e }, "Falló fallback asíncrono X25519, usando síncrono");
            }
        }

        const { generateKeyPairSync } = await import('../utils/libs.js');
        return generateKeyPairSync('x25519', {
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
    }
}

// Cifrar datos con una llave simétrica (AES-256-GCM)
export function cifrarContenido(contenido, key) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    const jsonStr = typeof contenido === 'string' ? contenido : JSON.stringify(contenido);
    const compressed = gzipSync(Buffer.from(jsonStr, 'utf8'));

    const encrypted = Buffer.concat([
        cipher.update(compressed),
        cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
        data: encrypted.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        compressed: true
    };
}

// Descifrar datos con una llave simétrica (AES-256-GCM)
export function descifrarContenido(cifrado, key) {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(cifrado.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(cifrado.tag, 'hex'));
    
    let decrypted = Buffer.concat([
        decipher.update(Buffer.from(cifrado.data, 'hex')),
        decipher.final()
    ]);
    
    if (cifrado.compressed) {
        decrypted = gunzipSync(decrypted);
    }

    return decrypted.toString('utf8');
}

// Generar par de llaves RSA-2048 — delegado a worker thread
export async function generarLlavesRSA() {
    try {
        return await getCryptoPool().ejecutar('GENERAR_LLAVES_RSA');
    } catch (err) {
        log.warn({ err }, 'Worker pool falló para RSA, fallback a main thread...');
        
        if (generateKeyPairAsync) {
            try {
                return await generateKeyPairAsync('rsa', {
                    modulusLength: 2048,
                    publicKeyEncoding: { type: 'spki', format: 'pem' },
                    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                });
            } catch (e) {
                log.error({ err: e }, "Falló fallback asíncrono RSA, usando síncrono");
            }
        }
        
        const { generateKeyPairSync } = await import('../utils/libs.js');
        return generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
    }
}

/**
 * Cifra datos con una llave pública RSA-OAEP.
 * Cachea el KeyObject parseado para evitar parsear el PEM en cada llamada.
 */
export function cifrarConPublica(datos, publicKey) {
    let keyObj = _publicKeyCache.get(publicKey);
    if (!keyObj) {
        keyObj = createPublicKey(publicKey);
        _publicKeyCache.set(publicKey, keyObj);
    }
    return publicEncrypt({
        key: keyObj,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
    }, Buffer.from(datos)).toString('hex');
}

/**
 * Descifra datos con una llave privada RSA-OAEP.
 * Cachea el KeyObject parseado para evitar parsear el PEM en cada llamada.
 */
export function descifrarConPrivada(datosHex, privateKey) {
    if (!datosHex || typeof datosHex !== 'string') {
        throw new Error("RSA: Ciphertext must be a hex string.");
    }
    let keyObj = _privateKeyCache.get(privateKey);
    if (!keyObj) {
        keyObj = createPrivateKey(privateKey);
        _privateKeyCache.set(privateKey, keyObj);
    }
    const buffer = Buffer.from(datosHex, 'hex');
    return privateDecrypt({
        key: keyObj,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
    }, buffer).toString('utf8');
}

/**
 * Crea un flujo de cifrado (AES-256-GCM).
 */
export function crearCipherStream(key, iv) {
    return createCipheriv('aes-256-gcm', key, iv);
}

/**
 * Crea un flujo de descifrado (AES-256-GCM).
 */
export function crearDecipherStream(key, iv, tag) {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher;
}

/**
 * Avanza la cadena de claves (Sender Key Ratchet).
 * Retorna { messageKey, nextChainKey }.
 */
export function ratchetChainKey(chainKeyHex) {
    const chainKey = Buffer.from(chainKeyHex, 'hex');
    
    // MK = HMAC-SHA256(CK, 0x01)
    const messageKey = createHmac('sha256', chainKey).update(Buffer.from([0x01])).digest();
    
    // NextCK = HMAC-SHA256(CK, 0x02)
    const nextChainKey = createHmac('sha256', chainKey).update(Buffer.from([0x02])).digest();
    
    return {
        messageKey: messageKey,
        nextChainKey: nextChainKey.toString('hex')
    };
}