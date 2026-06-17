import { createLogger } from '../utils/logger.js';
const log = createLogger('crypto');
import { getCryptoPool } from '../utils/workers/workerPool.js';
import {
    generateKeyPair,
    generateKeyPairSync,
    createCipheriv,
    createDecipheriv,
    randomBytes,
    createHash,
    createHmac,
    createPublicKey,
    createPrivateKey,
    hkdfSync,
    diffieHellman,
    gzipSync,
    gunzipSync
} from '../utils/libs.js';
import { promisify } from 'node:util';
const generateKeyPairAsync = (typeof generateKeyPair === 'function') ? promisify(generateKeyPair) : null;
let systemKey = null;
let cachedIdentity = null;

// Cache de KeyObjects parseados (X25519) para evitar parsear PEM en cada operación
const _publicKeyCache = new Map();

// ── Utilidades multi-clave ────────────────────────────────────────────────────

/** Genera un ID corto para una clave privada (primeros 16 hex de su SHA-256) */
export function keyFingerprint(privatePem) {
    return createHash('sha256').update(privatePem.trim()).digest('hex').slice(0, 16);
}

/**
 * Migra el formato antiguo {privateKey, publicKey} al nuevo {primary, supportKeys}.
 * Devuelve null si los datos son inválidos.
 */
export function migrateIdentityIfNeeded(data) {
    if (!data) return null;
    if (data.primary) return data;
    if (data.privateKey) {
        return {
            primary: {
                id: keyFingerprint(data.privateKey),
                privateKey: data.privateKey,
                publicKey: data.publicKey || '',
                createdAt: Date.now()
            },
            supportKeys: []
        };
    }
    return null;
}

/**
 * Devuelve todas las claves privadas en orden de prueba: [primary, ...support]
 * @returns {{ id: string, privateKey: string, isPrimary: boolean }[]}
 */
export function getAllPrivateKeys(identityData) {
    if (!identityData) return [];
    const keys = [];
    if (identityData.primary?.privateKey) {
        keys.push({ id: identityData.primary.id, privateKey: identityData.primary.privateKey, isPrimary: true });
    }
    for (const k of (identityData.supportKeys || [])) {
        if (k.privateKey) keys.push({ id: k.id, privateKey: k.privateKey, isPrimary: false });
    }
    return keys;
}

/**
 * Intenta descifrar con cada clave X25519 disponible en orden.
 * @returns {{ result: string, keyId: string, isPrimary: boolean }}
 * @throws si ninguna clave funciona
 */
export function descifrarConX25519Multi(envuelta, allKeys) {
    let lastErr;
    for (const keyInfo of allKeys) {
        try {
            const result = descifrarConX25519(envuelta, keyInfo.privateKey);
            return { result, keyId: keyInfo.id, isPrimary: keyInfo.isPrimary };
        } catch (e) {
            lastErr = e;
        }
    }
    throw new Error(`No se pudo descifrar con ninguna clave privada. Último error: ${lastErr?.message}`);
}
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
    const { readFileSession, saveIdentityFile } = await import('./controladorArchivos.js');
    const raw = await readFileSession('identity');
    if (raw) {
        const migrated = migrateIdentityIfNeeded(raw);
        if (migrated) {
            cachedIdentity = migrated;
            // Persistir la migración si el formato era el antiguo
            if (!raw.primary) {
                saveIdentityFile(migrated).catch(e => log.warn({ err: e }, '[Identity] Fallo persistiendo migración'));
            }
        }
    }
    return cachedIdentity;
}

/**
 * Actualiza la identidad en cache.
 */
export function setCachedIdentity(data) {
    // Siempre guardar en nuevo formato
    cachedIdentity = migrateIdentityIfNeeded(data) || data;
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

// Prefijo DER SPKI de 12 bytes para reconstruir una clave pública X25519 desde sus 32 bytes raw
const _X25519_SPKI_HEADER = Buffer.from('302a300506032b656e032100', 'hex');

/**
 * Cifra una chain key (hex string) con la clave pública X25519 del receptor.
 * Genera un par de claves efímero, hace ECDH, deriva una wrapping key con HKDF
 * y cifra la chain key con AES-256-GCM.
 * @returns {{ ephPub: string, iv: string, data: string, tag: string }}
 */
export function cifrarConX25519(chainKeyHex, recipientPublicKeyPem) {
    let recipientPubKeyObj = _publicKeyCache.get(recipientPublicKeyPem);
    if (!recipientPubKeyObj) {
        recipientPubKeyObj = createPublicKey(recipientPublicKeyPem);
        _publicKeyCache.set(recipientPublicKeyPem, recipientPubKeyObj);
    }

    const { privateKey: ephPriv, publicKey: ephPub } = generateKeyPairSync('x25519', {});
    const sharedSecret = diffieHellman({ privateKey: ephPriv, publicKey: recipientPubKeyObj });
    const wrappingKey = Buffer.from(hkdfSync('sha256', sharedSecret, Buffer.alloc(0), Buffer.from('ravage-ck-wrap'), 32));

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', wrappingKey, iv);
    const data = Buffer.concat([cipher.update(Buffer.from(chainKeyHex, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();

    const ephPubRaw = ephPub.export({ type: 'spki', format: 'der' }).slice(-32).toString('hex');
    return {
        ephPub: ephPubRaw,
        iv: iv.toString('hex'),
        data: data.toString('hex'),
        tag: tag.toString('hex')
    };
}

/**
 * Descifra una chain key cifrada con X25519+HKDF+AES-256-GCM.
 * @param {{ ephPub: string, iv: string, data: string, tag: string }} envuelta
 * @returns {string} chain key en hexadecimal
 */
export function descifrarConX25519(envuelta, privateKeyPem) {
    if (!envuelta || !envuelta.ephPub || !envuelta.iv || !envuelta.data || !envuelta.tag) {
        throw new Error('X25519: estructura de clave envuelta inválida');
    }
    let privKeyObj = _privateKeyCache.get(privateKeyPem);
    if (!privKeyObj) {
        privKeyObj = createPrivateKey(privateKeyPem);
        _privateKeyCache.set(privateKeyPem, privKeyObj);
    }

    const ephPubDer = Buffer.concat([_X25519_SPKI_HEADER, Buffer.from(envuelta.ephPub, 'hex')]);
    const ephPubKeyObj = createPublicKey({ key: ephPubDer, format: 'der', type: 'spki' });

    const sharedSecret = diffieHellman({ privateKey: privKeyObj, publicKey: ephPubKeyObj });
    const wrappingKey = Buffer.from(hkdfSync('sha256', sharedSecret, Buffer.alloc(0), Buffer.from('ravage-ck-wrap'), 32));

    const decipher = createDecipheriv('aes-256-gcm', wrappingKey, Buffer.from(envuelta.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(envuelta.tag, 'hex'));
    return Buffer.concat([
        decipher.update(Buffer.from(envuelta.data, 'hex')),
        decipher.final()
    ]).toString('utf8');
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