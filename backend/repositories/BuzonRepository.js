import { createLogger } from '../utils/logger.js';
const log = createLogger('buzon-repo');
import { BuzonUsuarios } from '../models/Buzon.js';
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
                let bloqueado_o_silenciado = false;

                // Usuario invisible = silenciado global, no recibe notificaciones
                if (usr.invisible) bloqueado_o_silenciado = true;
                
                if (emisorId) {
                    const strEmisor = emisorId.toString();
                    if (usr.users_bloq && usr.users_bloq.some(id => id.toString() === strEmisor)) bloqueado_o_silenciado = true;
                    if (usr.users_silence && usr.users_silence.some(id => id.toString() === strEmisor)) bloqueado_o_silenciado = true;
                }
                
                if (chatId) {
                    const strChat = chatId.toString();
                    const chatInfo = usr.chats?.find(c => c.id.toString() === strChat);
                    if (chatInfo && (chatInfo.silenciado || chatInfo.bloqueado)) {
                        bloqueado_o_silenciado = true;
                    }
                }
                
                if (!bloqueado_o_silenciado) {
                    ids_finales.push(usr._id);
                }
            }
        } else {
            ids_finales.push(...lista_ids);
        }

        if (ids_finales.length === 0) return true;

        await BuzonUsuarios.updateMany(
            { _id: { $in: ids_finales } },
            {
                $push: {
                    entrada: {
                        $each: [{ tipo, data: encriptarDatosSistema(data) }],
                        $slice: -20
                    }
                }
            },
            { upsert: true }
        );
        return true;
    } catch (e) {
        log.error(e);
        return false;
    }
}

export async function Revisar_Buzon_Usuario() {
    const userId = getIDMongodbUsuario();
    try {
        const buzon = await BuzonUsuarios.findById(userId);
        if (!buzon || buzon.entrada.length === 0) return [];
        
        const entradas = buzon.entrada.map(ent => ({
            tipo: ent.tipo,
            data: ent.data ? desencriptarDatosSistema(ent.data) : null
        }));

        await BuzonUsuarios.updateOne(
            { _id: userId },
            { $set: { entrada: [] } }
        );
        return entradas;
    } catch (e) {
        log.error(e);
        return [];
    }
}

