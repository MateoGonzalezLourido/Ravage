import { createLogger } from '../utils/logger.js';
const log = createLogger('crypto');
import { 
    generateKeyPair,
    publicEncrypt, 
    privateDecrypt, 
    createCipheriv, 
    createDecipheriv, 
    randomBytes, 
    createHash, 
    createHmac,
    constants
} from '../utils/libs.js';
import { promisify } from 'util'; // <-- Añadir esto
const generateKeyPairAsync=promisify(generateKeyPair);
let systemKey = null;
let cachedIdentity = null;

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
}


/**
 * Encripta datos del sistema usando la llave interna (AES-256-GCM).
 */
export function encriptarDatosSistema(datos) {
    if (!datos) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', getSystemKey(), iv);
    
    let encrypted = cipher.update(typeof datos === 'string' ? datos : JSON.stringify(datos), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
        data: encrypted,
        iv: iv.toString('hex'),
        tag: cipher.getAuthTag().toString('hex')
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
        
        let decrypted = decipher.update(encriptado.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        log.error({ err: e }, "Error al desencriptar datos del sistema");
        return encriptado; // Devolver original en caso de fallo crítico de desencriptado (opcional, pero más estable para la UI)
    }
}


/**
 * Genera un hash SHA-256 para búsquedas deterministas.
 */
export function hashDatosSistema(datos) {
    if (!datos) return null;
    return createHash('sha256').update(String(datos)).digest('hex');
}


/**
 * Servicio de Criptografía para E2EE
 * Utiliza X25519 para intercambio de llaves y AES-256-GCM para contenido.
 */

// Generar par de llaves de identidad (X25519)
export async function generarLlavesIdentidad() {
    const { publicKey, privateKey } = await generateKeyPairAsync('x25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    return { publicKey, privateKey };
}

// Cifrar datos con una llave simétrica (AES-256-GCM)
export function cifrarContenido(contenido, key) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
        cipher.update(typeof contenido === 'string' ? contenido : JSON.stringify(contenido), 'utf8'),
        cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return {
        data: encrypted.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
    };
}

// Descifrar datos con una llave simétrica (AES-256-GCM)
export function descifrarContenido(cifrado, key) {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(cifrado.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(cifrado.tag, 'hex'));
    
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(cifrado.data, 'hex')),
        decipher.final()
    ]);
    
    return decrypted.toString('utf8');
}

// Derivar un secreto compartido entre una llave privada propia y una pública ajena (ECDH)
// Nota: Para simplificar la distribución de la ChatKey, usaremos cifrado asimétrico directo 
// sobre la ChatKey inicial, o ECDH para derivarla.
// Implementaremos RSA para la envoltura de la ChatKey por simplicidad en la lógica de distribución.

export async function generarLlavesRSA() {
    return await generateKeyPairAsync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
}

export function cifrarConPublica(datos, publicKey) {
    return publicEncrypt({
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
    }, Buffer.from(datos)).toString('hex');
}

export function descifrarConPrivada(datosHex, privateKey) {
    if (!datosHex || typeof datosHex !== 'string') {
        throw new Error("RSA: Ciphertext must be a hex string.");
    }
    const buffer = Buffer.from(datosHex, 'hex');
    return privateDecrypt({
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
    }, buffer).toString('utf8');
}

/**
 * Crea un flujo de cifrado (AES-256-GCM).
 * El tag se debe obtener con cipher.getAuthTag() después de que el flujo termine.
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

