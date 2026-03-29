import { descifrarContenido, descifrarConPrivada, ratchetChainKey, cifrarConPublica, desencriptarDatosSistema } from './cryptoService.js';
import { readFileSession } from './controladorArchivos.js';
import { getIDMongodbUsuario } from '../STORAGE/Variables_sesion.js';
import { ChatsRavage } from '../models/Chat.js';

/**
 * Helper para descifrar un array de mensajes usando el sistema de Ratchet.
 * @param {Array} mensajes - Array de mensajes de MongoDB (lean)
 * @param {Object} chat - El objeto chat completo de MongoDB (lean o hidratado)
 */
export async function descifrarListaMensajes(mensajes, chat) {
    if (!mensajes || !chat || !chat.ratchet_keys) return mensajes;

    const id_propio = getIDMongodbUsuario()?.toString();
    const identity_data = await readFileSession('identity');
    if (!identity_data || !identity_data.privateKey || !id_propio) return mensajes;

    // Caché local de claves para este lote de mensajes
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
                                nombre: (a.nombre && typeof a.nombre === 'object') ? desencriptarDatosSistema(a.nombre) : a.nombre
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
                                    nombre: (a.nombre && typeof a.nombre === 'object') ? desencriptarDatosSistema(a.nombre) : a.nombre
                                }));
                            }
                        } else {
                             throw new Error(`Error AES-GCM: Tag mismatch. Clave incorrecta. ${err.message}`);
                        }
                    } else {
                        throw new Error(`Error AES-GCM: Tag mismatch. Sin copia de respaldo. ${err.message}`);
                    }
                }

                // Avanzar para el siguiente mensaje (siempre avanzamos para mantener sincronía)
                current_state.ck = nextChainKey;
                current_state.counter++;
                
            } catch (err) {
                console.error(`[E2EE] Fallo descifrando msg ${m._id || m.id}:`, err.message);
                if (!m.contenido || m.contenido.length === 0 || typeof m.contenido[0].asunto !== 'string') {
                    m.contenido = [{ asunto: "[Error al descifrar: posible clave de dispositivo obsoleta]", archivos: [] }];
                }
            }
        }
    }

    // Persistir avances en DB
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
        ).catch(e => console.error("[E2EE] Fallo persistiendo ratchet state:", e));
    }

    return mensajes;
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

