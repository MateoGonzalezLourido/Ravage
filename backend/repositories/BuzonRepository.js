import { BuzonUsuarios } from '../models/Buzon.js';
import { getIDMongodbUsuario } from '../STORAGE/Variables_sesion.js';

export async function Añadir_Entrada_Buzon_Usuario({ ids = [], tipo = 0, data = null }) {
    if (!ids || ids.length === 0) return;
    const id_propio = getIDMongodbUsuario();
    const lista_ids = Array.isArray(ids) ? ids : [ids];

    try {
        await BuzonUsuarios.updateMany(
            { _id: { $in: lista_ids } },
            {
                $push: {
                    entrada: { tipo, data }
                }
            },
            { upsert: true }
        );
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

export async function Revisar_Buzon_Usuario() {
    const userId = getIDMongodbUsuario();
    try {
        const buzon = await BuzonUsuarios.findById(userId);
        if (!buzon || buzon.entrada.length === 0) return [];
        
        const entradas = [...buzon.entrada];
        await BuzonUsuarios.updateOne(
            { _id: userId },
            { $set: { entrada: [] } }
        );
        return entradas;
    } catch (e) {
        console.error(e);
        return [];
    }
}
