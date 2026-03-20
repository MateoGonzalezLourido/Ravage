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

    const id_propio = getIDMongodbUsuario();
    const identity_data = await readFileSession('identity');
    if (!identity_data || !identity_data.privateKey) return mensajes;

    // Caché local de claves para este lote de mensajes
    const cache_keys = {}; 

    for (let m of mensajes) {
        if (m.encriptado && m.encriptado.data && m.ratchet_info) {
            try {
                const emisor_id = m.emisor ? m.emisor.toString() : null;
                if (!emisor_id || emisor_id === "000000000000000000000000") continue;

                const cache_key = `${emisor_id}_${id_propio}`;
                
                let current_state = cache_keys[cache_key];
                if (!current_state) {
                    const entry = chat.ratchet_keys.find(k => 
                        k.emisor_id.toString() === emisor_id && 
                        k.receptor_id.toString() === id_propio.toString()
                    );
                    if (!entry) throw new Error("No hay llave de ratchet para este emisor");
                    
                    const ck_hex = descifrarConPrivada(entry.clave_envuelta, identity_data.privateKey);
                    current_state = { ck: ck_hex, counter: entry.counter };
                    cache_keys[cache_key] = current_state;
                }

                // Ratchett forward si el mensaje es más reciente (o igual si queremos derivar la MK actual)
                while (current_state.counter < m.ratchet_info.iteration) {
                    const { nextChainKey } = ratchetChainKey(current_state.ck);
                    current_state.ck = nextChainKey;
                    current_state.counter++;
                }

                // Obtener la MK para este mensaje e iteración
                const { messageKey, nextChainKey } = ratchetChainKey(current_state.ck);
                
                const decryptedPayload = descifrarContenido(m.encriptado, messageKey);
                const data = JSON.parse(decryptedPayload);

                if (data && !Array.isArray(data)) {
                    m.contenido = [{ 
                        asunto: data.asunto, 
                        archivos: data.archivos.map(a => ({
                            ...a,
                            nombre: (a.nombre && typeof a.nombre === 'object') ? desencriptarDatosSistema(a.nombre) : a.nombre
                        }))
                    }];
                    m.emisor = data.emisor; 
                    m.data = data.data;
                }

                // Avanzar para el siguiente mensaje
                current_state.ck = nextChainKey;
                current_state.counter++;
                
            } catch (err) {
                console.error("Error descifrando mensaje con Ratchet:", err);
                m.contenido = [{ asunto: "[Error al descifrar]", archivos: [] }];
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
        ).catch(e => console.error("Fallo persistiendo ratchet state:", e));
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

