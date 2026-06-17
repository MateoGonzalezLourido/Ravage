import { mongoose } from '../utils/libs.js';
import { MembresiaChat } from '../models/MembresiaChat.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('membresia-repo');

function toObjectId(id) {
    if (!id) return null;
    const s = id.toString();
    return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : null;
}

/**
 * Registra la entrada de un usuario a un chat.
 * primer_msg_id: ID del mensaje a partir del cual puede ver (null = desde el inicio).
 */
export async function registrar_entrada_chat(usuario_id, chat_id, primer_msg_id) {
    try {
        const uid = toObjectId(usuario_id);
        const cid = toObjectId(chat_id);
        if (!uid || !cid) return;
        await MembresiaChat.updateOne(
            { usuario_id: uid, chat_id: cid },
            { $push: { bloques: { entro: primer_msg_id ? toObjectId(primer_msg_id) : null, salio: null } } },
            { upsert: true }
        );
    } catch (e) {
        log.error(e, 'registrar_entrada_chat');
    }
}

/**
 * Registra la salida de un usuario de un chat cerrando el bloque abierto.
 * ultimo_msg_id: ID del último mensaje que puede ver.
 * Si no hay bloque abierto (miembro original sin registro), crea uno retroactivo {entro:null, salio}.
 */
export async function registrar_salida_chat(usuario_id, chat_id, ultimo_msg_id) {
    try {
        const uid = toObjectId(usuario_id);
        const cid = toObjectId(chat_id);
        if (!uid || !cid) return;
        const salioId = ultimo_msg_id ? toObjectId(ultimo_msg_id) : null;

        const result = await MembresiaChat.updateOne(
            { usuario_id: uid, chat_id: cid, 'bloques.salio': null },
            { $set: { 'bloques.$.salio': salioId } }
        );

        // Primera salida sin registro previo (miembro original): crear bloque retroactivo
        if (result.matchedCount === 0) {
            await MembresiaChat.updateOne(
                { usuario_id: uid, chat_id: cid },
                { $push: { bloques: { entro: null, salio: salioId } } },
                { upsert: true }
            );
        }
    } catch (e) {
        log.error(e, 'registrar_salida_chat');
    }
}

/**
 * Filtra los mensajes de un chat según los bloques de membresia del usuario.
 * Si no hay registro (miembro original o datos pre-sistema): devuelve todos.
 */
export async function filtrar_mensajes_membresia(usuario_id, chat_id, mensajes) {
    if (!mensajes || mensajes.length === 0) return mensajes;
    try {
        const uid = toObjectId(usuario_id);
        const cid = toObjectId(chat_id);
        if (!uid || !cid) return mensajes;

        const doc = await MembresiaChat.findOne({ usuario_id: uid, chat_id: cid }).lean();

        // Sin registro → miembro original o datos anteriores al sistema: sin restricción
        if (!doc || doc.bloques.length === 0) return mensajes;

        return mensajes.filter(msg => {
            const mid = (msg._id || msg.id).toString();
            return doc.bloques.some(b => {
                const desdeEntrada = !b.entro || mid >= b.entro.toString();
                const hastaSalida  = !b.salio || mid <= b.salio.toString();
                return desdeEntrada && hastaSalida;
            });
        });
    } catch (e) {
        log.error(e, 'filtrar_mensajes_membresia');
        return mensajes;
    }
}
