import { ChatsRavage } from '../models/Chat.js';
import { User } from '../models/User.js';
import { MessagesRavage } from '../models/Message.js';
import { mongoose, ObjectId } from '../utils/libs.js';
import { convertirObjectId } from '../utils/conversores.js';
import { getIDMongodbUsuario } from '../STORAGE/Variables_sesion.js';
import { Añadir_Entrada_Buzon_Usuario } from './BuzonRepository.js';
import { randomBytes } from 'crypto';
import { cifrarConPublica, descifrarConPrivada, descifrarContenido } from '../services/cryptoService.js';
import { readFileSession } from '../services/controladorArchivos.js';

export async function obtener_datos_chats({ data = [], grupales = null, mensajes = true }) {
    try {
        const chatIds = data
            .filter(c => grupales === null || c.grupo === grupales)
            .map(c => c.id || c._id)
            .filter(id => id && id !== "null" && id !== "undefined" && mongoose.Types.ObjectId.isValid(id));

        if (chatIds.length === 0) return [];

        const data_obtenida = await ChatsRavage.find(
            { _id: { $in: chatIds } }
        ).lean();

        if (mensajes) {
            const id_propio = getIDMongodbUsuario();
            const identity_data = await readFileSession('identity');

            for (let chat of data_obtenida) {
                chat.mensajes = await MessagesRavage.find({ id_chat: chat._id }).sort({ data: 1 }).lean();

                // Intentar descifrar mensajes si hay llave disponible
                if (chat.claves_cifradas && identity_data?.privateKey) {
                    const clave_obj = chat.claves_cifradas.find(c => c.usuario_id.toString() === id_propio.toString());
                    if (clave_obj) {
                        try {
                            const chatKeyHex = descifrarConPrivada(clave_obj.clave_envuelta, identity_data.privateKey);
                            const chatKey = Buffer.from(chatKeyHex, 'hex');

                            chat.mensajes = chat.mensajes.map(m => {
                                if (m.encriptado && m.encriptado.data) {
                                    try {
                                        const decrypted = descifrarContenido(m.encriptado, chatKey);
                                        m.contenido = JSON.parse(decrypted);
                                    } catch (err) {
                                        m.contenido = [{ asunto: "[Error al descifrar]", archivos: [] }];
                                    }
                                }
                                return m;
                            });
                        } catch (e) {
                            console.error("Error al obtener ChatKey para el chat:", chat._id);
                        }
                    }
                }
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
            ? { [datos_buscar]: 1 }
            : {};

        const data_obtenida = await ChatsRavage.findById(id_chat, projection).lean();
        if (!data_obtenida) return null;

        // Si no se pide un dato específico, buscar también los mensajes
        if (!datos_buscar) {
            data_obtenida.mensajes = await MessagesRavage.find({ 
                id_chat: new mongoose.Types.ObjectId(id_chat) 
            }).sort({ data: 1 }).lean();

            // Descifrar mensajes (sección repetida para chat único, se podría modularizar)
            const id_propio = getIDMongodbUsuario();
            const identity_data = await readFileSession('identity');
            if (data_obtenida.claves_cifradas && identity_data?.privateKey) {
                const clave_obj = data_obtenida.claves_cifradas.find(c => c.usuario_id.toString() === id_propio.toString());
                if (clave_obj) {
                    try {
                        const chatKeyHex = descifrarConPrivada(clave_obj.clave_envuelta, identity_data.privateKey);
                        const chatKey = Buffer.from(chatKeyHex, 'hex');
                        data_obtenida.mensajes = data_obtenida.mensajes.map(m => {
                            if (m.encriptado && m.encriptado.data) {
                                try {
                                    const decrypted = descifrarContenido(m.encriptado, chatKey);
                                    m.contenido = JSON.parse(decrypted);
                                } catch (err) {
                                    m.contenido = [{ asunto: "[Error al descifrar]", archivos: [] }];
                                }
                            }
                            return m;
                        });
                    } catch (e) { }
                }
            }
        }

        return convertirObjectId(data_obtenida);
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function CREAR_CHAT_NUEVO(ids = null, nombre = "", id_chat = null) {
    if (!ids || ids.length === 0) return false;
    const id_propio = getIDMongodbUsuario();

    // Limpiar id_chat por si viene "null" como string
    let chatIdLimpio = id_chat;
    if (chatIdLimpio === "null" || chatIdLimpio === "undefined" || chatIdLimpio === "") chatIdLimpio = null;
    
    // Validar si es un ObjectId real
    const esIdentificadorValido = chatIdLimpio && mongoose.Types.ObjectId.isValid(chatIdLimpio);

    if (esIdentificadorValido) {
        const chat = await ChatsRavage.findById(chatIdLimpio);
        if (!chat) return false;

        const ids_añadir = ids.filter(id => !chat.usuarios.some(uid => uid.toString() === id.toString()));
        if (ids_añadir.length === 0) return true; // Ya estaban todos

        await ChatsRavage.updateOne(
            { _id: chatIdLimpio },
            { $addToSet: { usuarios: { $each: ids_añadir.map(id => new mongoose.Types.ObjectId(id)) } } }
        );

        // Actualizar a los usuarios existentes (y nuevos) en su lista de chats (User.chats)
        // Esto es importante para que se actualice el ultimoCambio
        const ids_totales = [...chat.usuarios, ...ids_añadir];
        await User.updateMany(
            { _id: { $in: ids_totales } },
            {
                $set: {
                    "chats.$[chat].ultimoCambio": new Date(),
                    "chats.$[chat].ultimomensaje": "Añadido nuevo usuario"
                }
            },
            { arrayFilters: [{ "chat.id": new mongoose.Types.ObjectId(chatIdLimpio) }] }
        );

        // Si algún usuario nuevo no tenía el chat en su lista, hay que añadírselo
        for (const id_nuevo of ids_añadir) {
            await User.updateOne(
                { _id: id_nuevo, "chats.id": { $ne: new mongoose.Types.ObjectId(chatIdLimpio) } },
                {
                    $push: {
                        chats: {
                            id: new mongoose.Types.ObjectId(chatIdLimpio),
                            nombre: chat.nombre,
                            grupo: chat.grupo,
                            ultimoCambio: new Date(),
                            ultimomensaje: "Bienvenido al chat"
                        }
                    }
                }
            );
        }

        const msgEspecial = await MessagesRavage.create({
            id_chat: chatIdLimpio,
            emisor: id_propio,
            especial: { tipo: 0, emisor: id_propio, añadido: ids_añadir[0] }
        });

        const ids_notificar = ids_totales.filter(x => x.toString() !== id_propio.toString());
        Añadir_Entrada_Buzon_Usuario({ 
            ids: ids_notificar, 
            tipo: 1, 
            data: { 
                chat: chatIdLimpio, 
                emisor: id_propio, 
                usuarios: ids_añadir, 
                añadido: ids_añadir[0], 
                mensaje: msgEspecial._id 
            } 
        }).catch(e => console.error(e));

        return true;
    }

    // CREAR CHAT NUEVO
    const grupo = ids.length !== 1 || nombre !== "";
    const ids_total = [...ids, id_propio];
    
    // E2EE: Generar ChatKey única para este chat
    const chatKeyBuffer = randomBytes(32);
    const chatKeyHex = chatKeyBuffer.toString('hex');

    // Obtener llaves públicas de los participantes
    const usuarios = await User.find({ _id: { $in: ids_total } }, "_id publicKey").lean();
    
    const claves_cifradas = usuarios.map(u => {
        if (!u.publicKey) return null; // Fallback para usuarios antiguos
        return {
            usuario_id: u._id,
            clave_envuelta: cifrarConPublica(chatKeyHex, u.publicKey)
        };
    }).filter(x => x !== null);

    let datos_chat;

    try {
        datos_chat = await ChatsRavage.create({
            nombre: grupo ? (nombre || "Grupo sin nombre") : "",
            usuarios: ids_total.map(id => new mongoose.Types.ObjectId(id)),
            grupo,
            claves_cifradas
        });

        await User.updateMany(
            { _id: { $in: ids_total } },
            {
                $push: {
                    chats: {
                        id: datos_chat._id,
                        nombre: datos_chat.nombre,
                        grupo: datos_chat.grupo,
                        ultimoCambio: new Date(),
                        ultimomensaje: "Chat recién creado"
                    }
                }
            }
        );

        if (!grupo) {
            const { AÑADIR_CONTACTO } = await import('./UserRepository.js');
            await AÑADIR_CONTACTO(ids[0], nombre);
        }

        Añadir_Entrada_Buzon_Usuario({ 
            ids: ids_total.filter(id => id.toString() !== id_propio.toString()), 
            tipo: 2, 
            data: { creador: id_propio, chat: datos_chat._id } 
        }).catch(e => console.error(e));

        return convertirObjectId(datos_chat.toObject());
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

        // Actualizar la lista de usuarios en el chat (MongoDB)
        await ChatsRavage.updateOne(
            { _id: id_chat },
            { $pull: { usuarios: new mongoose.Types.ObjectId(id_usuario) } }
        );

        // Actualizar a los demás usuarios para que vean "Usuario expulsado"
        await User.updateMany(
            { _id: { $in: chat.usuarios.filter(u => u.toHexString() !== id_usuario) } },
            {
                $set: {
                    "chats.$[chat].ultimoCambio": new Date(),
                    "chats.$[chat].ultimomensaje": "Usuario expulsado"
                }
            },
            { arrayFilters: [{ "chat.id": new mongoose.Types.ObjectId(id_chat) }] }
        );

        // Quitarle el chat al usuario expulsado
        await User.updateOne(
            { _id: id_usuario },
            { $pull: { chats: { id: new mongoose.Types.ObjectId(id_chat) } } }
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
