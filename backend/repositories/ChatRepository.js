import { createLogger } from '../utils/logger.js';
import { mongoose, randomBytes } from '../utils/libs.js';
import { ChatsRavage } from '../models/Chat.js';
import { User } from '../models/User.js';
import { MessagesRavage } from '../models/Message.js';
import { convertirObjectId } from '../utils/conversores.js';
import { getIDMongodbUsuario, getInvisibleUsuario, setUsuariosSilence, setUsuariosBloqueados, getUsuariosSilence, getUsuariosBloqueados } from '../STORAGE/Variables_sesion.js';
import { Añadir_Entrada_Buzon_Usuario } from './BuzonRepository.js';
import { descifrarListaMensajes } from '../services/messageCryptoService.js';
import { cifrarConPublica, desencriptarDatosSistema, encriptarDatosSistema } from '../services/cryptoService.js';


const log = createLogger('chat-repo');

export function normalizeId(id) {
    if (!id) return null;
    const res = convertirObjectId(id);
    return (res && typeof res === 'object') ? (res.id || res._id || res.toString()) : res.toString();
}

/**
 * Helper para normalizar el chat antes de guardarlo en cache (sin contenido de mensajes).
 */
export async function setChatEnCacheRaw(chat) {
    // No-op: cache_chats has been removed
}

export async function obtener_datos_chats({ data = [], grupales = null, mensajes = true }) {
    try {
        const chatIds = [...new Set(
            (data || []).reduce((acc, c) => {
                if (c && (grupales === null || c.grupo === grupales)) {
                    const rawId = typeof c === 'object' ? (c.id || c._id) : c;
                    const id = normalizeId(rawId);
                    if (id && id !== "null" && id !== "undefined" && mongoose.Types.ObjectId.isValid(id)) {
                        acc.push(id);
                    }
                }
                return acc;
            }, [])
        )];

        if (chatIds.length === 0) return [];

        const result = [];
        const missingIds = chatIds;

        if (missingIds.length > 0) {
            log.info({ missing: missingIds.length }, "Cargando chats faltantes desde MongoDB");
            const data_obtenida = await ChatsRavage.find(
                { _id: { $in: missingIds } }
            ).lean();
            log.info({ loaded: data_obtenida.length }, "Chats obtenidos desde MongoDB");

            for (let chat of data_obtenida) {
                if (mensajes) {
                    chat.mensajes = await MessagesRavage.find({ id_chat: chat._id }).sort({ data: -1 }).limit(30).lean();
                    await descifrarListaMensajes(chat.mensajes, chat);
                }
                await setChatEnCacheRaw(chat);
                result.push(chat);
            }
        }

        // Para los que vinieron de cache, si se piden mensajes y no los tienen (o solo tienen IDs), hay que cargarlos
        for (let i = 0; i < result.length; i++) {
            let chat = result[i];
            const tieneMensajesFull = chat.mensajes && Array.isArray(chat.mensajes) && chat.mensajes.length > 0 && typeof chat.mensajes[0] === 'object';

            if (mensajes && !tieneMensajesFull) {
                // El cache solo tiene IDs o nada. Cargar de DB.
                chat.mensajes = await MessagesRavage.find({ id_chat: chat._id }).sort({ data: -1 }).limit(30).lean();
                await descifrarListaMensajes(chat.mensajes, chat);
                // No actualizamos cache aquí porque ya tenemos la meta-info y no queremos guardar contenido
            } else if (!mensajes && tieneMensajesFull) {
                // Se pidieron sin mensajes pero el cache los tiene (no debería pasar con el nuevo setChatEnCacheRaw)
                chat.mensajes = [];
            }
        }

        const data_con_nombres = await resolverNombresChats(result);
        return data_con_nombres.map(convertirObjectId);
    } catch (e) {
        log.error(e);
        return [];
    }
}

export async function obtener_datos_chat_unico(id_chat, datos_buscar = null) {
    try {
        const id_chat_str = normalizeId(id_chat);
        if (!id_chat_str || !mongoose.Types.ObjectId.isValid(id_chat_str)) return null;

        let nmensajes = null;
        if (datos_buscar && datos_buscar.includes("nmensajes")) {
            const parts = datos_buscar.trim().split(/\s+/);
            const idx = parts.indexOf("nmensajes");
            if (idx !== -1) {
                nmensajes = await MessagesRavage.countDocuments({ id_chat: id_chat_str });
                parts.splice(idx, 1);
                datos_buscar = parts.join(" ");
            }
        }


        let projection = {};
        if (datos_buscar) {
            const fields = typeof datos_buscar === 'string' ? datos_buscar.trim().split(/\s+/) : (Array.isArray(datos_buscar) ? datos_buscar : [datos_buscar]);
            fields.forEach(f => { if (f) projection[f] = 1; });
        }

        // Cache persistente eliminado: ir directamente a DB logic below

        // 2. Ir a DB
        let data_obtenida = await ChatsRavage.findById(id_chat_str, projection).lean();
        if (!data_obtenida) return null;

        const fields = Array.isArray(datos_buscar) ? datos_buscar : (typeof datos_buscar === 'string' ? datos_buscar.trim().split(/\s+/) : []);
        if (Array.isArray(fields) && fields.includes("mensajes")) {
            data_obtenida.mensajes = await MessagesRavage.find({ id_chat: id_chat_str }).sort({ data: -1 }).limit(30).lean();
            data_obtenida.mensajes.reverse();
            await descifrarListaMensajes(data_obtenida.mensajes, data_obtenida);
        }

        const final = await resolverNombresYBloqueos(data_obtenida, id_chat_str);

        // Prune sensitive data for Renderer
        if (final && final.ratchet_keys) delete final.ratchet_keys;
        if (final && nmensajes !== null) final.nmensajes = nmensajes;

        return convertirObjectId(final);
    } catch (e) {
        log.error({ err: e }, "Error en obtener_datos_chat_unico");
        return null;
    }
}

// Helper para limpiar el código repetitivo de bloqueos
async function resolverNombresYBloqueos(chat, id_chat) {
    const id_chat_str = normalizeId(id_chat);
    const id_propio = getIDMongodbUsuario();
    const usr = await User.findById(id_propio, "chats").lean();
    const miChatData = (usr?.chats || []).find(c => normalizeId(c.id) === id_chat_str);

    if (miChatData && miChatData.bloqueado) {
        if (miChatData.mensaje_bloqueo_id) {
            const stopId = miChatData.mensaje_bloqueo_id.toString();
            chat.mensajes = (chat.mensajes || []).filter(m => (m._id || m.id).toString() <= stopId);
        }
        if (miChatData.nombre_bloqueo != null) chat.nombre = miChatData.nombre_bloqueo;
        if (miChatData.participantes_bloqueo?.length > 0) chat.usuarios = miChatData.participantes_bloqueo;
    }

    const [data_con_nombre] = await resolverNombresChats([chat]);
    return convertirObjectId(data_con_nombre);
}

export async function CREAR_CHAT_NUEVO(ids = null, nombre = "", id_chat = null, solicitudAceptada = false) {
    if (!ids || ids.length === 0) {
        log.warn("[CREAR_CHAT_NUEVO] Fallo: No se proporcionaron IDs de destinatarios");
        return false;
    }
    const id_propio = getIDMongodbUsuario();
    if (!id_propio) {
        log.warn("[CREAR_CHAT_NUEVO] Fallo: No se encontró sesión del usuario (id_propio null)");
        return false;
    }

    // Normalizar ID del chat
    let chatIdLimpio = normalizeId(id_chat);
    if (chatIdLimpio === "null" || chatIdLimpio === "undefined" || chatIdLimpio === "") chatIdLimpio = null;

    const esChat_existente = chatIdLimpio && mongoose.Types.ObjectId.isValid(chatIdLimpio);
    if (getInvisibleUsuario() && !esChat_existente) {
        log.warn(`[CREAR_CHAT_NUEVO] Fallo: El usuario emisor ${id_propio} está en modo invisible`);
        return false;
    }

    // Filtrar usuarios bloqueados bidireccionalmente
    const miUsuario = await User.findById(id_propio, "users_bloq").lean();
    const mis_bloqueados = (miUsuario?.users_bloq || []).map(b => b.toString());

    const candidatos = await User.find(
        { _id: { $in: ids } },
        "_id users_bloq invisible"
    ).lean();

    const ids_filtrados = candidatos
        .filter(u => {
            const uid = u._id.toString();
            // Yo lo tengo bloqueado
            if (mis_bloqueados.includes(uid)) return false;
            // Él me tiene bloqueado
            if ((u.users_bloq || []).some(b => b.toString() === id_propio.toString())) return false;
            // El usuario está en modo invisible (no se le puede añadir)
            if (u.invisible) return false;
            return true;
        })
        .map(u => u._id.toString());

    if (ids_filtrados.length === 0) {
        log.warn(`[CREAR_CHAT_NUEVO] Fallo: Todos los destinatarios fueron filtrados (bloqueos o invisibilidad). Originales: ${ids.length}, Candidatos: ${candidatos.length}`);
        return false;
    }

    // Reemplazar ids por los filtrados
    ids = ids_filtrados;

    if (esChat_existente) {
        const chat = await ChatsRavage.findById(chatIdLimpio).lean();
        if (!chat) {
            log.warn(`[CREAR_CHAT_NUEVO] Fallo: Chat existente ${chatIdLimpio} no encontrado en DB`);
            return false;
        }

        // Comprobar si el usuario tiene el chat bloqueado
        const miUsuarioConChats = await User.findById(id_propio, "chats").lean();
        const chatMiInfo = miUsuarioConChats?.chats.find(c => c.id.toString() === chatIdLimpio.toString());
        if (chatMiInfo && chatMiInfo.bloqueado) {
            log.warn(`[CREAR_CHAT_NUEVO] Intento de modificar chat bloqueado (${chatIdLimpio}) por el usuario ${id_propio}`);
            return false;
        }

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
                        "chats.$[chat].ultimomensaje": encriptarDatosSistema("Solicitud: añadir usuario")
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
            }).catch(e => log.error(e));

            return { solicitud: true, mensaje_id: msgSolicitud._id };
        }

        // 3+ participantes o solicitud aceptada: añadir directamente
        // Verificar si es admin (solo los admins pueden añadir a grupos de >2 personas)
        if (chat.usuarios.length > 2 && !chat.admins.some(a => a.toString() === id_propio.toString())) {
            log.warn(`[CREAR_CHAT_NUEVO] Fallo: El usuario ${id_propio} no es admin del chat grupal ${chatIdLimpio}`);
            return false;
        }

        await ChatsRavage.updateOne(
            { _id: chatIdLimpio },
            { $addToSet: { usuarios: { $each: ids_añadir.map(id => new mongoose.Types.ObjectId(id)) } } }
        );

        // Actualizar cache después de mutación
        const updatedChat = await ChatsRavage.findById(chatIdLimpio).lean();
        if (updatedChat) await setChatEnCacheRaw(updatedChat);

        // Actualizar a los usuarios existentes (y nuevos) en su lista de chats (User.chats)
        const ids_totales = [...chat.usuarios, ...ids_añadir];
        await User.updateMany(
            { _id: { $in: ids_totales } },
            {
                $set: {
                    "chats.$[chat].ultimoCambio": new Date(),
                    "chats.$[chat].ultimomensaje": encriptarDatosSistema("Añadido nuevo usuario")
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
                            ultimoCambio: new Date(),
                            ultimomensaje: encriptarDatosSistema("Bienvenido al chat")
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
        }).catch(e => log.error(e));

        return true;
    }

    // CREAR CHAT NUEVO (Todos los chats se consideran expansibles/grupos)
    const ids_totales = [...new Set([...ids.map(id => id.toString()), id_propio.toString()])];
    const ids_objectid = ids_totales.map(id => new mongoose.Types.ObjectId(id));

    // Preparar ratchet_keys iniciales (Sender Key por usuario)
    const ratchet_keys = [];
    const usuarios_data = await User.find({ _id: { $in: ids_objectid } }, "_id publicKey").lean();

    // Validar que el creador tenga llave pública
    const creador = usuarios_data.find(u => u._id.toString() === id_propio.toString());
    if (!creador || !creador.publicKey) {
        log.error("[Chat] El creador no tiene llave pública, el chat será ilegible.");
    }

    for (const emisor of usuarios_data) {
        const chainKey = randomBytes(32).toString('hex');

        for (const receptor of usuarios_data) {
            if (!receptor.publicKey) {
                log.warn(`[Chat] Usuario ${receptor._id} no tiene llave pública, saltando entrada de ratchet.`);
                continue;
            }

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
            usuarios: ids_objectid,
            admins: ids_totales.length === 2 ? ids_objectid : [new mongoose.Types.ObjectId(id_propio)],
            ratchet_keys
        });


        await User.updateMany(
            { _id: { $in: ids_totales } },
            {
                $push: {
                    chats: {
                        id: datos_chat._id,
                        nombre: datos_chat.nombre,
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
            ids: ids_totales.filter(id => id.toString() !== id_propio.toString()),
            tipo: 2,
            data: { creador: id_propio, chat: datos_chat._id }
        }).catch(e => log.error(e));

        // Actualizar cache con el nuevo chat
        await setChatEnCacheRaw(datos_chat.toObject());

        return convertirObjectId(datos_chat.toObject());
    } catch (e) {
        log.error({ err: e, stack: e.stack }, `[CREAR_CHAT_NUEVO] Error crítico durante la creación/actualización`);
        if (datos_chat?._id) await ChatsRavage.deleteOne({ _id: datos_chat._id });
        throw e;
    }
}

export async function expulsar_usuario_chat(id_usuario, id_chat) {
    try {
        const id_chat_str = normalizeId(id_chat);
        const id_usuario_str = normalizeId(id_usuario);

        const chat = await ChatsRavage.findById(id_chat_str).lean();
        if (!chat) return false;
        const id_propio = getIDMongodbUsuario();
        const existe = chat.usuarios.some(usuario => usuario.toString() === id_usuario_str);
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
        if (updatedChat) await setChatEnCacheRaw(updatedChat);

        // Actualizar a los demás usuarios para que vean "Usuario expulsado"
        await User.updateMany(
            { _id: { $in: chat.usuarios.filter(u => u.toHexString() !== id_usuario) } },
            {
                $set: {
                    "chats.$[chat].ultimoCambio": new Date(),
                    "chats.$[chat].ultimomensaje": encriptarDatosSistema("Usuario expulsado")
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
        }).catch(e => log.error(e));

        return true;
    } catch (e) {
        log.error(e);
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
        const chat = await ChatsRavage.findById(id_chat).lean();
        if (!chat) return { success: false, message: "Chat no encontrado" };

        // Verificar que el usuario es miembro del chat
        if (!chat.usuarios.some(u => u.toString() === id_propio.toString())) {
            return { success: false, message: "No eres miembro de este chat" };
        }

        // Buscar el mensaje de solicitud
        const mensaje = await MessagesRavage.findOne({ _id: id_mensaje, id_chat: new mongoose.Types.ObjectId(id_chat) }).lean();
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
            }).catch(e => log.error(e));
        }

        return { success: true, aceptada: aceptar };
    } catch (e) {
        log.error({ err: e }, "Error en RESPONDER_SOLICITUD_AÑADIR");
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
        const hasUsuarios = Array.isArray(chat.usuarios);
        if (!chat.nombre && hasUsuarios && chat.usuarios.length === 2) {
            const id_mio_norm = id_propio.toString();
            const id_otro = chat.usuarios.find(u => normalizeId(u) !== id_mio_norm);
            if (id_otro) ids_otros_necesarios.add(normalizeId(id_otro));
        }
    });

    // Cargar apodos globales: Primero de CACHE, luego de DB
    let globales = {};
    if (ids_otros_necesarios.size > 0) {
        const missingIds = [];
        const { getUsuarioDeCache, setUsuarioEnCache } = await import('./UserRepository.js');

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
                // Decodificar el apodo si está encriptado antes de usarlo y guardarlo en cache
                if (u.apodo && typeof u.apodo === 'object') {
                    u.apodo = desencriptarDatosSistema(u.apodo);
                }

                globales[u._id.toString()] = u.apodo || "Usuario Ravage";

                // Cache miss: Actualizamos cache con el dato procesado
                await setUsuarioEnCache(u);
            }
        }
    }

    // Aplicar nombres
    return chats.map(chat => {
        // Desencriptar el nombre si existe
        if (chat.nombre && typeof chat.nombre === 'object' && chat.nombre.data) {
            const nombreDec = desencriptarDatosSistema(chat.nombre);
            chat.nombre = nombreDec || "Grupo sin nombre (Cifrado)";
        }

        // Desencriptar la descripción si existe
        if (chat.descripcion && typeof chat.descripcion === 'object' && chat.descripcion.data) {
            chat.descripcion = desencriptarDatosSistema(chat.descripcion) || null;
        }

        const hasUsuarios = Array.isArray(chat.usuarios);
        const is_1on1 = hasUsuarios && chat.usuarios.length === 2;

        if (is_1on1) {
            // Siempre resolver desde contactos para chats 1-a-1 (el apodo puede haber cambiado)
            const id_mio_norm = id_propio.toString();
            const id_otro = chat.usuarios.find(u => normalizeId(u) !== id_mio_norm);
            if (id_otro) {
                const id_otro_str = id_otro.toString();
                const contacto = (usuario_actual.contactos || []).find(c => c.id && c.id.toString() === id_otro_str);

                if (contacto && contacto.apodo) {
                    const apodo_dec = typeof contacto.apodo === 'object'
                        ? desencriptarDatosSistema(contacto.apodo)
                        : contacto.apodo;
                    chat.nombre = apodo_dec || ("~" + globales[id_otro_str]) || "Usuario Ravage";
                } else if (globales[id_otro_str]) {
                    chat.nombre = "~" + globales[id_otro_str];
                } else {
                    chat.nombre = "Usuario Ravage";
                }
            } else {
                chat.nombre = "Chat vacío";
            }
        } else if (!chat.nombre) {
            if (hasUsuarios && chat.usuarios.length > 2) {
                chat.nombre = "Grupo sin nombre";
            } else if (hasUsuarios) {
                chat.nombre = "Chat personal";
            }
        }
        return chat;
    });
}

export async function HACER_ADMIN_CHAT(id_chat, id_usuario) {
    try {
        const id_chat_str = normalizeId(id_chat);
        const id_usuario_str = normalizeId(id_usuario);
        const chat = await ChatsRavage.findById(id_chat_str).lean();
        if (!chat) return false;
        const id_propio = getIDMongodbUsuario();

        // Verificar permisos
        if (!chat.admins.some(a => a.toString() === id_propio.toString())) return false;
        // Verificar que el usuario está en el chat
        if (!chat.usuarios.some(u => u.toString() === id_usuario_str)) return false;

        await ChatsRavage.updateOne(
            { _id: id_chat_str },
            { $addToSet: { admins: new mongoose.Types.ObjectId(id_usuario_str) } }
        );

        // Actualizar cache
        const updatedChat = await ChatsRavage.findById(id_chat).lean();
        if (updatedChat) await setChatEnCacheRaw(updatedChat);

        // Notificar a todos por buzón (ej: actualización silenciosa o notificación)
        // Tipo 5: actualizar chat info silencioso o mensaje al buzón (reciclo tipo 5 para actualizar app u organizo otro o dejo sin notificacion global)
        // El cliente actualizará localmente, pero por si acaso, puedes mandar un buzon para que los demas rendericen el cambio.
        Añadir_Entrada_Buzon_Usuario({
            ids: chat.usuarios.filter(u => u.toString() !== id_propio.toString()),
            tipo: 5, // reutilizar tipo 5 (actualizar app/chat_info) para que re-soliciten datos. o crear lógica front.
            data: { chat: id_chat, accion: "nuevo_admin", usuario: id_usuario }
        }).catch(e => log.error(e));

        return true;
    } catch (e) {
        log.error(e);
        return false;
    }
}

export async function QUITAR_ADMIN_CHAT(id_chat, id_usuario) {
    try {
        const id_chat_str = normalizeId(id_chat);
        const id_usuario_str = normalizeId(id_usuario);
        const chat = await ChatsRavage.findById(id_chat_str).lean();
        if (!chat) return false;
        const id_propio = getIDMongodbUsuario();

        // Verificar permisos
        if (!chat.admins.some(a => a.toString() === id_propio.toString())) return false;

        await ChatsRavage.updateOne(
            { _id: id_chat_str },
            { $pull: { admins: new mongoose.Types.ObjectId(id_usuario_str) } }
        );

        // Actualizar cache
        const updatedChat = await ChatsRavage.findById(id_chat).lean();
        if (updatedChat) await setChatEnCacheRaw(updatedChat);

        Añadir_Entrada_Buzon_Usuario({
            ids: chat.usuarios.filter(u => u.toString() !== id_propio.toString()),
            tipo: 5,
            data: { chat: id_chat, accion: "quitar_admin", usuario: id_usuario }
        }).catch(e => log.error(e));

        return true;
    } catch (e) {
        log.error(e);
        return false;
    }
}


/**
 * Rotación completa de la Sender Key para un emisor específico en un chat.
 */
export async function rotarClavesChat(id_chat, id_emisor) {
    try {
        const id_chat_str = normalizeId(id_chat);
        const id_emisor_str = normalizeId(id_emisor);

        const chat = await ChatsRavage.findById(id_chat_str).lean();
        if (!chat) return false;

        const newChainKey = randomBytes(32).toString('hex');
        const usuarios_data = await User.find({ _id: { $in: chat.usuarios } }, "_id publicKey").lean();

        const updates = [];
        for (const receptor of usuarios_data) {
            if (!receptor.publicKey) continue;

            updates.push({
                emisor_id: id_emisor_str,
                receptor_id: receptor._id,
                clave_envuelta: cifrarConPublica(newChainKey, receptor.publicKey),
                counter: 0
            });
        }

        // Reemplazar todas las entradas de este emisor en el array ratchet_keys
        await ChatsRavage.updateOne(
            { _id: id_chat_str },
            { $set: { ratchet_keys: updates } }
        );

        // Actualizar cache tras rotación de claves
        const updatedChat = await ChatsRavage.findById(id_chat_str).lean();
        if (updatedChat) await setChatEnCacheRaw(updatedChat);

        return true;
    } catch (e) {
        log.error({ err: e }, "Error al rotar claves del chat");
        return false;
    }
}

export async function SILENCIAR_CHAT_USUARIO(id_chat) {
    try {
        const id_chat_str = normalizeId(id_chat);
        const id_propio = getIDMongodbUsuario();
        const usr = await User.findById(id_propio, "chats").lean();
        if (!usr) return { success: false };

        const index = usr.chats.findIndex(c => normalizeId(c.id) === id_chat_str);
        if (index === -1) return { success: false, message: "Chat no encontrado" };

        const currentMuted = usr.chats[index].silenciado || false;
        const newMuted = !currentMuted;

        let resultado_silencio = [];
        if (newMuted) {
            const muteados = getUsuariosSilence();
            resultado_silencio = [...muteados, id_chat_str];
            setUsuariosSilence(resultado_silencio);
        } else {
            resultado_silencio = getUsuariosSilence().filter(c => c !== id_chat_str);
            setUsuariosSilence(resultado_silencio);
        }

        const r = await User.updateOne(
            { _id: id_propio },
            {
                $set: {
                    "chats.$[chat].silenciado": newMuted,
                    users_silence: resultado_silencio
                }
            },
            { arrayFilters: [{ "chat.id": new mongoose.Types.ObjectId(id_chat_str) }] }
        );

        await actualizarCacheUsuarioPropio();
        log.info({ nuevo_estado: newMuted ? "silenciado" : "no silenciado", id_chat: id_chat_str }, "Silenciado");
        return { success: true, silenciado: newMuted };
    } catch (e) {
        log.error(e);
        return { success: false, message: "Error al cambiar silencio" };
    }
}

export async function BLOQUEAR_CHAT_USUARIO(id_chat) {
    try {
        const id_chat_str = normalizeId(id_chat);
        const id_propio = getIDMongodbUsuario();
        const usr = await User.findById(id_propio, "chats").lean();
        if (!usr) return { success: false };

        const index = usr.chats.findIndex(c => normalizeId(c.id) === id_chat_str);
        if (index === -1) return { success: false, message: "Chat no encontrado" };

        const currentBlocked = usr.chats[index].bloqueado || false;
        const newBlocked = !currentBlocked;

        let mensaje_bloqueo_id = null;
        let nombre_bloqueo = null;
        let participantes_bloqueo = null;

        if (newBlocked) {
            const ultimoMsg = await MessagesRavage.findOne({ id_chat: new mongoose.Types.ObjectId(id_chat_str) })
                .sort({ data: -1 })
                .select('_id')
                .lean();
            if (ultimoMsg) mensaje_bloqueo_id = ultimoMsg._id;

            // Snapshot del estado actual del chat
            const chatActual = await ChatsRavage.findById(id_chat_str, "nombre usuarios").lean();
            if (chatActual) {
                nombre_bloqueo = chatActual.nombre || null;
                participantes_bloqueo = chatActual.usuarios || null;
            }
        }
        let resultado_bloque = [];
        if (newBlocked) {
            const bloqueados = getUsuariosBloqueados();
            resultado_bloque = [...bloqueados, id_chat_str];
            setUsuariosBloqueados(resultado_bloque);
        } else {
            resultado_bloque = getUsuariosBloqueados().filter(c => c !== id_chat_str);
            setUsuariosBloqueados(resultado_bloque);
        }
        await User.updateOne(
            { _id: id_propio },
            {
                $set: {
                    "chats.$[chat].bloqueado": newBlocked,
                    "chats.$[chat].mensaje_bloqueo_id": mensaje_bloqueo_id,
                    "chats.$[chat].nombre_bloqueo": nombre_bloqueo,
                    "chats.$[chat].participantes_bloqueo": participantes_bloqueo,
                    users_bloqueo: resultado_bloque
                }
            },
            { arrayFilters: [{ "chat.id": new mongoose.Types.ObjectId(id_chat_str) }] }
        );

        await actualizarCacheUsuarioPropio();
        log.info({ nuevo_estado: newBlocked ? "bloqueado" : "desbloqueado", id_chat: id_chat_str }, "Bloqueo");

        return { success: true, bloqueado: newBlocked };
    } catch (e) {
        log.error(e);
        return { success: false, message: "Error al bloquear chat" };
    }
}

/**
 * Helper para forzar la actualización de los datos propios en la caché.
 */
export async function LIMPIAR_MENSAJES_CHAT(id_chat) {
    try {
        const id_chat_str = normalizeId(id_chat);
        if (!id_chat_str) return false;

        const id_propio = getIDMongodbUsuario();

        // Verificar que el usuario es participante del chat
        const chat = await ChatsRavage.findById(id_chat_str, "usuarios").lean();
        if (!chat || !chat.usuarios.some(u => u.toString() === id_propio.toString())) return false;

        // Borrar todos los mensajes del chat
        await MessagesRavage.deleteMany({ id_chat: new mongoose.Types.ObjectId(id_chat_str) });

        // Limpiar msfijado en el chat
        await ChatsRavage.updateOne(
            { _id: id_chat_str },
            { $set: { msfijado: null } }
        );

        // Resetear ultimoCambio y ultimomensaje en la entrada del usuario
        await User.updateOne(
            { _id: id_propio },
            {
                $set: {
                    "chats.$[c].ultimomensaje": null,
                    "chats.$[c].ultimoCambio": new Date()
                }
            },
            { arrayFilters: [{ "c.id": new mongoose.Types.ObjectId(id_chat_str) }] }
        );

        await actualizarCacheUsuarioPropio();
        return true;
    } catch (e) {
        log.error(e);
        return false;
    }
}

export async function GESTIONAR_ELIMINAR_CHAT(id_chat) {
    try {
        const id_chat_str = normalizeId(id_chat);
        if (!id_chat_str) return false;

        const id_propio = getIDMongodbUsuario();
        const chat = await ChatsRavage.findById(id_chat_str, "usuarios").lean();
        if (!chat || !chat.usuarios.some(u => u.toString() === id_propio.toString())) return false;

        // Comprobar si alguno de los otros participantes es contacto del usuario
        const { getListaContactos } = await import('../STORAGE/Variables_sesion.js');
        const contactos = getListaContactos();
        const otros = chat.usuarios.filter(u => u.toString() !== id_propio.toString()).map(u => u.toString());
        const otro_es_contacto = otros.some(uid => contactos.some(c => c.id === uid));

        if (otro_es_contacto) {
            const ok = await LIMPIAR_MENSAJES_CHAT(id_chat_str);
            return ok ? { success: true, tipo: "limpiar" } : false;
        }

        // Borrar completamente: mensajes, chat y entrada en el usuario
        await MessagesRavage.deleteMany({ id_chat: new mongoose.Types.ObjectId(id_chat_str) });
        await ChatsRavage.deleteOne({ _id: id_chat_str });
        await User.updateOne(
            { _id: id_propio },
            { $pull: { chats: { id: new mongoose.Types.ObjectId(id_chat_str) } } }
        );

        await actualizarCacheUsuarioPropio();
        return { success: true, tipo: "eliminar" };
    } catch (e) {
        log.error(e);
        return false;
    }
}

export async function ACTUALIZAR_DATOS_CHAT(id_chat, { nombre, descripcion, escaneres_seguridad }) {
    try {
        const id_chat_str = normalizeId(id_chat);
        if (!id_chat_str) return { success: false };

        const id_propio = getIDMongodbUsuario();
        const chat = await ChatsRavage.findById(id_chat_str, "admins").lean();
        if (!chat) return { success: false };

        if (!chat.admins.some(a => a.toString() === id_propio.toString())) {
            return { success: false, error: "no_admin" };
        }

        const update = {};
        if (nombre !== undefined) {
            update.nombre = nombre && nombre.trim() ? encriptarDatosSistema(nombre.trim()) : null;
        }
        if (descripcion !== undefined) {
            update.descripcion = descripcion && descripcion.trim() ? encriptarDatosSistema(descripcion.trim()) : null;
        }
        if (escaneres_seguridad !== undefined && escaneres_seguridad !== null) {
            update.escaneres_seguridad = escaneres_seguridad;
        }

        if (Object.keys(update).length === 0) return { success: true };

        await ChatsRavage.updateOne({ _id: id_chat_str }, { $set: update });

        const updatedChat = await ChatsRavage.findById(id_chat_str).lean();
        if (updatedChat) await setChatEnCacheRaw(updatedChat);

        return { success: true };
    } catch (e) {
        log.error(e);
        return { success: false };
    }
}

async function actualizarCacheUsuarioPropio() {
    const id_propio = getIDMongodbUsuario();
    if (!id_propio) return;
    const { setUsuarioEnCache } = await import('./UserRepository.js');
    const updatedUser = await User.findById(id_propio).lean();
    if (updatedUser) {
        const { procesarUsuario } = await import('./UserRepository.js');
        await setUsuarioEnCache(procesarUsuario(updatedUser));
    }
}
