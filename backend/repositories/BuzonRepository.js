import { createLogger } from '../utils/logger.js';
const log = createLogger('buzon-repo');
import { BuzonUsuarios, MAX_ENTRADAS } from '../models/Buzon.js';
import { getIDMongodbUsuario } from '../STORAGE/Variables_sesion.js';
import { encriptarDatosSistema, desencriptarDatosSistema } from '../services/cryptoService.js';
import { User } from '../models/User.js';

export async function Añadir_Entrada_Buzon_Usuario({ ids = [], tipo = 0, data = null }) {
    if (!ids || ids.length === 0) return;
    const lista_ids = Array.isArray(ids) ? ids : [ids];

    try {
        const emisorId = data?.emisor || data?.creador;
        const chatId = data?.chat;
        const ids_finales = [];

        if (emisorId || chatId) {
            const usuariosPref = await User.find(
                { _id: { $in: lista_ids } },
                "users_bloq users_silence chats invisible"
            ).lean();

            for (const usr of usuariosPref) {
                let bloqueado_o_silenciado = usr.invisible ?? false;

                if (!bloqueado_o_silenciado && emisorId) {
                    const bloq = new Set((usr.users_bloq || []).map(id => id.toString()));
                    const sil = new Set((usr.users_silence || []).map(id => id.toString()));
                    const strEmisor = emisorId.toString();
                    if (bloq.has(strEmisor) || sil.has(strEmisor)) bloqueado_o_silenciado = true;
                }

                if (!bloqueado_o_silenciado && chatId) {
                    const strChat = chatId.toString();
                    const chatInfo = (usr.chats || []).find(c => c.id.toString() === strChat);
                    if (chatInfo?.silenciado || chatInfo?.bloqueado) bloqueado_o_silenciado = true;
                }

                if (!bloqueado_o_silenciado) ids_finales.push(usr._id);
            }
        } else {
            ids_finales.push(...lista_ids);
        }

        if (ids_finales.length === 0) return;

        // Excluir al emisor para que no reciba notificaciones de sus propios actos
        const ids_filtrados = emisorId 
            ? ids_finales.filter(id => id.toString() !== emisorId.toString())
            : ids_finales;

        if (ids_filtrados.length === 0) return;

        const dataEncriptada = encriptarDatosSistema(data);
        const operations = ids_filtrados.map(id => ({
            updateOne: {
                filter: { _id: id },
                update: {
                    $push: {
                        entrada: {
                            $each: [{ tipo, data: dataEncriptada }],
                            $slice: -MAX_ENTRADAS
                        }
                    }
                },
                upsert: true
            }
        }));

        await BuzonUsuarios.bulkWrite(operations);
    } catch (e) {
        log.error(e);
    }
}

export async function Revisar_Buzon_Usuario() {
    const userId = getIDMongodbUsuario();
    try {
        const buzon = await BuzonUsuarios.findByIdAndUpdate(
            userId,
            { $set: { entrada: [] } },
            { new: false, lean: true }
        );

        if (!buzon || buzon.entrada.length === 0) return [];

        return buzon.entrada.map(ent => ({
            tipo: ent.tipo,
            data: ent.data ? desencriptarDatosSistema(ent.data) : null
        }));
    } catch (e) {
        log.error(e);
        return [];
    }
}

