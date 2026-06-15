import { createLogger } from '../utils/logger.js';
const log = createLogger('msg-repo');
import { MessagesRavage } from '../models/Message.js';
import { ChatsRavage } from '../models/Chat.js';
import { User } from '../models/User.js';
import { mongoose, GridFSBucket, ObjectId, fs, randomBytes } from '../utils/libs.js';
import { convertirObjectId } from '../utils/conversores.js';
import { Añadir_Entrada_Buzon_Usuario } from './BuzonRepository.js';
import { readFileSession } from '../services/controladorArchivos.js';
import { setChatEnCacheRaw, normalizeId } from './ChatRepository.js';
import { procesarUsuario } from './UserRepository.js';
import { setUsuarioEnCache } from './UserRepository.js';

import { descifrarListaMensajes, getMessageKey } from '../services/messageCryptoService.js';
import {
    cifrarContenido,
    descifrarConPrivada,
    cifrarConPublica,
    crearCipherStream,
    crearDecipherStream,
    encriptarDatosSistema,
    getIdentity,
    ratchetChainKey
} from '../services/cryptoService.js';


export async function ENVIAR_MENSAJE({ asunto = "", archivos = [], id_chat, id_emisor }) {
    try {
        // Ejecución en paralelo de la búsqueda de chat y usuario
        const [chat, usuario] = await Promise.all([
            ChatsRavage.findById(id_chat).lean(),
            User.findById(id_emisor).lean()
        ]);

        if (!chat || !usuario) return false;

        // Comprobar si el usuario tiene el chat bloqueado
        const chatUsuarioInfo = usuario.chats.find(c => c.id.equals(id_chat));
        if (chatUsuarioInfo && chatUsuarioInfo.bloqueado) {
            log.warn(`[ENVIAR_MENSAJE] Intento de envío en chat bloqueado (${id_chat}) por el usuario ${id_emisor}`);
            return false;
        }

        // E2EE: Obtener identidad una sola vez y reutilizarla en todo el flujo
        const identity_data = await getIdentity();
        if (!identity_data || !identity_data.primary?.privateKey) {
            log.error("No se encontró la llave privada local para E2EE");
            return false;
        }

        // Buscar la entrada del emisor para sí mismo (donde guarda su cadena de envío)
        const id_emisor_str = id_emisor.toString()
        const ratchet_entry = chat.ratchet_keys.find(k =>
            k.emisor_id.toString() === id_emisor_str &&
            k.receptor_id.toString() === id_emisor_str
        );

        if (!ratchet_entry) {
            log.error("No se encontró la cadena de envío para el usuario actual");
            return false;
        }

        let current_ck_hex;
        let active_entry = ratchet_entry;

        // Recibe identity_data como parámetro para no volver a pedirla
        async function intentarDescifrado(ent, id_data) {
            if (!id_data || !id_data.primary?.privateKey) throw new Error("No Identity keys found locally.");
            return descifrarConPrivada(ent.clave_envuelta, id_data.primary.privateKey);
        }

        try {
            current_ck_hex = await intentarDescifrado(active_entry, identity_data);
        } catch (err) {
            log.warn(`[E2EE] Fallo al descifrar propia llave de cadena en chat ${id_chat}. Intentando recuperación por rotación...`, err.message);

            try {
                const { rotarClavesChat } = await import('./ChatRepository.js');
                await rotarClavesChat(id_chat, id_emisor);

                let chatAct = await ChatsRavage.findById(id_chat).lean();
                active_entry = chatAct.ratchet_keys.find(k =>
                    k.emisor_id.toString() === id_emisor.toString() &&
                    k.receptor_id.toString() === id_emisor.toString()
                );

                if (!active_entry) throw new Error("Ratchet entry not found after rotation.");
                current_ck_hex = await intentarDescifrado(active_entry, identity_data);
                log.info("[E2EE] Recuperación por rotación exitosa.");
            } catch (err2) {
                log.error("[E2EE] Rotación de chat insuficiente. Fallo crítico de identidad detectado.", err2.message);

                try {
                    const { REGENERAR_IDENTIDAD_USUARIO } = await import('../services/sesionUsuario.js');
                    const regenOk = await REGENERAR_IDENTIDAD_USUARIO();
                    if (!regenOk) throw new Error("Failed to regenerate identity.");

                    // Tras regenerar identidad, obtener las nuevas llaves
                    const new_identity = await getIdentity();

                    const { rotarClavesChat } = await import('./ChatRepository.js');
                    await rotarClavesChat(id_chat, id_emisor);

                    let chatAct = await ChatsRavage.findById(id_chat).lean();
                    active_entry = chatAct.ratchet_keys.find(k =>
                        k.emisor_id.toString() === id_emisor.toString() &&
                        k.receptor_id.toString() === id_emisor.toString()
                    );

                    current_ck_hex = await intentarDescifrado(active_entry, new_identity);
                    log.warn("[E2EE] Recuperación nuclear completada. Los mensajes antiguos podrían no ser legibles.");
                } catch (err3) {
                    log.error("[E2EE] Fallo absoluto en el sistema criptográfico:", err3.message);
                    return false;
                }
            }
        }

        const iteration = active_entry.counter;

        // Ratchet: Derivar MessageKey y el siguiente ChainKey
        const { messageKey, nextChainKey } = ratchetChainKey(current_ck_hex);
        const chatKey = messageKey;

        const contenido_archivos = [];
        if (archivos.length > 0) {
            const bucket = new GridFSBucket(mongoose.connection.db, {
                bucketName: "ArchivosChats"
            });
            const nombre_defecto = "_archivo_.txt";
            for (const archivo of archivos) {
                let nombreCompletoUsar = nombre_defecto;
                if (archivo.nombre && archivo.extension) nombreCompletoUsar = archivo.nombre + "." + archivo.extension;
                const idArchivo = new ObjectId();
                const iv = randomBytes(12);
                const cipherStream = crearCipherStream(chatKey, iv);

                const uploadStream = bucket.openUploadStreamWithId(idArchivo, idArchivo.toHexString());

                await new Promise((resolve, reject) => {
                    const readStream = fs.createReadStream(archivo.ruta);
                    readStream
                        .pipe(cipherStream)
                        .pipe(uploadStream)
                        .on("error", reject)
                        .on("finish", resolve);
                });

                contenido_archivos.push({
                    nombre: encriptarDatosSistema(nombreCompletoUsar),
                    id: idArchivo.toHexString(),
                    iv: iv.toString('hex'),
                    tag: cipherStream.getAuthTag().toString('hex')
                });
            }
        }

        // Cifrar contenido completo (incluyendo emisor y fecha)
        const data_mensaje = new Date();
        const payload = JSON.stringify({
            asunto,
            archivos: contenido_archivos,
            emisor: id_emisor,
            data: data_mensaje
        });
        const encriptado = cifrarContenido(payload, chatKey);

        const mensaje = {
            id_chat: new mongoose.Types.ObjectId(id_chat),
            emisor: new mongoose.Types.ObjectId(id_emisor),
            contenido: [{
                asunto: encriptarDatosSistema(asunto),
                archivos: contenido_archivos
            }],
            encriptado: encriptado,
            data: data_mensaje,
            ratchet_info: {
                iteration: iteration,
                chain_id: "default"
            }
        };

        // Crear mensaje y actualizar ratchet en paralelo
        const nuevaClave = cifrarConPublica(nextChainKey, usuario.publicKey);
        const [nuevoMensaje] = await Promise.all([
            MessagesRavage.create(mensaje),
            ChatsRavage.updateOne(
                { _id: id_chat, "ratchet_keys.emisor_id": id_emisor, "ratchet_keys.receptor_id": id_emisor },
                {
                    $set: { "ratchet_keys.$.clave_envuelta": nuevaClave },
                    $inc: { "ratchet_keys.$.counter": 1 }
                }
            )
        ]);

        // Actualizar objeto local y caché del chat sin esperar a MongoDB
        const target_entry = chat.ratchet_keys.find(k =>
            k.emisor_id.toString() === id_emisor.toString() &&
            k.receptor_id.toString() === id_emisor.toString()
        );
        if (target_entry) {
            target_entry.clave_envuelta = nuevaClave;
            target_entry.counter += 1;
        }
        setChatEnCacheRaw(chat).catch(e => log.error(e));

        // Rotación automática si el contador es muy alto (fire and forget)
        const ROTATION_THRESHOLD = 100;
        if (iteration >= ROTATION_THRESHOLD) {
            (async () => {
                const { rotarClavesChat } = await import('./ChatRepository.js');
                await rotarClavesChat(id_chat, id_emisor);
            })();
        }

        // Actualizar ultimoCambio y ultimomensaje de todos los usuarios del chat (fire and forget)
        (async () => {
            const ids_afectados = chat.usuarios || [];
            await User.updateMany(
                { _id: { $in: ids_afectados } },
                {
                    $set: {
                        "chats.$[chat].ultimoCambio": new Date(),
                        "chats.$[chat].ultimomensaje": encriptarDatosSistema(asunto)
                    }
                },
                { arrayFilters: [{ "chat.id": new mongoose.Types.ObjectId(id_chat) }] }
            );
        })().catch(e => log.error(e));

        Añadir_Entrada_Buzon_Usuario({
            ids: chat.usuarios,
            tipo: 0,
            data: { chat: chat._id?.toHexString(), id_mensaje: nuevoMensaje._id?.toHexString(), emisor: id_emisor }
        }).catch(e => log.error(e));

        // Preparar respuesta para el emisor con datos completos
        const mensaje_enviar = {
            ...nuevoMensaje.toObject ? nuevoMensaje.toObject() : nuevoMensaje,
            contenido: [{
                asunto: asunto,
                archivos: (contenido_archivos || []).map((ca, idx) => ({
                    ...ca,
                    nombre: archivos[idx]?.nombre || ca.nombre,
                    extension: archivos[idx]?.extension || ca.extension || (archivos[idx]?.nombre?.includes(".") ? archivos[idx].nombre.split(".").pop() : null),
                    emisor_id: id_emisor
                }))
            }]
        };

        return { success: true, id_mensaje: nuevoMensaje._id?.toHexString(), mensaje: convertirObjectId(mensaje_enviar) };
    } catch (e) {
        log.error(e);
        return false;
    }
}

export async function obtener_datos_mensaje(id_chat, id_mensaje) {
    try {
        const id_chat_str = normalizeId(id_chat);
        const id_mensaje_str = normalizeId(id_mensaje);

        const chat = await ChatsRavage.findById(new mongoose.Types.ObjectId(id_chat_str)).lean();
        const mensaje = await MessagesRavage.findOne({
            id_chat: new mongoose.Types.ObjectId(id_chat_str),
            _id: new mongoose.Types.ObjectId(id_mensaje_str)
        }).lean();
        if (!mensaje) return null;

        if (mensaje.encriptado && mensaje.encriptado.data) {
            const [decrypted] = await descifrarListaMensajes([mensaje], chat);
            return convertirObjectId(decrypted);
        }

        return convertirObjectId(mensaje);
    } catch (e) {
        log.error(e);
        return null;
    }
}

/**
 * Obtiene mensajes paginados de un chat usando cursor basado en fecha.
 * @param {string} id_chat - ID del chat
 * @param {number} limit - Cantidad de mensajes a obtener (default 30)
 * @param {string|null} before_date - Fecha ISO; solo se devuelven mensajes anteriores a esta fecha
 * @returns {{ mensajes: Array, hay_mas: boolean }}
 */
export async function obtener_mensajes_paginados(id_chat, limit = 30, cursor_id = null, direction = 'older') {
    try {
        const query = { id_chat: new mongoose.Types.ObjectId(id_chat) };
        if (cursor_id) {
            query._id = direction === 'older'
                ? { $lt: new mongoose.Types.ObjectId(cursor_id) }
                : { $gt: new mongoose.Types.ObjectId(cursor_id) };
        }

        const chat = await ChatsRavage.findById(id_chat).lean();
        if (!chat) return { mensajes: [], hay_mas: false };

        const sortOrder = direction === 'older' ? -1 : 1;
        const mensajes = await MessagesRavage.find(query)
            .sort({ _id: sortOrder })
            .limit(limit + 1)
            .lean();

        const hay_mas = mensajes.length > limit;
        if (hay_mas) mensajes.pop();

        await descifrarListaMensajes(mensajes, chat);
        // Siempre devolver en orden cronológico (antiguo → nuevo)
        if (direction === 'older') mensajes.reverse();

        return { mensajes: convertirObjectId(mensajes), hay_mas };
    } catch (e) {
        log.error(e);
        return { mensajes: [], hay_mas: false };
    }
}

export async function DESCARGAR_ARCHIVO(id, nombre, ivHex = null, tagHex = null, id_chat = null, ratchet_info = null, emisor_id = null) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        log.error("ID de archivo no válido:", id);
        return false;
    }
    const bucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: "ArchivosChats"
    });
    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(id));
    const { getAjustesAppFile } = await import('../services/controladorArchivos.js');
    const { join, dirname, basename, extname } = await import('path');

    const ruta_principal = await getAjustesAppFile("URL_DESCARGA");
    const safeName = basename(nombre);
    const rutaCompleta = join(ruta_principal, safeName);

    function generarRutaUnica(rutaBase) {
        const dir = dirname(rutaBase);
        const name = basename(rutaBase, extname(rutaBase));
        const ext = extname(rutaBase);
        let nuevaRuta = rutaBase;
        let contador = 1;
        while (fs.existsSync(nuevaRuta)) {
            nuevaRuta = join(dir, `${name} (${contador})${ext}`);
            contador++;
        }
        return nuevaRuta;
    }

    let rutaFinal = generarRutaUnica(rutaCompleta);
    const writeStream = fs.createWriteStream(rutaFinal);

    return new Promise(async (resolve, reject) => {
        let stream_final = downloadStream;

        if (ivHex && tagHex && id_chat && ratchet_info && emisor_id) {
            const chat = await ChatsRavage.findById(id_chat).lean();
            const messageKey = await getMessageKey(chat, emisor_id, ratchet_info.iteration);

            if (messageKey) {
                const decipherStream = crearDecipherStream(messageKey, Buffer.from(ivHex, 'hex'), Buffer.from(tagHex, 'hex'));
                stream_final = downloadStream.pipe(decipherStream);
            } else {
                log.error({ id, id_chat, iteration: ratchet_info?.iteration },
                    '[E2EE] No se pudo derivar la clave de descifrado del archivo');
                writeStream.destroy();
                reject(new Error('No se pudo descifrar el archivo: clave de cifrado irrecuperable'));
                return;
            }
        }

        stream_final
            .pipe(writeStream)
            .on("finish", async () => {
                resolve(rutaFinal)
            })
            .on("error", reject);
    });
}

const IMAGE_EXTENSIONS_PREVIEW = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif', 'tiff', 'tif']);
const MIME_MAP = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon', avif: 'image/avif', tiff: 'image/tiff', tif: 'image/tiff' };
const MAX_PREVIEW_BYTES = 20 * 1024 * 1024;

export async function OBTENER_PREVIEW_IMAGEN(id, nombre, ivHex = null, tagHex = null, id_chat = null, ratchet_info = null, emisor_id = null) {
    const ext = (nombre?.includes('.') ? nombre.split('.').pop() : '').toLowerCase();
    if (!IMAGE_EXTENSIONS_PREVIEW.has(ext)) return null;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;

    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: "ArchivosChats" });

    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(id) }).toArray();
    if (!files.length || files[0].length > MAX_PREVIEW_BYTES) return null;

    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(id));

    return new Promise(async (resolve) => {
        let stream_final = downloadStream;

        if (ivHex && tagHex && id_chat && ratchet_info && emisor_id) {
            try {
                const chat = await ChatsRavage.findById(id_chat).lean();
                const messageKey = await getMessageKey(chat, emisor_id, ratchet_info.iteration);
                if (!messageKey) { resolve(null); return; }
                stream_final = downloadStream.pipe(crearDecipherStream(messageKey, Buffer.from(ivHex, 'hex'), Buffer.from(tagHex, 'hex')));
            } catch { resolve(null); return; }
        }

        const chunks = [];
        stream_final.on('data', chunk => chunks.push(chunk));
        stream_final.on('end', () => {
            const base64 = Buffer.concat(chunks).toString('base64');
            resolve({ base64, mimeType: MIME_MAP[ext] || 'image/jpeg' });
        });
        stream_final.on('error', () => resolve(null));
    });
}

export async function ELIMINAR_MENSAJE(id_chat, id_mensaje) {
    try {
        const id_chat_str = normalizeId(id_chat);
        const id_mensaje_str = normalizeId(id_mensaje);

        const { getIDMongodbUsuario } = await import('../STORAGE/Variables_sesion.js');
        const id_propio = getIDMongodbUsuario();
        if (!id_propio) return { success: false, message: 'Sin sesión' };

        const chat = await ChatsRavage.findById(id_chat_str).lean();
        if (!chat) return { success: false, message: 'Chat no encontrado' };

        const esMiembro = (chat.usuarios || []).some(u => u.toString() === id_propio.toString());
        if (!esMiembro) return { success: false, message: 'No eres miembro del chat' };

        const mensaje = await MessagesRavage.findOne({
            _id: new mongoose.Types.ObjectId(id_mensaje_str),
            id_chat: new mongoose.Types.ObjectId(id_chat_str)
        }).lean();
        if (!mensaje) return { success: false, message: 'Mensaje no encontrado' };

        const esAdmin = (chat.admins || []).some(a => a.toString() === id_propio.toString());
        const esEmisor = mensaje.emisor && mensaje.emisor.toString() === id_propio.toString();

        if (!esEmisor && !esAdmin) {
            return { success: false, message: 'Sin permisos para eliminar este mensaje' };
        }

        // Eliminar archivos de GridFS si los hay
        const archivos = mensaje.contenido?.[0]?.archivos || [];
        if (archivos.length > 0) {
            const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'ArchivosChats' });
            for (const archivo of archivos) {
                const idArchivo = archivo.id || archivo._id;
                if (idArchivo) {
                    try {
                        await bucket.delete(new mongoose.Types.ObjectId(idArchivo.toString()));
                    } catch (e) {
                        log.warn({ idArchivo }, '[ELIMINAR_MENSAJE] No se pudo borrar archivo de GridFS');
                    }
                }
            }
        }

        // Marcar mensaje como borrado (limpiar contenido)
        const asunto_encriptado = encriptarDatosSistema("Este mensaje ha sido eliminado");
        
        await MessagesRavage.updateOne(
            { _id: new mongoose.Types.ObjectId(id_mensaje_str) },
            {
                $set: {
                    contenido: [{ asunto: asunto_encriptado, archivos: [] }],
                    encriptado: null,
                    especial: { borrado: true }
                }
            }
        );

        // Si el chat tenía fijado este mensaje, desfijarlo automáticamente
        if (chat.msfijado && chat.msfijado.toString() === id_mensaje_str.toString()) {
            await ChatsRavage.updateOne(
                { _id: new mongoose.Types.ObjectId(id_chat_str) },
                { $set: { msfijado: null } }
            );
            chat.msfijado = null;
            setChatEnCacheRaw(chat).catch(e => log.error(e));
        }

        log.info({ id_mensaje_str, id_chat_str }, '[ELIMINAR_MENSAJE] Mensaje eliminado');
        return { success: true };
    } catch (e) {
        log.error({ err: e }, '[ELIMINAR_MENSAJE] Error');
        return { success: false, message: 'Error interno' };
    }
}

export async function FIJAR_MENSAJE(id_chat, id_mensaje) {
    try {
        const id_chat_str = normalizeId(id_chat);
        const id_mensaje_str = normalizeId(id_mensaje);

        const { getIDMongodbUsuario } = await import('../STORAGE/Variables_sesion.js');
        const id_propio = getIDMongodbUsuario();
        if (!id_propio) return { success: false, message: 'Sin sesión' };

        const chat = await ChatsRavage.findById(id_chat_str).lean();
        if (!chat) return { success: false, message: 'Chat no encontrado' };

        const esAdmin = (chat.admins || []).some(a => a.toString() === id_propio.toString());
        if (!esAdmin) return { success: false, message: 'Solo los admins pueden fijar mensajes' };

        const existe = await MessagesRavage.exists({
            _id: new mongoose.Types.ObjectId(id_mensaje_str),
            id_chat: new mongoose.Types.ObjectId(id_chat_str)
        });
        if (!existe) return { success: false, message: 'Mensaje no encontrado' };

        await ChatsRavage.updateOne(
            { _id: new mongoose.Types.ObjectId(id_chat_str) },
            { $set: { msfijado: new mongoose.Types.ObjectId(id_mensaje_str) } }
        );
        chat.msfijado = new mongoose.Types.ObjectId(id_mensaje_str);
        setChatEnCacheRaw(chat).catch(e => log.error(e));

        log.info({ id_mensaje_str, id_chat_str }, '[FIJAR_MENSAJE] Mensaje fijado');
        return { success: true };
    } catch (e) {
        log.error({ err: e }, '[FIJAR_MENSAJE] Error');
        return { success: false, message: 'Error interno' };
    }
}

export async function DESFIJAR_MENSAJE(id_chat) {
    try {
        const id_chat_str = normalizeId(id_chat);

        const { getIDMongodbUsuario } = await import('../STORAGE/Variables_sesion.js');
        const id_propio = getIDMongodbUsuario();
        if (!id_propio) return { success: false, message: 'Sin sesión' };

        const chat = await ChatsRavage.findById(id_chat_str).lean();
        if (!chat) return { success: false, message: 'Chat no encontrado' };

        const esAdmin = (chat.admins || []).some(a => a.toString() === id_propio.toString());
        if (!esAdmin) return { success: false, message: 'Solo los admins pueden desfijar mensajes' };

        await ChatsRavage.updateOne(
            { _id: new mongoose.Types.ObjectId(id_chat_str) },
            { $set: { msfijado: null } }
        );
        chat.msfijado = null;
        setChatEnCacheRaw(chat).catch(e => log.error(e));

        log.info({ id_chat_str }, '[DESFIJAR_MENSAJE] Mensaje desfijado');
        return { success: true };
    } catch (e) {
        log.error({ err: e }, '[DESFIJAR_MENSAJE] Error');
        return { success: false, message: 'Error interno' };
    }
}