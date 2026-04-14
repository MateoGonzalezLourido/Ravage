import { createLogger } from '../utils/logger.js';
const log = createLogger('msg-crypto');
import { descifrarContenido, descifrarConPrivada, ratchetChainKey, cifrarConPublica, desencriptarDatosSistema } from './cryptoService.js';
import { readFileSession } from './controladorArchivos.js';
import { getIDMongodbUsuario } from '../STORAGE/Variables_sesion.js';
import { ChatsRavage } from '../models/Chat.js';
import { getCryptoPool } from '../utils/workerPool.js';

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
    const identity_data = await readFileSession('identity');
    if (!identity_data || !identity_data.privateKey || !id_propio) return mensajes;

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
                        ck_hex = descifrarConPrivada(entry.clave_envuelta, identity_data.privateKey);
                    } catch (rsaErr) {
                        throw new Error(`Error RSA: Fallo al descifrar el eslabón de la cadena. ${rsaErr.message}`);
                    }

                    current_state = { ck: ck_hex, counter: entry.counter };
                    cache_keys[cache_key] = current_state;
                }

                // Ratchett forward si el mensaje es más reciente
                while (current_state.counter < m.ratchet_info.iteration) {
                    const { nextChainKey } = ratchetChainKey(current_state.ck);
                    current_state.ck = nextChainKey;
                    current_state.counter++;
                }

                // Obtener la MK para este mensaje e iteración
                const { messageKey, nextChainKey } = ratchetChainKey(current_state.ck);

                let decryptedPayload;
                try {
                    decryptedPayload = descifrarContenido(m.encriptado, messageKey);

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
                } catch (aesErr) {
                    // FALLBACK: Si falla E2EE, intentar descifrar la copia del sistema si existe (ej: copia legible del emisor)
                    if (m.contenido && m.contenido.length > 0 && m.contenido[0].asunto) {
                        const asuntoRaw = m.contenido[0].asunto;
                        if (typeof asuntoRaw === 'object' && asuntoRaw.data) {
                            m.contenido[0].asunto = desencriptarDatosSistema(asuntoRaw);
                            if (m.contenido[0].archivos) {
                                m.contenido[0].archivos = m.contenido[0].archivos.map(a => ({
                                    ...a,
                                    nombre: (a.nombre && typeof a.nombre === 'object') ? desencriptarDatosSistema(a.nombre) : a.nombre,
                                    ratchet_info: m.ratchet_info,
                                    emisor_id: emisor_id
                                }));
                            }
                        } else {
                            throw new Error(`Error AES-GCM: Tag mismatch. Clave incorrecta. ${aesErr.message}`);
                        }
                    } else {
                        throw new Error(`Error AES-GCM: Tag mismatch. Sin copia de respaldo. ${aesErr.message}`);
                    }
                }

                // Avanzar para el siguiente mensaje (siempre avanzamos para mantener sincronía)
                current_state.ck = nextChainKey;
                current_state.counter++;

            } catch (err) {
                log.error({ err, msgId: m._id || m.id }, "[E2EE] Fallo descifrando msg");
                if (!m.contenido || m.contenido.length === 0 || typeof m.contenido[0].asunto !== 'string') {
                    m.contenido = [{ asunto: "[Error al descifrar: posible clave de dispositivo obsoleta]", archivos: [] }];
                }
            }
        }
    }

    await _persistirRatchetState(cache_keys, chat, identity_data);
    return mensajes;
}

/**
 * Descifrado paralelo con Worker Pool.
 * Divide los mensajes entre N workers para descifrar simultáneamente.
 */
async function _descifrarBatchParalelo(mensajes, chat, id_propio, identity_data) {
    const pool = getCryptoPool();

    // Serializar ratchet_keys para enviar al worker (sin métodos Mongoose)
    const ratchet_keys = chat.ratchet_keys.map(k => ({
        emisor_id: k.emisor_id.toString(),
        receptor_id: k.receptor_id.toString(),
        clave_envuelta: k.clave_envuelta,
        counter: k.counter
    }));

    // Preparar mensajes serializados (sin métodos Mongoose) 
    const mensajesSerializados = mensajes.map(m => ({
        _id: m._id?.toString?.() || m._id,
        emisor: m.emisor?.toString?.() || m.emisor,
        contenido: m.contenido,
        encriptado: m.encriptado,
        ratchet_info: m.ratchet_info,
        data: m.data
    }));

    // Obtener systemKey para fallback de descifrado de sistema en workers
    const systemKey = process.env.INTERNAL_ENCRYPTION_KEY || null;

    const resultados = await pool.ejecutarBatch(
        'DESCIFRAR_BATCH_MENSAJES',
        mensajesSerializados,
        {
            ratchet_keys,
            id_propio: id_propio.toString(),
            privateKey: identity_data.privateKey,
            systemKey
        }
    );

    // Recomponer mensajes originales con los descifrados
    // Reunir cache_keys de todos los workers para persistir
    const cache_keys_combinado = {};

    for (let i = 0; i < resultados.length; i++) {
        if (resultados[i]) {
            // Copiar datos descifrados al mensaje original
            mensajes[i].contenido = resultados[i].contenido;
            if (resultados[i].emisor) mensajes[i].emisor = resultados[i].emisor;
            if (resultados[i].data) mensajes[i].data = resultados[i].data;
        }
    }

    // Persistir ratchet state — necesitamos recalcular desde main thread
    // ya que los workers no pueden acceder a la DB
    await _persistirRatchetStateDesdeBatch(mensajes, chat, id_propio, identity_data);

    return mensajes;
}

/**
 * Persiste los avances del ratchet en la DB (modo secuencial).
 */
async function _persistirRatchetState(cache_keys, chat, identity_data) {
    for (const [key, state] of Object.entries(cache_keys)) {
        const [emisor_id, receptor_id] = key.split('_');
        await ChatsRavage.updateOne(
            { _id: chat._id, "ratchet_keys.emisor_id": emisor_id, "ratchet_keys.receptor_id": receptor_id },
            {
                $set: {
                    "ratchet_keys.$.clave_envuelta": cifrarConPublica(state.ck, identity_data.publicKey),
                    "ratchet_keys.$.counter": state.counter
                }
            }
        ).catch(e => log.error({ err: e }, "[E2EE] Fallo persistiendo ratchet state"));
    }
}

/**
 * Persiste ratchet state después de batch paralelo.
 * Recalcula el estado final basándose en el último mensaje procesado de cada emisor.
 */
async function _persistirRatchetStateDesdeBatch(mensajes, chat, id_propio, identity_data) {
    // Encontrar el último mensaje de cada emisor para saber el counter final
    const ultimosPorEmisor = {};
    for (const m of mensajes) {
        if (m.ratchet_info && m.emisor) {
            const emisor_id = m.emisor.toString();
            if (!ultimosPorEmisor[emisor_id] || m.ratchet_info.iteration > ultimosPorEmisor[emisor_id].iteration) {
                ultimosPorEmisor[emisor_id] = m.ratchet_info;
            }
        }
    }

    // Para cada emisor, avanzar desde la clave base hasta el último counter + 1
    for (const [emisor_id, ratchet_info] of Object.entries(ultimosPorEmisor)) {
        const entry = chat.ratchet_keys.find(k =>
            k.emisor_id.toString() === emisor_id &&
            k.receptor_id.toString() === id_propio.toString()
        );
        if (!entry) continue;

        try {
            let ck = descifrarConPrivada(entry.clave_envuelta, identity_data.privateKey);
            let counter = entry.counter;

            // Avanzar hasta el último mensaje + 1
            while (counter <= ratchet_info.iteration) {
                const { nextChainKey } = ratchetChainKey(ck);
                ck = nextChainKey;
                counter++;
            }

            await ChatsRavage.updateOne(
                { _id: chat._id, "ratchet_keys.emisor_id": emisor_id, "ratchet_keys.receptor_id": id_propio },
                {
                    $set: {
                        "ratchet_keys.$.clave_envuelta": cifrarConPublica(ck, identity_data.publicKey),
                        "ratchet_keys.$.counter": counter
                    }
                }
            ).catch(e => log.error({ err: e }, "[E2EE] Fallo persistiendo ratchet state (batch)"));
        } catch (err) {
            log.error({ err, emisor_id }, "[E2EE] Fallo recalculando ratchet final para batch");
        }
    }
}

/**
 * Deriva una clave de mensaje específica avanzando el ratchet.
 * No persiste el estado en la DB (solo para lectura puntual como descargas).
 */
export async function getMessageKey(chat, emisor_id, iteration) {
    if (!chat || !chat.ratchet_keys) return null;
    const id_propio = getIDMongodbUsuario();
    const identity_data = await readFileSession('identity');
    if (!identity_data || !identity_data.privateKey) return null;

    const entry = chat.ratchet_keys.find(k =>
        k.emisor_id.toString() === emisor_id.toString() &&
        k.receptor_id.toString() === id_propio.toString()
    );
    if (!entry) return null;

    const { descifrarConPrivada, ratchetChainKey } = await import('./cryptoService.js');
    let ck = descifrarConPrivada(entry.clave_envuelta, identity_data.privateKey);
    let current_counter = entry.counter;

    while (current_counter < iteration) {
        const { nextChainKey } = ratchetChainKey(ck);
        ck = nextChainKey;
        current_counter++;
    }

    const { messageKey } = ratchetChainKey(ck);
    return messageKey;
}

