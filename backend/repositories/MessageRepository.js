import { MessagesRavage } from '../models/Message.js';
import { ChatsRavage } from '../models/Chat.js';
import { User } from '../models/User.js';
import { mongoose, GridFSBucket, ObjectId, fs, randomBytes } from '../utils/libs.js';
import { convertirObjectId } from '../utils/conversores.js';
import { Añadir_Entrada_Buzon_Usuario } from './BuzonRepository.js';
import { readFileSession } from '../services/controladorArchivos.js';
import { setChatEnCacheRaw } from './ChatRepository.js';
import { obtener_datos_usuario, procesarUsuario } from './UserRepository.js';
import { setUsuarioEnCache } from '../STORAGE/CACHE/_cache_usuarios.js';

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
            ChatsRavage.findById(id_chat),
            User.findById(id_emisor)
        ]);

        if (!chat || !usuario) return false;

        // Comprobar si el usuario tiene el chat bloqueado
        const chatUsuarioInfo = usuario.chats.find(c => c.id.toString() === id_chat.toString());
        if (chatUsuarioInfo && chatUsuarioInfo.bloqueado) {
            console.warn(`[ENVIAR_MENSAJE] Intento de envío en chat bloqueado (${id_chat}) por el usuario ${id_emisor}`);
            return false;
        }

        // E2EE: Obtener identidad de la caché en memoria (mucho más rápido que disco)
        const identity_data = await getIdentity();
        if (!identity_data || !identity_data.privateKey) {
            console.error("No se encontró la llave privada local para E2EE");
            return false;
        }

        // Buscar la entrada del emisor para sí mismo (donde guarda su cadena de envío)
        const ratchet_entry = chat.ratchet_keys.find(k => 
            k.emisor_id.toString() === id_emisor.toString() && 
            k.receptor_id.toString() === id_emisor.toString()
        );

        if (!ratchet_entry) {
            console.error("No se encontró la cadena de envío para el usuario actual");
            return false;
        }

        let current_ck_hex;
        let active_entry = ratchet_entry;

        async function intentarDescifrado(ent) {
            const id_data = await getIdentity();
            if (!id_data || !id_data.privateKey) throw new Error("No Identity keys found locally.");
            return descifrarConPrivada(ent.clave_envuelta, id_data.privateKey);
        }

        try {
            current_ck_hex = await intentarDescifrado(active_entry);
        } catch (err) {
            console.warn(`[E2EE] Fallo al descifrar propia llave de cadena en chat ${id_chat}. Intentando recuperación por rotación...`, err.message);
            
            try {
                const { rotarClavesChat } = await import('./ChatRepository.js');
                await rotarClavesChat(id_chat, id_emisor);
                
                let chatAct = await ChatsRavage.findById(id_chat).lean();
                active_entry = chatAct.ratchet_keys.find(k => 
                    k.emisor_id.toString() === id_emisor.toString() && 
                    k.receptor_id.toString() === id_emisor.toString()
                );
                
                if (!active_entry) throw new Error("Ratchet entry not found after rotation.");
                current_ck_hex = await intentarDescifrado(active_entry);
                console.log("[E2EE] Recuperación por rotación exitosa.");
            } catch (err2) {
                console.error("[E2EE] Rotación de chat insuficiente. Fallo crítico de identidad detectado.", err2.message);
                
                // OPCIÓN NUCLEAR: Solo si la llave privada local ya no sirve para NADA.
                // Esto romperá la retrocompatibilidad con TODOS los chats existentes.
                try {
                    const { REGENERAR_IDENTIDAD_USUARIO } = await import('../services/sesionUsuario.js');
                    const regenOk = await REGENERAR_IDENTIDAD_USUARIO();
                    if (!regenOk) throw new Error("Failed to regenerate identity.");
                    
                    const { rotarClavesChat } = await import('./ChatRepository.js');
                    await rotarClavesChat(id_chat, id_emisor);
                    
                    let chatAct = await ChatsRavage.findById(id_chat).lean();
                    active_entry = chatAct.ratchet_keys.find(k => 
                        k.emisor_id.toString() === id_emisor.toString() && 
                        k.receptor_id.toString() === id_emisor.toString()
                    );
                    
                    current_ck_hex = await intentarDescifrado(active_entry);
                    console.warn("[E2EE] Recuperación nuclear completada. Los mensajes antiguos podrían no ser legibles.");
                } catch (err3) {
                    console.error("[E2EE] Fallo absoluto en el sistema criptográfico:", err3.message);
                    return false;
                }
            }
        }

        const iteration = active_entry.counter;
        
        // Ratchet: Derivar MessageKey y el siguiente ChainKey
        const { messageKey, nextChainKey } = ratchetChainKey(current_ck_hex);
        const chatKey = messageKey; 


        const contenido_archivos = [];
        // ... (resto del proceso de archivos igual)
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
                
                // Usamos el ID como nombre en GridFS para ocultar el nombre real
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
                chain_id: "default" // Se puede mejorar para rotación completa
            }
        };

        const nuevoMensaje = await MessagesRavage.create(mensaje);

        // Actualizar el estado del ratchet en el Chat para el emisor
        // Nota: para simplificar, el emisor solo actualiza su propia copia. 
        // Los receptores ratchetearán hacia adelante desde la clave que tengan.
        await ChatsRavage.updateOne(
            { _id: id_chat, "ratchet_keys.emisor_id": id_emisor, "ratchet_keys.receptor_id": id_emisor },
            { 
                $set: { "ratchet_keys.$.clave_envuelta": cifrarConPublica(nextChainKey, usuario.publicKey) },
                $inc: { "ratchet_keys.$.counter": 1 }
            }
        );

        // Actualizar el objeto local para evitar un segundo findById
        const target_entry = chat.ratchet_keys.find(k => 
            k.emisor_id.toString() === id_emisor.toString() && 
            k.receptor_id.toString() === id_emisor.toString()
        );
        if (target_entry) {
            target_entry.clave_envuelta = cifrarConPublica(nextChainKey, usuario.publicKey);
            target_entry.counter += 1;
        }

        // Actualizar cache del chat (importante por los ratchet_keys) con el objeto local ya actualizado
        await setChatEnCacheRaw(chat.toObject ? chat.toObject() : chat);

        // Rotación automática si el contador es muy alto
        const ROTATION_THRESHOLD = 100;
        if (iteration >= ROTATION_THRESHOLD) {
            (async () => {
                const { rotarClavesChat } = await import('./ChatRepository.js');
                await rotarClavesChat(id_chat, id_emisor);
            })();
        }

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
                {
                    arrayFilters: [{ "chat.id": new mongoose.Types.ObjectId(id_chat) }]
                }
            );

            // Forzar actualización en caché de los usuarios involucrados tras la modificación
            const usuarios_afectados_db = await User.find({ _id: { $in: ids_afectados } }).lean();
            for (const u of usuarios_afectados_db) {
                await setUsuarioEnCache(procesarUsuario(u)); 
            }
        })();


        Añadir_Entrada_Buzon_Usuario({ 
            ids: chat.usuarios?.filter(id => id.toString() !== id_emisor.toString()), 
            tipo: 0, 
            data: { chat: chat._id?.toHexString(), id_mensaje: nuevoMensaje._id?.toHexString() } 
        }).catch(e => console.error(e));
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

export async function obtener_datos_mensaje(id_chat, id_mensaje) {
    try {
        const chat = await ChatsRavage.findById(id_chat).lean();
        const mensaje = await MessagesRavage.findOne({ id_chat, _id: id_mensaje }).lean();
        if (!mensaje) return null;

        if (mensaje.encriptado && mensaje.encriptado.data) {
            const [decrypted] = await descifrarListaMensajes([mensaje], chat);
            return convertirObjectId(decrypted);
        }

        return convertirObjectId(mensaje);
    } catch (e) {
        console.error(e);
        return null;
    }
}


export async function limpiar_mensajes_chats_antiguos(chatIdsRaw) {
    const chatIds = chatIdsRaw.map(c => c.id);
    if (chatIds.length === 0) return null;
    const haceUnAno = new Date();
    haceUnAno.setFullYear(haceUnAno.getFullYear() - 1);
    try {
        await MessagesRavage.deleteMany({ id_chat: { $in: chatIds }, data: { $lt: haceUnAno } });
        return true;
    } catch (e) {
        console.error(e);
        return null;
    }
}

/**
 * Descarga y descifra un archivo.
 * Ahora requiere ratchet_info y emisor_id para derivar la clave correcta.
 */
export async function DESCARGAR_ARCHIVO(id, nombre, ivHex = null, tagHex = null, id_chat = null, ratchet_info = null, emisor_id = null) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        console.error("ID de archivo no válido:", id);
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
            }
        }



        stream_final
            .pipe(writeStream)
            .on("finish", async () => {
                const { setCacheArchivosDescargados } = await import('../STORAGE/CACHE/_cache_archivos_descargados.js');
                await setCacheArchivosDescargados({
                    id_chat,
                    id_archivo: id.toString(),
                    nombre: nombre,
                    iv: ivHex,
                    tag: tagHex,
                    fecha: new Date().toISOString()
                });
                resolve(rutaFinal)
            })
            .on("error", reject);
    });
}
