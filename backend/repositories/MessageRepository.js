import { MessagesRavage } from '../models/Message.js';
import { ChatsRavage } from '../models/Chat.js';
import { User } from '../models/User.js';
import { mongoose, GridFSBucket, ObjectId, fs, randomBytes } from '../utils/libs.js';
import { convertirObjectId } from '../utils/conversores.js';
import { Añadir_Entrada_Buzon_Usuario } from './BuzonRepository.js';
import { readFileSession } from '../services/controladorArchivos.js';
import { getIDMongodbUsuario } from '../STORAGE/Variables_sesion.js';
import { descifrarListaMensajes, getMessageKey } from '../services/messageCryptoService.js';
import { cifrarContenido, descifrarConPrivada, descifrarContenido, crearCipherStream, crearDecipherStream, encriptarDatosSistema, desencriptarDatosSistema } from '../services/cryptoService.js';




export async function ENVIAR_MENSAJE({ asunto = "", archivos = [], id_chat, id_emisor }) {
    try {
        const chat = await ChatsRavage.findById(id_chat);
        if (!chat) return false;
        const usuario = await User.findById(id_emisor);
        if (!usuario) return false;

        // E2EE: Obtener la ChainKey (Sender Key) del emisor
        const identity_data = await readFileSession('identity');
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

        const current_ck_hex = descifrarConPrivada(ratchet_entry.clave_envuelta, identity_data.privateKey);
        const iteration = ratchet_entry.counter;
        
        // Ratchet: Derivar MessageKey y el siguiente ChainKey
        const { messageKey, nextChainKey } = (await import('../services/cryptoService.js')).ratchetChainKey(current_ck_hex);
        const chatKey = messageKey; // Usamos la MK para esta sesión de cifrado


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

        const dummy_id = "000000000000000000000000";
        const mensaje = {
            id_chat: new mongoose.Types.ObjectId(id_chat),
            emisor: new mongoose.Types.ObjectId(dummy_id),
            contenido: [],
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

        // Rotación automática si el contador es muy alto
        const ROTATION_THRESHOLD = 100;
        if (iteration >= ROTATION_THRESHOLD) {
            (async () => {
                const { rotarClavesChat } = await import('./ChatRepository.js');
                await rotarClavesChat(id_chat, id_emisor);
            })();
        }

        (async () => {
            await User.updateMany(
                { _id: { $in: chat.usuarios } },
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


/**
 * Helper para descifrar un array de mensajes.
 * @param {Array} mensajes - Array de mensajes de MongoDB (lean)
 * @param {Buffer} chatKey - La llave simétrica del chat
 */
/**
 * Helper para descifrar un array de mensajes usando el sistema de Ratchet.
 * @param {Array} mensajes - Array de mensajes de MongoDB (lean)
 * @param {Object} chat - El objeto chat completo de MongoDB (lean o hidratado)
 */
export async function descifrarListaMensajes(mensajes, chat) {
    if (!mensajes || !chat || !chat.ratchet_keys) return mensajes;

    const id_propio = getIDMongodbUsuario();
    const identity_data = await readFileSession('identity');
    if (!identity_data || !identity_data.privateKey) return mensajes;

    const { ratchetChainKey } = await import('../services/cryptoService.js');

    // Caché local de claves para este lote de mensajes para evitar lecturas repetidas
    const cache_keys = {}; 

    for (let m of mensajes) {
        if (m.encriptado && m.encriptado.data && m.ratchet_info) {
            try {
                const emisor_id = m.emisor ? m.emisor.toString() : null;
                if (!emisor_id || emisor_id === "000000000000000000000000") {
                    // Si el emisor no está en el mensaje, recuperarlo si es posible o saltar
                    // Nota: en el nuevo formato, el emisor está DENTRO del encriptado, 
                    // pero necesitamos saber quién lo envió para elegir la cadena.
                    // Usaremos el campo 'emisor' original si existe (aunque sea el dummy, buscar el real si se puede)
                    // Para este sistema, el emisor REAL debe estar en m.emisor_real o similar, 
                    // pero si no, usaremos el chat.usuarios[0] como fallback o buscaremos por chain_id.
                }

                // Buscar la cadena del emisor para este receptor (nosotros)
                // Usamos m.ratchet_info.emisor_id si lo añadimos, o confiamos en m.emisor
                const target_emisor_id = m.emisor.toString();
                const cache_key = `${target_emisor_id}_${id_propio}`;
                
                let current_state = cache_keys[cache_key];
                if (!current_state) {
                    const entry = chat.ratchet_keys.find(k => 
                        k.emisor_id.toString() === target_emisor_id && 
                        k.receptor_id.toString() === id_propio.toString()
                    );
                    if (!entry) throw new Error("No hay llave de ratchet para este emisor");
                    
                    const ck_hex = descifrarConPrivada(entry.clave_envuelta, identity_data.privateKey);
                    current_state = { ck: ck_hex, counter: entry.counter };
                    cache_keys[cache_key] = current_state;
                }

                // Ratchett forward si el mensaje es más reciente que nuestro estado guardado
                while (current_state.counter < m.ratchet_info.iteration) {
                    const { nextChainKey } = ratchetChainKey(current_state.ck);
                    current_state.ck = nextChainKey;
                    current_state.counter++;
                }

                // Obtener la MK para este mensaje
                const { messageKey, nextChainKey } = ratchetChainKey(current_state.ck);
                
                // Descifrar
                const decryptedPayload = descifrarContenido(m.encriptado, messageKey);
                const data = JSON.parse(decryptedPayload);

                if (data && !Array.isArray(data)) {
                    m.contenido = [{ 
                        asunto: data.asunto, 
                        archivos: data.archivos.map(a => ({
                            ...a,
                            nombre: (a.nombre && typeof a.nombre === 'object') ? desencriptarDatosSistema(a.nombre) : a.nombre
                        }))
                    }];
                    m.emisor = data.emisor; // Restaurar emisor real
                    m.data = data.data;
                }

                // Avanzar el estado para el siguiente mensaje del mismo lote
                current_state.ck = nextChainKey;
                current_state.counter++;

                // Opcional: Actualizar el estado en la DB para persistir el avance
                // (Se recomienda hacerlo al final del lote para eficiencia)
                
            } catch (err) {
                console.error("Error descifrando mensaje con Ratchet:", err);
                m.contenido = [{ asunto: "[Error al descifrar]", archivos: [] }];
            }
        }
    }

    // Actualizar estados en DB al finalizar el lote si avanzaron
    for (const [key, state] of Object.entries(cache_keys)) {
        const [emisor_id, receptor_id] = key.split('_');
        // Solo actualizar si el contador avanzó respecto al original del chat (idealmente comparar con chat.ratchet_keys)
        await ChatsRavage.updateOne(
            { _id: chat._id, "ratchet_keys.emisor_id": emisor_id, "ratchet_keys.receptor_id": receptor_id },
            { 
                $set: { 
                    "ratchet_keys.$.clave_envuelta": cifrarConPublica(state.ck, identity_data.publicKey),
                    "ratchet_keys.$.counter": state.counter 
                }
            }
        ).catch(e => console.error("Fallo persistiendo ratchet state:", e));
    }

    return mensajes;
    return mensajes;
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
            .on("finish", () => resolve(rutaFinal))
            .on("error", reject);
    });
}
