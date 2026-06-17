/**
 * cryptoWorker.js
 * Worker thread para operaciones criptográficas pesadas.
 * 
 * IMPORTANTE: Este archivo NO debe importar libs.js ni nada que dependa de Electron.
 * Usa node:crypto directamente.
 */

import { parentPort } from 'node:worker_threads';
import {
    generateKeyPair,
    generateKeyPairSync,
    createCipheriv,
    createDecipheriv,
    createHmac,
    createPublicKey,
    createPrivateKey,
    hkdfSync,
    diffieHellman,
    randomBytes
} from 'node:crypto';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';

const generateKeyPairAsync = promisify(generateKeyPair);

// Prefijo DER SPKI de 12 bytes para reconstruir una clave pública X25519 desde sus 32 bytes raw
const _X25519_SPKI_HEADER = Buffer.from('302a300506032b656e032100', 'hex');

// Cache de KeyObjects para evitar re-parsear PEM en cada operación del batch
const _privKeyCache = new Map();
const _pubKeyCache = new Map();

// ==========================================
// OPERACIONES DISPONIBLES
// ==========================================

const OPERACIONES = {
    /**
     * Genera un par de claves X25519 (identidad)
     */
    async GENERAR_LLAVES_IDENTIDAD() {
        return await generateKeyPairAsync('x25519', {
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
    },

    /**
     * Cifra una chain key con la clave pública X25519 del receptor (ECDH+HKDF+AES-GCM).
     * @param {{ chainKeyHex: string, publicKeyPem: string }} datos
     * @returns {{ ephPub: string, iv: string, data: string, tag: string }}
     */
    CIFRAR_X25519({ chainKeyHex, publicKeyPem }) {
        return _cifrarConX25519(chainKeyHex, publicKeyPem);
    },

    /**
     * Descifra una chain key cifrada con X25519+HKDF+AES-GCM.
     * @param {{ envuelta: object, privateKeyPem: string }} datos
     * @returns {string} chain key hexadecimal
     */
    DESCIFRAR_X25519({ envuelta, privateKeyPem }) {
        return _descifrarConX25519(envuelta, privateKeyPem);
    },

    /**
     * Descifra un batch de mensajes usando el sistema ratchet.
     * Cada worker recibe un subconjunto de mensajes pre-serializados.
     * 
     * @param {object} datos
     * @param {Array} datos.items - Mensajes a descifrar
     * @param {number} datos.indiceInicio - Índice de inicio para recomponer
     * @param {Array} datos.ratchet_keys - Claves ratchet del chat
     * @param {string} datos.id_propio - ID del usuario local
     * @param {string} datos.privateKey - Llave privada PEM principal (compat)
     * @param {string[]} [datos.privateKeys] - Array de claves privadas PEM a probar en orden
     * @param {string} [datos.systemKey] - Llave de sistema (hex) para fallback
     */
    DESCIFRAR_BATCH_MENSAJES({ items, indiceInicio, ratchet_keys, id_propio, privateKey, privateKeys, systemKey }) {
        // Cache de chain keys para este batch
        const cache_keys = {};

        for (let m of items) {
            // Skip si ya está descifrado
            if (m.contenido && m.contenido.length > 0 && typeof m.contenido[0].asunto === 'string') continue;

            if (m.encriptado && m.encriptado.data && m.ratchet_info) {
                try {
                    const emisor_id = m.emisor ? m.emisor.toString() : null;
                    if (!emisor_id) continue;

                    const cache_key = `${emisor_id}_${id_propio}`;

                    let current_state = cache_keys[cache_key];
                    if (!current_state) {
                        const entry = ratchet_keys.find(k =>
                            k.emisor_id.toString() === emisor_id &&
                            k.receptor_id.toString() === id_propio
                        );
                        if (!entry) throw new Error("No hay llave de ratchet para este emisor");

                        let ck_hex;
                        try {
                            const keysToTry = (privateKeys && privateKeys.length > 0) ? privateKeys : (privateKey ? [privateKey] : []);
                            let lastErr;
                            for (const pk of keysToTry) {
                                try { ck_hex = _descifrarConX25519(entry.clave_envuelta, pk); break; } catch (e) { lastErr = e; }
                            }
                            if (ck_hex === undefined) throw lastErr || new Error('Sin claves disponibles');
                        } catch (e2eErr) {
                            throw new Error(`Error E2EE: ${e2eErr.message}`);
                        }

                        current_state = { ck: ck_hex, counter: entry.counter };
                        cache_keys[cache_key] = current_state;
                    }

                    // Si el counter de la DB ya está por delante de este mensaje,
                    // la clave base fue sobreescrita y no se puede derivar la correcta.
                    // Usar fallback de sistema directamente.
                    if (current_state.counter > m.ratchet_info.iteration) {
                        if (m.contenido && m.contenido.length > 0 && systemKey) {
                            if (m.contenido[0].asunto && typeof m.contenido[0].asunto === 'object' && m.contenido[0].asunto.data) {
                                m.contenido[0].asunto = _desencriptarDatosSistema(m.contenido[0].asunto, systemKey);
                            }
                            if (m.contenido[0].archivos) {
                                m.contenido[0].archivos = m.contenido[0].archivos.map(a => ({
                                    ...a,
                                    nombre: (a.nombre && typeof a.nombre === 'object')
                                        ? _desencriptarDatosSistema(a.nombre, systemKey)
                                        : a.nombre,
                                    ratchet_info: m.ratchet_info,
                                    emisor_id: emisor_id
                                }));
                            }
                        }
                        continue;
                    }

                    // Ratchet forward (solo CK, sin derivar MK en cada paso)
                    let iterations_safety = 0;
                    while (current_state.counter < m.ratchet_info.iteration && iterations_safety < 10000) {
                        current_state.ck = _advanceChainKey(current_state.ck);
                        current_state.counter++;
                        iterations_safety++;
                    }

                    if (iterations_safety >= 10000) {
                        throw new Error("Ratchet safety limit exceeded");
                    }

                    const { messageKey, nextChainKey } = _ratchetChainKey(current_state.ck);

                    try {
                        const decryptedPayload = _descifrarContenido(m.encriptado, messageKey);
                        const data = JSON.parse(decryptedPayload);

                        if (data && !Array.isArray(data)) {
                            m.contenido = [{
                                asunto: data.asunto,
                                archivos: (data.archivos || []).map(a => ({
                                    ...a,
                                    nombre: (a.nombre && typeof a.nombre === 'object' && systemKey) 
                                        ? _desencriptarDatosSistema(a.nombre, systemKey) 
                                        : a.nombre,
                                    ratchet_info: m.ratchet_info,
                                    emisor_id: emisor_id
                                }))
                            }];
                            m.emisor = data.emisor;
                            m.data = data.data;
                        }
                    } catch (aesErr) {
                        // Fallback: Copias de sistema
                        if (m.contenido && m.contenido.length > 0 && systemKey) {
                            if (m.contenido[0].asunto && typeof m.contenido[0].asunto === 'object' && m.contenido[0].asunto.data) {
                                m.contenido[0].asunto = _desencriptarDatosSistema(m.contenido[0].asunto, systemKey);
                            }
                            if (m.contenido[0].archivos) {
                                m.contenido[0].archivos = m.contenido[0].archivos.map(a => ({
                                    ...a,
                                    nombre: (a.nombre && typeof a.nombre === 'object')
                                        ? _desencriptarDatosSistema(a.nombre, systemKey)
                                        : a.nombre,
                                    ratchet_info: m.ratchet_info,
                                    emisor_id: emisor_id
                                }));
                            }
                        } else {
                            throw new Error(`AES-GCM: Sin systemKey o copia. ${aesErr.message}`);
                        }
                    }

                    // Avanzar cadena
                    current_state.ck = nextChainKey;
                    current_state.counter++;

                } catch (err) {
                    // Fallback: intentar copia de sistema antes de mostrar error
                    let recovered = false;
                    if (m.contenido && m.contenido.length > 0 && systemKey) {
                        if (m.contenido[0].asunto && typeof m.contenido[0].asunto === 'object' && m.contenido[0].asunto.data) {
                            const decoded = _desencriptarDatosSistema(m.contenido[0].asunto, systemKey);
                            if (decoded) {
                                m.contenido[0].asunto = decoded;
                                if (m.contenido[0].archivos) {
                                    m.contenido[0].archivos = m.contenido[0].archivos.map(a => ({
                                        ...a,
                                        nombre: (a.nombre && typeof a.nombre === 'object')
                                            ? (_desencriptarDatosSistema(a.nombre, systemKey) || a.nombre)
                                            : a.nombre
                                    }));
                                }
                                recovered = true;
                            }
                        }
                    }
                    if (!recovered && (!m.contenido || m.contenido.length === 0 || typeof m.contenido[0].asunto !== 'string')) {
                        m.contenido = [{ asunto: "[Error al descifrar: posible clave de dispositivo obsoleta]", archivos: [] }];
                    }
                }
            }
        }

        return { items, indiceInicio, cache_keys };
    }
};

// ==========================================
// FUNCIONES CRYPTO INTERNAS DEL WORKER
// (Duplicadas intencionalmente para evitar importar módulos con dependencias de Electron)
// ==========================================

function _cifrarConX25519(chainKeyHex, recipientPublicKeyPem) {
    let recipientPubKeyObj = _pubKeyCache.get(recipientPublicKeyPem);
    if (!recipientPubKeyObj) {
        recipientPubKeyObj = createPublicKey(recipientPublicKeyPem);
        _pubKeyCache.set(recipientPublicKeyPem, recipientPubKeyObj);
    }
    const { privateKey: ephPriv, publicKey: ephPub } = generateKeyPairSync('x25519', {});
    const sharedSecret = diffieHellman({ privateKey: ephPriv, publicKey: recipientPubKeyObj });
    const wrappingKey = Buffer.from(hkdfSync('sha256', sharedSecret, Buffer.alloc(0), Buffer.from('ravage-ck-wrap'), 32));

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', wrappingKey, iv);
    const data = Buffer.concat([cipher.update(Buffer.from(chainKeyHex, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();

    const ephPubRaw = ephPub.export({ type: 'spki', format: 'der' }).slice(-32).toString('hex');
    return { ephPub: ephPubRaw, iv: iv.toString('hex'), data: data.toString('hex'), tag: tag.toString('hex') };
}

function _descifrarConX25519(envuelta, privateKeyPem) {
    if (!envuelta || !envuelta.ephPub || !envuelta.iv || !envuelta.data || !envuelta.tag) {
        throw new Error('X25519: estructura de clave envuelta inválida');
    }
    let privKeyObj = _privKeyCache.get(privateKeyPem);
    if (!privKeyObj) {
        privKeyObj = createPrivateKey(privateKeyPem);
        _privKeyCache.set(privateKeyPem, privKeyObj);
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

function _descifrarContenido(cifrado, key) {
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

function _desencriptarDatosSistema(encriptado, systemKeyHex) {
    if (!encriptado || typeof encriptado !== 'object' || !encriptado.data || !encriptado.iv || !encriptado.tag) return encriptado;
    try {
        const key = Buffer.from(systemKeyHex, 'hex');
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encriptado.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(encriptado.tag, 'hex'));
        let decrypted = Buffer.concat([
            decipher.update(Buffer.from(encriptado.data, 'hex')),
            decipher.final()
        ]);
        if (encriptado.compressed) {
            decrypted = gunzipSync(decrypted);
        }
        return decrypted.toString('utf8');
    } catch {
        return null;
    }
}

function _ratchetChainKey(chainKeyHex) {
    const chainKey = Buffer.from(chainKeyHex, 'hex');
    const messageKey = createHmac('sha256', chainKey).update(Buffer.from([0x01])).digest();
    const nextChainKey = createHmac('sha256', chainKey).update(Buffer.from([0x02])).digest();
    return {
        messageKey: messageKey,
        nextChainKey: nextChainKey.toString('hex')
    };
}

function _advanceChainKey(chainKeyHex) {
    return createHmac('sha256', Buffer.from(chainKeyHex, 'hex'))
        .update(Buffer.from([0x02]))
        .digest()
        .toString('hex');
}

// ==========================================
// DISPATCHER - Recibe mensajes del pool
// ==========================================

parentPort.on('message', async (msg) => {
    const { id, tipo, datos } = msg;

    try {
        const operacion = OPERACIONES[tipo];
        if (!operacion) {
            throw new Error(`Operación desconocida: "${tipo}"`);
        }

        const resultado = await operacion(datos);
        parentPort.postMessage({ id, resultado });
    } catch (err) {
        parentPort.postMessage({ id, error: err.message });
    }
});
