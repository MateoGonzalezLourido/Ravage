import { ChatsRavage } from '../models/Chat.js';
import { User } from '../models/User.js';
import { MessagesRavage } from '../models/Message.js';
import { mongoose, ObjectId } from '../utils/libs.js';
import { getIDMongodbUsuario } from '../STORAGE/Variables_sesion.js';
import { Añadir_Entrada_Buzon_Usuario } from './BuzonRepository.js';

function convertirObjectId(v) {
    if (v instanceof ObjectId) return v.toString();
    if (Array.isArray(v)) return v.map(convertirObjectId);
    if (v && typeof v === "object") {
        for (const k in v) v[k] = convertirObjectId(v[k]);
    }
    return v;
}

export async function obtener_datos_chats({ data = [], grupales = null, mensajes = true }) {
    try {
        const chatIds = data
            .filter(c => grupales === null || c.grupo === grupales)
            .map(c => c.id);

        if (chatIds.length === 0) return [];

        const data_obtenida = await ChatsRavage.find(
            { _id: { $in: chatIds } },
            { _id: 1 }
        ).lean();

        if (mensajes) {
            for (let chat of data_obtenida) {
                chat.mensajes = await MessagesRavage.find({ id_chat: chat._id }).sort({ data: 1 }).lean();
            }
        }

        return data_obtenida.map(convertirObjectId);
    } catch (e) {
        console.error(e);
        return [];
    }
}

export async function obtener_datos_chat_unico(id_chat, datos_buscar = null) {
    try {
        if (!id_chat || !mongoose.Types.ObjectId.isValid(id_chat)) return null;

        const projection = datos_buscar
            ? { [datos_buscar]: 1, _id: 0 }
            : { _id: 0 };

        const data_obtenida = await ChatsRavage.findById(id_chat, projection).lean();
        if (!data_obtenida) return null;

        return convertirObjectId(data_obtenida);
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function CREAR_CHAT_NUEVO(ids = null, nombre = "", id_chat = null) {
    if (!ids || ids.length === 0) return false;
    const id_propio = getIDMongodbUsuario();

    if (id_chat) {
        const chat = await ChatsRavage.findById(id_chat);
        if (!chat || chat?.grupo) return false;

        const ids_añadir = ids.filter(id => !chat.usuarios.includes(id));
        if (ids_añadir.length === 0) return false;

        await ChatsRavage.updateOne(
            { _id: id_chat },
            { $addToSet: { usuarios: { $each: ids_añadir } } }
        );

        const specialMessages = ids_añadir.map(id => ({
            id_chat: id_chat,
            emisor: id_propio,
            especial: { tipo: 0, emisor: id_propio, añadido: id }
        }));
        const msgs = await MessagesRavage.insertMany(specialMessages);
        const mensajeID = msgs[msgs.length - 1]?._id;

        const ids_mandar_mensaje = [...chat.usuarios, ...ids_añadir].filter(x => x != id_propio);
        for (const id_destinatario of ids_mandar_mensaje) {
            Añadir_Entrada_Buzon_Usuario({ 
                ids: id_destinatario, 
                tipo: 1, 
                data: { chat: id_chat, emisor: id_propio, añadido: id_destinatario, mensaje: mensajeID } 
            }).catch(e => console.error(e));
        }

        return true;
    }

    const grupo = ids.length !== 1;
    const ids_total = [...ids, id_propio];
    let datos_chat;

    try {
        datos_chat = await ChatsRavage.create({
            nombre: grupo ? nombre : "",
            usuarios: ids_total,
            grupo
        });

        await User.updateMany(
            { _id: { $in: ids_total } },
            {
                $addToSet: {
                    chats: {
                        id: datos_chat._id,
                        nombre: datos_chat.nombre,
                        grupo: datos_chat.grupo,
                        ultimoCambio: new Date(),
                        ultimomensaje: "Bienvenido😀"
                    }
                }
            }
        );

        Añadir_Entrada_Buzon_Usuario({ 
            ids: ids_total, 
            tipo: 2, 
            data: { creador: id_propio, id_chat: datos_chat._id } 
        }).catch(e => console.error(e));

        return datos_chat;
    } catch (e) {
        if (datos_chat?._id) await ChatsRavage.deleteOne({ _id: datos_chat._id });
        throw e;
    }
}

export async function expulsar_usuario_chat(id_usuario, id_chat) {
    try {
        const chat = await ChatsRavage.findById(id_chat);
        if (!chat) return false;
        const id_propio = getIDMongodbUsuario();
        const existe = chat.usuarios.some(usuario => usuario.toHexString() === id_usuario);
        if (!existe) return false;

        chat.usuarios = chat.usuarios.filter(usuario => usuario.toHexString() != id_usuario);

        await User.updateMany(
            { _id: { $in: chat.usuarios } },
            {
                $set: {
                    "chats.$[chat].ultimoCambio": new Date(),
                    "chats.$[chat].ultimomensaje": "Usuario expulsado"
                }
            },
            { arrayFilters: [{ "chat.id": chat._id?.toHexString() }] }
        );

        const msgExpulsion = await MessagesRavage.create({
            id_chat: id_chat,
            emisor: id_propio,
            especial: { tipo: 1, emisor: id_propio, expulsado: id_usuario }
        });

        Añadir_Entrada_Buzon_Usuario({ 
            ids: chat.usuarios, 
            tipo: 4, 
            data: { chat: id_chat, expulsado: id_usuario, id_mensaje: msgExpulsion._id?.toHexString(), mensaje: msgExpulsion._id, emisor: id_propio } 
        }).catch(e => console.error(e));

        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}
