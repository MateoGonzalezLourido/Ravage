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
    publicEncrypt, 
    privateDecrypt, 
    createCipheriv, 
    createDecipheriv, 
    createHmac,
    constants 
} from 'node:crypto';
import { promisify } from 'node:util';

const generateKeyPairAsync = promisify(generateKeyPair);

// ==========================================
// OPERACIONES DISPONIBLES
// ==========================================

const OPERACIONES = {
    /**
     * Genera un par de claves RSA-2048
     */
    async GENERAR_LLAVES_RSA() {
        return await generateKeyPairAsync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
    },

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
     * Cifra datos con llave pública RSA-OAEP
     * @param {object} datos - { datosStr, publicKey }
     */
    CIFRAR_RSA({ datosStr, publicKey }) {
        return publicEncrypt({
            key: publicKey,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        }, Buffer.from(datosStr)).toString('hex');
    },

    /**
     * Descifra datos con llave privada RSA-OAEP
     * @param {object} datos - { datosHex, privateKey }
     */
    DESCIFRAR_RSA({ datosHex, privateKey }) {
        if (!datosHex || typeof datosHex !== 'string') {
            throw new Error("RSA: Ciphertext must be a hex string.");
        }
        return privateDecrypt({
            key: privateKey,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        }, Buffer.from(datosHex, 'hex')).toString('utf8');
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
     * @param {string} datos.privateKey - Llave privada PEM del usuario
     * @param {string} [datos.systemKey] - Llave de sistema (hex) para fallback
     */
    DESCIFRAR_BATCH_MENSAJES({ items, indiceInicio, ratchet_keys, id_propio, privateKey, systemKey }) {
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
                            ck_hex = _descifrarConPrivada(entry.clave_envuelta, privateKey);
                        } catch (rsaErr) {
                            throw new Error(`Error RSA: ${rsaErr.message}`);
                        }

                        current_state = { ck: ck_hex, counter: entry.counter };
                        cache_keys[cache_key] = current_state;
                    }

                    // Ratchet forward
                    while (current_state.counter < m.ratchet_info.iteration) {
                        const { nextChainKey } = _ratchetChainKey(current_state.ck);
                        current_state.ck = nextChainKey;
                        current_state.counter++;
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
                        if (m.contenido && m.contenido.length > 0 && m.contenido[0].asunto) {
                            const asuntoRaw = m.contenido[0].asunto;
                            if (typeof asuntoRaw === 'object' && asuntoRaw.data && systemKey) {
                                m.contenido[0].asunto = _desencriptarDatosSistema(asuntoRaw, systemKey);
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
                                throw new Error(`AES-GCM: Tag mismatch. ${aesErr.message}`);
                            }
                        } else {
                            throw new Error(`AES-GCM: Sin copia. ${aesErr.message}`);
                        }
                    }

                    // Avanzar cadena
                    current_state.ck = nextChainKey;
                    current_state.counter++;

                } catch (err) {
                    if (!m.contenido || m.contenido.length === 0 || typeof m.contenido[0].asunto !== 'string') {
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

function _descifrarConPrivada(datosHex, privateKey) {
    if (!datosHex || typeof datosHex !== 'string') {
        throw new Error("RSA: Ciphertext must be a hex string.");
    }
    return privateDecrypt({
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
    }, Buffer.from(datosHex, 'hex')).toString('utf8');
}

function _descifrarContenido(cifrado, key) {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(cifrado.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(cifrado.tag, 'hex'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(cifrado.data, 'hex')),
        decipher.final()
    ]);
    return decrypted.toString('utf8');
}

function _desencriptarDatosSistema(encriptado, systemKeyHex) {
    if (!encriptado || typeof encriptado !== 'object' || !encriptado.data || !encriptado.iv || !encriptado.tag) return encriptado;
    try {
        const key = Buffer.from(systemKeyHex, 'hex');
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(encriptado.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(encriptado.tag, 'hex'));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(encriptado.data, 'hex')),
            decipher.final()
        ]);
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
