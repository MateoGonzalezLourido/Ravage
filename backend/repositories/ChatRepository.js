import { ChatsRavage } from '../models/Chat.js';
import { User } from '../models/User.js';
import { MessagesRavage } from '../models/Message.js';
import { mongoose } from '../utils/libs.js';
import { convertirObjectId } from '../utils/conversores.js';
import { getIDMongodbUsuario } from '../STORAGE/Variables_sesion.js';
import { Añadir_Entrada_Buzon_Usuario } from './BuzonRepository.js';
import { randomBytes } from '../utils/libs.js';
import { descifrarListaMensajes } from '../services/messageCryptoService.js';
import { readFileSession } from '../services/controladorArchivos.js';
import { cifrarConPublica, desencriptarDatosSistema, encriptarDatosSistema } from '../services/cryptoService.js';
import { getChatDeCache as getChatDeCacheRaw, setChatEnCache as setChatEnCacheRaw } from '../STORAGE/CACHE/_cache_chats.js';
import { obtener_datos_usuario } from './UserRepository.js';

/**
 * Helper para normalizar el chat antes de guardarlo en cache (sin contenido de mensajes).
 */
async function setChatEnCache(chat) {
    if (!chat) return;
    const chatCopia = { ...chat };
    if (chatCopia.mensajes && Array.isArray(chatCopia.mensajes)) {
        // Guardar solo IDs para seguir la regla de "no contenido" y ahorrar espacio
        chatCopia.mensajes = chatCopia.mensajes.map(m => m._id || m.id);
        chatCopia._hasFullMessages = false; 
    }
    await setChatEnCacheRaw(chatCopia);
}

/**
 * Helper para obtener de cache.
 */
async function getChatDeCache(id) {
    return await getChatDeCacheRaw(id);
}


export async function obtener_datos_chats({ data = [], grupales = null, mensajes = true }) {
    try {
        const chatIds = data
            .filter(c => grupales === null || c.grupo === grupales)
            .map(c => c.id || c._id)
            .filter(id => id && id !== "null" && id !== "undefined" && mongoose.Types.ObjectId.isValid(id));

        if (chatIds.length === 0) return [];

        const result = [];
        const missingIds = [];

        for (const id of chatIds) {
            const cached = await getChatDeCache(id);
            if (cached) {
                result.push(cached);
            } else {
                missingIds.push(id);
            }
        }

        if (missingIds.length > 0) {
            const data_obtenida = await ChatsRavage.find(
                { _id: { $in: missingIds } }
            ).lean();

            for (let chat of data_obtenida) {
                if (mensajes) {
                    chat.mensajes = await MessagesRavage.find({ id_chat: chat._id }).sort({ data: 1 }).lean();
                    await descifrarListaMensajes(chat.mensajes, chat);
                }
                await setChatEnCache(chat);
                result.push(chat);
            }
        }

        // Para los que vinieron de cache, si se piden mensajes y no los tienen (o solo tienen IDs), hay que cargarlos
        for (let i = 0; i < result.length; i++) {
            let chat = result[i];
            const tieneMensajesFull = chat.mensajes && Array.isArray(chat.mensajes) && chat.mensajes.length > 0 && typeof chat.mensajes[0] === 'object';
            
            if (mensajes && !tieneMensajesFull) {
                // El cache solo tiene IDs o nada. Cargar de DB.
                chat.mensajes = await MessagesRavage.find({ id_chat: chat._id }).sort({ data: 1 }).lean();
                await descifrarListaMensajes(chat.mensajes, chat);
                // No actualizamos cache aquí porque ya tenemos la meta-info y no queremos guardar contenido
            } else if (!mensajes && tieneMensajesFull) {
                // Se pidieron sin mensajes pero el cache los tiene (no debería pasar con el nuevo setChatEnCache)
                chat.mensajes = [];
            }
        }

        const data_con_nombres = await resolverNombresChats(result);
        return data_con_nombres.map(convertirObjectId);
    } catch (e) {
        console.error(e);
        return [];
    }
}

export async function obtener_datos_chat_unico(id_chat, datos_buscar = null) {
    try {
        if (!id_chat || !mongoose.Types.ObjectId.isValid(id_chat)) return null;

        if (!datos_buscar) {
            const cached = await getChatDeCache(id_chat);
            if (cached) return cached;
        }

        const projection = datos_buscar
            ? { [datos_buscar]: 1 }
            : {};

        const data_obtenida = await ChatsRavage.findById(id_chat, projection).lean();
        if (!data_obtenida) return null;

        if (!datos_buscar) {
            data_obtenida.mensajes = await MessagesRavage.find({ 
                id_chat: new mongoose.Types.ObjectId(id_chat) 
            }).sort({ data: 1 }).lean();

            await descifrarListaMensajes(data_obtenida.mensajes, data_obtenida);
            await setChatEnCache(data_obtenida);
        }

        const [data_con_nombre] = await resolverNombresChats([data_obtenida]);
        return convertirObjectId(data_con_nombre);
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function CREAR_CHAT_NUEVO(ids = null, nombre = "", id_chat = null, solicitudAceptada = false) {
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

        // Si el chat tiene exactamente 2 participantes y NO viene de una solicitud aceptada,
        // crear un mensaje especial de solicitud en vez de añadir directamente.
        if (chat.usuarios.length === 2 && !solicitudAceptada) {
            const msgSolicitud = await MessagesRavage.create({
                id_chat: chatIdLimpio,
                emisor: id_propio,
                especial: {
                    tipo: 2,
                    emisor: id_propio,
                    candidato: ids_añadir[0],
                    estado: "pendiente"
                }
            });

            // Actualizar ultimoCambio para que el chat suba en la lista
            await User.updateMany(
                { _id: { $in: chat.usuarios } },
                {
                    $set: {
                        "chats.$[chat].ultimoCambio": new Date(),
                        "chats.$[chat].ultimomensaje": "Solicitud: añadir usuario"
                    }
                },
                { arrayFilters: [{ "chat.id": new mongoose.Types.ObjectId(chatIdLimpio) }] }
            );

            // Notificar al otro participante
            const ids_notificar = chat.usuarios.filter(x => x.toString() !== id_propio.toString());
            Añadir_Entrada_Buzon_Usuario({
                ids: ids_notificar,
                tipo: 6, // tipo 6 = solicitud añadir usuario
                data: {
                    chat: chatIdLimpio,
                    emisor: id_propio,
                    candidato: ids_añadir[0],
                    mensaje: msgSolicitud._id
                }
            }).catch(e => console.error(e));

            return { solicitud: true, mensaje_id: msgSolicitud._id };
        }

        // 3+ participantes o solicitud aceptada: añadir directamente
        // Verificar si es admin (solo los admins pueden añadir a grupos de >2 personas)
        if (chat.usuarios.length > 2 && !chat.admins.some(a => a.toString() === id_propio.toString())) {
            return false;
        }

        await ChatsRavage.updateOne(
            { _id: chatIdLimpio },
            { $addToSet: { usuarios: { $each: ids_añadir.map(id => new mongoose.Types.ObjectId(id)) } } }
        );

        // Actualizar cache después de mutación
        const updatedChat = await ChatsRavage.findById(chatIdLimpio).lean();
        if (updatedChat) await setChatEnCache(updatedChat);

        // Actualizar a los usuarios existentes (y nuevos) en su lista de chats (User.chats)
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

    // CREAR CHAT NUEVO (Todos los chats se consideran expansibles/grupos)
    const ids_total = [...ids, id_propio];
    
    // Preparar ratchet_keys iniciales (Sender Key por usuario)
    const ratchet_keys = [];
    const usuarios_data = await User.find({ _id: { $in: ids_total } }, "_id publicKey").lean();

    for (const emisor of usuarios_data) {
        const chainKey = randomBytes(32).toString('hex');
        
        for (const receptor of usuarios_data) {
            if (!receptor.publicKey) continue;
            
            ratchet_keys.push({
                emisor_id: emisor._id,
                receptor_id: receptor._id,
                clave_envuelta: cifrarConPublica(chainKey, receptor.publicKey),
                counter: 0
            });
        }
    }

    let datos_chat;

    try {
        datos_chat = await ChatsRavage.create({
            nombre: nombre ? encriptarDatosSistema(nombre) : null,
            usuarios: ids_total.map(id => new mongoose.Types.ObjectId(id)),
            admins: ids_total.length === 2 ? ids_total.map(id => new mongoose.Types.ObjectId(id)) : [new mongoose.Types.ObjectId(id_propio)],
            grupo: true,
            ratchet_keys
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
                        ultimomensaje: encriptarDatosSistema("Chat recién creado")
                    }
                }
            }
        );


        if (ids.length === 1) { // Si hablas con una persona por primera vez, asegurar contacto
            const { AÑADIR_CONTACTO } = await import('./UserRepository.js');
            await AÑADIR_CONTACTO(ids[0], ""); // Añadir sin apodo definido para usar el global
        }

        Añadir_Entrada_Buzon_Usuario({ 
            ids: ids_total.filter(id => id.toString() !== id_propio.toString()), 
            tipo: 2, 
            data: { creador: id_propio, chat: datos_chat._id } 
        }).catch(e => console.error(e));

        // Actualizar cache con el nuevo chat
        await setChatEnCache(datos_chat.toObject());

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
        
        // Solo un admin puede expulsar
        if (!chat.admins.some(a => a.toString() === id_propio.toString())) return false;

        // Actualizar la lista de usuarios en el chat (MongoDB)
        await ChatsRavage.updateOne(
            { _id: id_chat },
            { $pull: { usuarios: new mongoose.Types.ObjectId(id_usuario) } }
        );

        // Actualizar cache
        const updatedChat = await ChatsRavage.findById(id_chat).lean();
        if (updatedChat) await setChatEnCache(updatedChat);

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

/**
 * Responder a una solicitud de añadir usuario a un chat de 2 personas.
 * @param {string} id_chat - ID del chat
 * @param {string} id_mensaje - ID del mensaje especial de solicitud
 * @param {boolean} aceptar - true para aceptar, false para rechazar
 */
export async function RESPONDER_SOLICITUD_AÑADIR(id_chat, id_mensaje, aceptar) {
    try {
        const id_propio = getIDMongodbUsuario();
        const chat = await ChatsRavage.findById(id_chat);
        if (!chat) return { success: false, message: "Chat no encontrado" };

        // Verificar que el usuario es miembro del chat
        if (!chat.usuarios.some(u => u.toString() === id_propio.toString())) {
            return { success: false, message: "No eres miembro de este chat" };
        }

        // Buscar el mensaje de solicitud
        const mensaje = await MessagesRavage.findOne({ _id: id_mensaje, id_chat: new mongoose.Types.ObjectId(id_chat) });
        if (!mensaje || !mensaje.especial || mensaje.especial.tipo !== 2) {
            return { success: false, message: "Solicitud no encontrada" };
        }
        if (mensaje.especial.estado !== "pendiente") {
            return { success: false, message: "Esta solicitud ya fue respondida" };
        }

        // Actualizar el estado de la solicitud
        const nuevoEstado = aceptar ? "aceptada" : "rechazada";
        await MessagesRavage.updateOne(
            { _id: id_mensaje },
            { $set: { "especial.estado": nuevoEstado } }
        );

        if (aceptar) {
            // Añadir al usuario pasando solicitudAceptada = true para saltar la comprobación
            const candidato_id = mensaje.especial.candidato.toString();
            await CREAR_CHAT_NUEVO([candidato_id], "", id_chat, true);
        }

        // Notificar al otro participante (el que hizo la solicitud)
        const emisor_solicitud = mensaje.especial.emisor.toString();
        if (emisor_solicitud !== id_propio.toString()) {
            Añadir_Entrada_Buzon_Usuario({
                ids: [emisor_solicitud],
                tipo: 7, // tipo 7 = respuesta a solicitud
                data: {
                    chat: id_chat,
                    mensaje: id_mensaje,
                    aceptada: aceptar,
                    respondido_por: id_propio
                }
            }).catch(e => console.error(e));
        }

        return { success: true, aceptada: aceptar };
    } catch (e) {
        console.error("Error en RESPONDER_SOLICITUD_AÑADIR:", e);
        return { success: false, message: "Error interno" };
    }
}

/**
 * Resuelve los nombres de visualización para una lista de chats.
 * Si el chat no tiene nombre y tiene 2 usuarios, busca el apodo en contactos o el global.
 */
async function resolverNombresChats(chats) {
    if (!chats || chats.length === 0) return chats;
    
    const id_propio = getIDMongodbUsuario();
    const usuario_actual = await User.findById(id_propio, "contactos").lean();
    if (!usuario_actual) return chats;

    const ids_otros_necesarios = new Set();
    
    // Identificar chats que necesitan resolución de nombre
    chats.forEach(chat => {
        if (!chat.nombre && chat.usuarios.length === 2) {
            const id_otro = chat.usuarios.find(u => u.toString() !== id_propio.toString());
            if (id_otro) ids_otros_necesarios.add(id_otro.toString());
        }
    });

    // Cargar apodos globales: Primero de CACHE, luego de DB
    let globales = {};
    if (ids_otros_necesarios.size > 0) {
        const missingIds = [];
        const { getUsuarioDeCache, setUsuarioEnCache } = await import('../STORAGE/CACHE/_cache_usuarios.js');
        
        for (const id of ids_otros_necesarios) {
            const cached = await getUsuarioDeCache(id);
            if (cached) {
                globales[id] = cached.apodo;
            } else {
                missingIds.push(id);
            }
        }

        if (missingIds.length > 0) {
            const users = await User.find({ _id: { $in: missingIds } }, "apodo").lean();
            for (const u of users) {
                globales[u._id.toString()] = u.apodo;
                // Cache miss: Actualizamos cache y esto suma +1 al contador
                await setUsuarioEnCache(u);
            }
        }
    }

    // Aplicar nombres
    return chats.map(chat => {
        // Desencriptar el nombre si existe
        if (chat.nombre && typeof chat.nombre === 'object' && chat.nombre.data) {
            chat.nombre = desencriptarDatosSistema(chat.nombre);
        }

        if (!chat.nombre) {
            if (chat.usuarios.length === 2) {
                const id_otro = chat.usuarios.find(u => u.toString() !== id_propio.toString());
                if (id_otro) {
                    const id_otro_str = id_otro.toString();
                    const contacto = usuario_actual.contactos.find(c => c.id.toString() === id_otro_str);
                    
                    if (contacto && contacto.apodo) {
                        chat.nombre = contacto.apodo;
                    } else if (globales[id_otro_str]) {
                        chat.nombre = "~" + globales[id_otro_str];
                    } else {
                        chat.nombre = "Usuario Ravage";
                    }
                } else {
                    chat.nombre = "Chat vacío";
                }
            } else if (chat.usuarios.length > 2) {
                chat.nombre = "Grupo sin nombre";
            } else {
                chat.nombre = "Chat personal";
            }
        }
        return chat;
    });
}

export async function HACER_ADMIN_CHAT(id_chat, id_usuario) {
    try {
        const chat = await ChatsRavage.findById(id_chat);
        if (!chat) return false;
        const id_propio = getIDMongodbUsuario();
        
        // Verificar permisos
        if (!chat.admins.some(a => a.toString() === id_propio.toString())) return false;
        // Verificar que el usuario está en el chat
        if (!chat.usuarios.some(u => u.toString() === id_usuario)) return false;

        await ChatsRavage.updateOne(
            { _id: id_chat },
            { $addToSet: { admins: new mongoose.Types.ObjectId(id_usuario) } }
        );

        // Actualizar cache
        const updatedChat = await ChatsRavage.findById(id_chat).lean();
        if (updatedChat) await setChatEnCache(updatedChat);

        // Notificar a todos por buzón (ej: actualización silenciosa o notificación)
        // Tipo 5: actualizar chat info silencioso o mensaje al buzón (reciclo tipo 5 para actualizar app u organizo otro o dejo sin notificacion global)
        // El cliente actualizará localmente, pero por si acaso, puedes mandar un buzon para que los demas rendericen el cambio.
        Añadir_Entrada_Buzon_Usuario({
            ids: chat.usuarios.filter(u => u.toString() !== id_propio.toString()),
            tipo: 5, // reutilizar tipo 5 (actualizar app/chat_info) para que re-soliciten datos. o crear lógica front.
            data: { chat: id_chat, accion: "nuevo_admin", usuario: id_usuario }
        }).catch(e => console.error(e));

        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

export async function QUITAR_ADMIN_CHAT(id_chat, id_usuario) {
    try {
        const chat = await ChatsRavage.findById(id_chat);
        if (!chat) return false;
        const id_propio = getIDMongodbUsuario();
        
        // Verificar permisos
        if (!chat.admins.some(a => a.toString() === id_propio.toString())) return false;

        await ChatsRavage.updateOne(
            { _id: id_chat },
            { $pull: { admins: new mongoose.Types.ObjectId(id_usuario) } }
        );

        // Actualizar cache
        const updatedChat = await ChatsRavage.findById(id_chat).lean();
        if (updatedChat) await setChatEnCache(updatedChat);

        Añadir_Entrada_Buzon_Usuario({
            ids: chat.usuarios.filter(u => u.toString() !== id_propio.toString()),
            tipo: 5, 
            data: { chat: id_chat, accion: "quitar_admin", usuario: id_usuario }
        }).catch(e => console.error(e));

        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}


/**
 * Rotación completa de la Sender Key para un emisor específico en un chat.
 */
export async function rotarClavesChat(id_chat, id_emisor) {
    try {
        const { ChatsRavage } = await import('../models/Chat.js');
        const { User } = await import('../models/User.js');
        const { randomBytes } = await import('../utils/libs.js');
        const { cifrarConPublica } = await import('../services/cryptoService.js');

        const chat = await ChatsRavage.findById(id_chat);
        if (!chat) return false;

        const newChainKey = randomBytes(32).toString('hex');
        const usuarios_data = await User.find({ _id: { $in: chat.usuarios } }, "_id publicKey").lean();

        const updates = [];
        for (const receptor of usuarios_data) {
            if (!receptor.publicKey) continue;
            
            updates.push({
                emisor_id: id_emisor,
                receptor_id: receptor._id,
                clave_envuelta: cifrarConPublica(newChainKey, receptor.publicKey),
                counter: 0
            });
        }

        // Reemplazar todas las entradas de este emisor en el array ratchet_keys
        await ChatsRavage.updateOne(
            { _id: id_chat },
            { 
                $pull: { ratchet_keys: { emisor_id: id_emisor } }
            }
        );

        await ChatsRavage.updateOne(
            { _id: id_chat },
            { 
                $push: { ratchet_keys: { $each: updates } }
            }
        );

        // Actualizar cache tras rotación de claves
        const updatedChat = await ChatsRavage.findById(id_chat).lean();
        if (updatedChat) await setChatEnCache(updatedChat);

        return true;
    } catch (e) {
        console.error("Error al rotar claves del chat:", e);
        return false;
    }
}

