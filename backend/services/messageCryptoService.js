import { createLogger } from '../utils/logger.js';
const log = createLogger('msg-crypto');
import { descifrarContenido, descifrarConX25519, descifrarConX25519Multi, getAllPrivateKeys, ratchetChainKey, advanceChainKey, cifrarConX25519, desencriptarDatosSistema, getIdentity } from './cryptoService.js';
import { getIDMongodbUsuario } from '../STORAGE/Variables_sesion.js';
import { ChatsRavage } from '../models/Chat.js';
import { getCryptoPool } from '../utils/workers/workerPool.js';

/** Umbral mínimo de mensajes encriptados para activar batch paralelo */
const UMBRAL_BATCH_PARALELO = 10;

/**
 * Helper para descifrar un array de mensajes usando el sistema de Ratchet.
 * Usa workers en paralelo cuando hay >UMBRAL mensajes encriptados.
 * @param {Array} mensajes - Array de mensajes de MongoDB (lean)
 * @param {Object} chat - El objeto chat completo de MongoDB (lean o hidratado)
 */
export async function descifrarListaMensajes(mensajes, chat) {
    if (!mensajes || !chat || !chat.ratchet_keys) return mensajes;

    const id_propio = getIDMongodbUsuario();
    const identity_data = await getIdentity();
    const _primaryKey = identity_data?.primary?.privateKey;
    if (!identity_data || !_primaryKey || !id_propio) return mensajes;

    // Contar mensajes que necesitan descifrado
    const mensajesEncriptados = mensajes.filter(m =>
        m.encriptado && m.encriptado.data && m.ratchet_info &&
        !(m.contenido && m.contenido.length > 0 && typeof m.contenido[0].asunto === 'string')
    );

    // Si hay suficientes mensajes, usar batch paralelo con workers
    if (mensajesEncriptados.length > UMBRAL_BATCH_PARALELO) {
        try {
            return await _descifrarBatchParalelo(mensajes, chat, id_propio, identity_data);
        } catch (err) {
            log.warn({ err }, '[E2EE] Batch paralelo falló, cayendo a modo secuencial');
            // Fallthrough al modo secuencial
        }
    }

    // Modo secuencial (pocos mensajes o fallback)
    return await _descifrarSecuencial(mensajes, chat, id_propio, identity_data);
}

/**
 * Descifrado secuencial en main thread (modo original).
 */
async function _descifrarSecuencial(mensajes, chat, id_propio, identity_data) {
    const cache_keys = {};

    for (let m of mensajes) {
        // Skip if already decrypted in a previous pass
        if (m.contenido && m.contenido.length > 0 && typeof m.contenido[0].asunto === 'string') continue;

        if (m.encriptado && m.encriptado.data && m.ratchet_info) {
            try {
                const emisor_id = m.emisor ? m.emisor.toString() : null;
                if (!emisor_id) continue;

                const cache_key = `${emisor_id}_${id_propio}`;

                let current_state = cache_keys[cache_key];
                if (!current_state) {
                    const entry = chat.ratchet_keys.find(k =>
                        k.emisor_id.toString() === emisor_id &&
                        k.receptor_id.toString() === id_propio
                    );
                    if (!entry) throw new Error("No hay llave de ratchet para este emisor");

                    let ck_hex;
                    try {
                        const allKeys = getAllPrivateKeys(identity_data);
                        const { result, isPrimary, keyId } = descifrarConX25519Multi(entry.clave_envuelta, allKeys);
                        ck_hex = result;
                        if (!isPrimary && identity_data.primary?.publicKey) {
                            const ck_snapshot = ck_hex;
                            const pubKey = identity_data.primary.publicKey;
                            setImmediate(() => reWrapChainKey(chat._id, emisor_id, id_propio, ck_snapshot, pubKey, entry.counter).catch(() => {}));
                        }
                    } catch (e2eErr) {
                        throw new Error(`Error E2EE: Fallo al descifrar el eslabón de la cadena. ${e2eErr.message}`);
                    }

                    current_state = { ck: ck_hex, counter: entry.counter };
                    cache_keys[cache_key] = current_state;
                }

                const emisor_id_str = m.emisor ? m.emisor.toString() : null;
                const es_propio = emisor_id_str === id_propio;

                if (es_propio && m.contenido && m.contenido.length > 0) {
                    const tieneAsuntoObjeto = m.contenido[0].asunto && typeof m.contenido[0].asunto === 'object';
                    const tieneArchivos = m.contenido[0].archivos && m.contenido[0].archivos.length > 0;
                    if (tieneAsuntoObjeto || tieneArchivos) {
                        try {
                            if (tieneAsuntoObjeto) {
                                m.contenido[0].asunto = desencriptarDatosSistema(m.contenido[0].asunto);
                            }
                            if (tieneArchivos) {
                                m.contenido[0].archivos = m.contenido[0].archivos.map(a => ({
                                    ...a,
                                    nombre: (a.nombre && typeof a.nombre === 'object') ? desencriptarDatosSistema(a.nombre) : a.nombre,
                                    ratchet_info: m.ratchet_info,
                                    emisor_id: emisor_id_str
                                }));
                            }
                            continue;
                        } catch (fErr) {
                            log.warn({ msgId: m._id || m.id }, "Fallo fallback propio, intentando ratchet...");
                        }
                    }
                }

                // Si el counter de la DB ya está por delante de este mensaje,
                // la clave base fue sobreescrita por una persistencia anterior.
                // No podemos derivar la clave correcta → ir directo a fallback de sistema.
                if (current_state.counter > m.ratchet_info.iteration) {
                    if (m.contenido && m.contenido.length > 0) {
                        if (m.contenido[0].asunto && typeof m.contenido[0].asunto === 'object') {
                            m.contenido[0].asunto = desencriptarDatosSistema(m.contenido[0].asunto);
                        }
                        if (m.contenido[0].archivos) {
                            m.contenido[0].archivos = m.contenido[0].archivos.map(a => ({
                                ...a,
                                nombre: (a.nombre && typeof a.nombre === 'object') ? desencriptarDatosSistema(a.nombre) : a.nombre,
                                ratchet_info: m.ratchet_info,
                                emisor_id: emisor_id
                            }));
                        }
                    }
                    continue;
                }

                // Ratchet forward si el mensaje es más reciente que nuestro contador
                let local_ck = current_state.ck;
                let local_counter = current_state.counter;

                let iterations_safety = 0;
                while (local_counter < m.ratchet_info.iteration && iterations_safety < 10000) {
                    local_ck = advanceChainKey(local_ck);
                    local_counter++;
                    iterations_safety++;
                }

                if (iterations_safety >= 10000) {
                    log.error({ msgId: m._id || m.id, iteration: m.ratchet_info.iteration }, "[E2EE] Safety limit reached in ratchet loop. Corrupted iteration value?");
                    throw new Error("Ratchet safety limit exceeded");
                }

                // Obtener MK y siguiente CK para esta iteración
                const { messageKey, nextChainKey } = ratchetChainKey(local_ck);

                try {
                    const decryptedPayload = descifrarContenido(m.encriptado, messageKey);
                    
                    const data = JSON.parse(decryptedPayload);
                    if (data && !Array.isArray(data)) {
                        m.contenido = [{
                            asunto: data.asunto,
                            archivos: (data.archivos || []).map(a => ({
                                ...a,
                                nombre: (a.nombre && typeof a.nombre === 'object') ? desencriptarDatosSistema(a.nombre) : a.nombre,
                                ratchet_info: m.ratchet_info,
                                emisor_id: emisor_id
                            }))
                        }];
                        m.emisor = data.emisor;
                        m.data = data.data;
                    }

                    // Si desciframos con éxito, avanzamos el estado global para el siguiente mensaje
                    current_state.ck = nextChainKey;
                    current_state.counter = local_counter + 1;
                } catch (aesErr) {
                    // FALLBACK: Si falla E2EE, intentar descifrar la copia del sistema si existe
                    if (m.contenido && m.contenido.length > 0) {
                        if (m.contenido[0].asunto && typeof m.contenido[0].asunto === 'object' && m.contenido[0].asunto.data) {
                            m.contenido[0].asunto = desencriptarDatosSistema(m.contenido[0].asunto);
                        }
                        if (m.contenido[0].archivos) {
                            m.contenido[0].archivos = m.contenido[0].archivos.map(a => ({
                                ...a,
                                nombre: (a.nombre && typeof a.nombre === 'object') ? desencriptarDatosSistema(a.nombre) : a.nombre,
                                ratchet_info: m.ratchet_info,
                                emisor_id: emisor_id
                            }));
                        }
                    }
                }

            } catch (err) {
                // FALLBACK AGRESIVO: Si el ratchet falla, intentar usar la copia de sistema
                try {
                    if (m.contenido && m.contenido.length > 0) {
                        const emisor_id = m.emisor ? m.emisor.toString() : null;
                        if (m.contenido[0].asunto && typeof m.contenido[0].asunto === 'object') {
                            m.contenido[0].asunto = desencriptarDatosSistema(m.contenido[0].asunto);
                        }
                        if (m.contenido[0].archivos) {
                            m.contenido[0].archivos = m.contenido[0].archivos.map(a => ({
                                ...a,
                                nombre: (a.nombre && typeof a.nombre === 'object') ? desencriptarDatosSistema(a.nombre) : a.nombre,
                                ratchet_info: m.ratchet_info,
                                emisor_id: emisor_id
                            }));
                        }
                    }
                } catch (fallbackErr) {
                    log.error({ err: fallbackErr, msgId: m._id || m.id }, "[E2EE] Fallo total incluyendo fallback");
                }

                if (!m.contenido || m.contenido.length === 0 || typeof m.contenido[0].asunto !== 'string') {
                    log.error({ err, msgId: m._id || m.id }, "[E2EE] Fallo descifrando msg");
                    m.contenido = [{ asunto: "[Error al descifrar: posible clave de dispositivo obsoleta]", archivos: [] }];
                }
            }
        }
    }

    // NO persistir el ratchet state del receptor: rompe la derivación de claves
    // para descargas de archivos de mensajes anteriores (getMessageKey).
    // El coste de re-derivar desde la base es despreciable (HMAC-SHA256 por iteración).
    return mensajes;
}

/**
 * Descifrado paralelo con Worker Pool.
 * Agrupa mensajes por emisor y despacha un job por emisor al pool.
 * Esto evita avances ratchet redundantes cuando los mensajes de un mismo
 * emisor se repartirían entre varios workers con el esquema anterior.
 */
async function _descifrarBatchParalelo(mensajes, chat, id_propio, identity_data) {
    const pool = getCryptoPool();

    const ratchet_keys = chat.ratchet_keys.map(k => ({
        emisor_id: k.emisor_id.toString(),
        receptor_id: k.receptor_id.toString(),
        clave_envuelta: k.clave_envuelta,
        counter: k.counter
    }));

    const allKeys = getAllPrivateKeys(identity_data);
    const systemKey = process.env.INTERNAL_ENCRYPTION_KEY || null;
    const datosComunes = {
        ratchet_keys,
        id_propio: id_propio.toString(),
        privateKey: identity_data.primary?.privateKey,
        privateKeys: allKeys.map(k => k.privateKey),
        systemKey
    };

    // Agrupar índices de mensajes por emisor (orden original preservado)
    const gruposPorEmisor = new Map();
    for (let i = 0; i < mensajes.length; i++) {
        const m = mensajes[i];
        if (!(m.encriptado?.data && m.ratchet_info)) continue;
        if (m.contenido?.length > 0 && typeof m.contenido[0].asunto === 'string') continue;
        const emisor_id = m.emisor?.toString?.() ?? m.emisor;
        if (!emisor_id) continue;
        if (!gruposPorEmisor.has(emisor_id)) gruposPorEmisor.set(emisor_id, []);
        gruposPorEmisor.get(emisor_id).push(i);
    }

    // Un job por emisor en paralelo — cada worker solo avanza un ratchet
    const promesas = [];
    for (const indices of gruposPorEmisor.values()) {
        const items = indices.map(idx => {
            const m = mensajes[idx];
            return {
                _id: m._id?.toString?.() || m._id,
                emisor: m.emisor?.toString?.() || m.emisor,
                contenido: m.contenido,
                encriptado: m.encriptado,
                ratchet_info: m.ratchet_info,
                data: m.data
            };
        });
        promesas.push(
            pool.ejecutar('DESCIFRAR_BATCH_MENSAJES', { ...datosComunes, items, indiceInicio: 0 })
                .then(res => ({ items: res.items, indices }))
        );
    }

    const resultados = await Promise.all(promesas);

    // Recomponer mensajes originales con los descifrados
    for (const { items, indices } of resultados) {
        for (let i = 0; i < items.length; i++) {
            const origIdx = indices[i];
            if (items[i]) {
                mensajes[origIdx].contenido = items[i].contenido;
                if (items[i].emisor) mensajes[origIdx].emisor = items[i].emisor;
                if (items[i].data) mensajes[origIdx].data = items[i].data;
            }
        }
    }

    // NO persistir ratchet state: rompe getMessageKey para archivos antiguos.
    return mensajes;
}


/**
 * Deriva una clave de mensaje específica avanzando el ratchet.
 * No persiste el estado en la DB (solo para lectura puntual como descargas).
 */
export async function getMessageKey(chat, emisor_id, iteration) {
    if (!chat || !chat.ratchet_keys) return null;
    const id_propio = getIDMongodbUsuario();
    const identity_data = await getIdentity();
    if (!identity_data || !identity_data.primary?.privateKey) return null;

    const entry = chat.ratchet_keys.find(k =>
        k.emisor_id.toString() === emisor_id.toString() &&
        k.receptor_id.toString() === id_propio.toString()
    );
    if (!entry) return null;

    const allKeys = getAllPrivateKeys(identity_data);
    let ck = descifrarConX25519Multi(entry.clave_envuelta, allKeys).result;
    let current_counter = entry.counter;

    // Si el counter de la DB ya fue avanzado más allá de la iteración solicitada,
    // la clave base fue sobreescrita y no podemos derivar la clave correcta.
    if (current_counter > iteration) {
        log.warn({ current_counter, iteration, emisor_id: emisor_id.toString() },
            '[E2EE] getMessageKey: counter > iteration, clave irrecuperable (ratchet state corrupto)');
        return null;
    }

    let iterations_safety = 0;
    while (current_counter < iteration && iterations_safety < 10000) {
        ck = advanceChainKey(ck);
        current_counter++;
        iterations_safety++;
    }

    if (iterations_safety >= 10000) {
        log.error({ emisor_id, iteration }, "[E2EE] Safety limit reached in getMessageKey");
        return null;
    }

    const { messageKey } = ratchetChainKey(ck);
    return messageKey;
}

/**
 * Re-envuelve la chain key con la clave pública principal actual y la persiste en MongoDB.
 * Se llama de forma asíncrona cuando un mensaje se descifró con una clave de soporte,
 * para migrar ese chat a la clave principal.
 */
async function reWrapChainKey(chatId, emisorId, receptorId, ck_hex, primaryPublicKey, counter) {
    try {
        const nuevaClave = cifrarConX25519(ck_hex, primaryPublicKey);
        const { mongoose } = await import('../utils/libs.js');

        // El re-wrap SOLO cambia el envoltorio de la chain key: nunca toca el counter.
        // Escribir el counter leído previamente (con $set) lo haría retroceder si
        // ENVIAR_MENSAJE hizo su $inc sobre la MISMA entrada mientras esto estaba en
        // vuelo (pasa cuando emisor_id === receptor_id === usuario propio, ver
        // MessageRepository.ENVIAR_MENSAJE), desincronizando el contador de la clave
        // envuelta y dejando mensajes antiguos irrecuperables en getMessageKey.
        //
        // Además, la condición sobre `counter` hace la operación atómica e idempotente:
        // si el ratchet avanzó entre la lectura y esta escritura, `ck_hex` ya está
        // obsoleto y la actualización simplemente no encaja (no-op) en vez de guardar
        // una clave envuelta que no corresponde al counter actual.
        const res = await ChatsRavage.updateOne(
            {
                _id: chatId,
                ratchet_keys: {
                    $elemMatch: {
                        emisor_id: new mongoose.Types.ObjectId(emisorId),
                        receptor_id: new mongoose.Types.ObjectId(receptorId),
                        counter: counter
                    }
                }
            },
            { $set: { "ratchet_keys.$.clave_envuelta": nuevaClave } }
        );

        if (res?.matchedCount === 0) {
            log.info({ chatId, emisorId, counter }, '[E2EE] Re-wrap omitido: el ratchet avanzó (clave obsoleta)');
        } else {
            log.info({ chatId, emisorId }, '[E2EE] Chain key re-wrapped con clave principal');
        }
    } catch (err) {
        log.warn({ err, chatId, emisorId }, '[E2EE] Fallo re-wrapping chain key');
    }
}

