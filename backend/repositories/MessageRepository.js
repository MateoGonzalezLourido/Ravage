import { MessagesRavage } from '../models/Message.js';
import { ChatsRavage } from '../models/Chat.js';
import { User } from '../models/User.js';
import { mongoose, GridFSBucket, ObjectId, fs } from '../utils/libs.js';
import { convertirObjectId } from '../utils/conversores.js';
import { Añadir_Entrada_Buzon_Usuario } from './BuzonRepository.js';
import { cifrarContenido, descifrarConPrivada, descifrarContenido } from '../services/cryptoService.js';
import { readFileSession } from '../services/controladorArchivos.js';
import { getIDMongodbUsuario } from '../STORAGE/Variables_sesion.js';

export async function ENVIAR_MENSAJE({ asunto = "", archivos = [], id_chat, id_emisor }) {
    try {
        const chat = await ChatsRavage.findById(id_chat);
        if (!chat) return false;
        const usuario = await User.findById(id_emisor);
        if (!usuario) return false;

        // E2EE: Obtener ChatKey descifrada
        const identity_data = await readFileSession('identity');
        if (!identity_data || !identity_data.privateKey) {
            console.error("No se encontró la llave privada local para E2EE");
            return false;
        }

        const clave_envuelta_obj = chat.claves_cifradas.find(c => c.usuario_id.toString() === id_emisor.toString());
        if (!clave_envuelta_obj) {
            console.error("Este chat no tiene llaves de cifrado configuradas para el usuario actual");
            return false;
        }

        const chatKeyHex = descifrarConPrivada(clave_envuelta_obj.clave_envuelta, identity_data.privateKey);
        const chatKey = Buffer.from(chatKeyHex, 'hex');

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
                const uploadStream = bucket.openUploadStreamWithId(idArchivo, nombreCompletoUsar);
                await new Promise((resolve, reject) => {
                    fs.createReadStream(archivo.ruta)
                        .pipe(uploadStream)
                        .on("error", reject)
                        .on("finish", resolve);
                });
                contenido_archivos.push({
                    nombre: nombreCompletoUsar,
                    id: idArchivo.toHexString()
                });
            }
        }

        // Cifrar contenido completo
        const payload = JSON.stringify([{ asunto, archivos: contenido_archivos }]);
        const encriptado = cifrarContenido(payload, chatKey);

        const mensaje = {
            id_chat: new mongoose.Types.ObjectId(id_chat),
            emisor: new mongoose.Types.ObjectId(id_emisor),
            contenido: [], // Campo antiguo vacío (E2EE)
            encriptado: encriptado, // Nuevo campo cifrado
            data: new Date()
        };

        const nuevoMensaje = await MessagesRavage.create(mensaje);

        (async () => {
            await User.updateMany(
                { _id: { $in: chat.usuarios } },
                {
                    $set: {
                        "chats.$[chat].ultimoCambio": new Date(),
                        "chats.$[chat].ultimomensaje": asunto
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
        const mensaje = await MessagesRavage.findOne({ id_chat, _id: id_mensaje }).lean();
        if (!mensaje) return null;

        if (mensaje.encriptado && mensaje.encriptado.data) {
            const chatKey = await getDecryptedChatKey(id_chat);
            const [decrypted] = descifrarListaMensajes([mensaje], chatKey);
            return convertirObjectId(decrypted);
        }

        return convertirObjectId(mensaje);
    } catch (e) {
        console.error(e);
        return null;
    }
}

/**
 * Helper para obtener la ChatKey descifrada de un chat para el usuario actual.
 */
async function getDecryptedChatKey(id_chat) {
    const chat = await ChatsRavage.findById(id_chat).lean();
    if (!chat || !chat.claves_cifradas) return null;

    const id_propio = getIDMongodbUsuario();
    const identity_data = await readFileSession('identity');
    if (!identity_data || !identity_data.privateKey) return null;

    const clave_envuelta_obj = chat.claves_cifradas.find(c => c.usuario_id.toString() === id_propio.toString());
    if (!clave_envuelta_obj) return null;

    try {
        const chatKeyHex = descifrarConPrivada(clave_envuelta_obj.clave_envuelta, identity_data.privateKey);
        return Buffer.from(chatKeyHex, 'hex');
    } catch (e) {
        console.error("Error descifrando ChatKey:", e);
        return null;
    }
}

/**
 * Helper para descifrar un array de mensajes.
 * @param {Array} mensajes - Array de mensajes de MongoDB (lean)
 * @param {Buffer} chatKey - La llave simétrica del chat
 */
export function descifrarListaMensajes(mensajes, chatKey) {
    if (!mensajes || !chatKey) return mensajes;
    return mensajes.map(m => {
        if (m.encriptado && m.encriptado.data) {
            try {
                const decryptedPayload = descifrarContenido(m.encriptado, chatKey);
                m.contenido = JSON.parse(decryptedPayload);
            } catch (err) {
                console.error("Error descifrando mensaje individual:", err);
                m.contenido = [{ asunto: "[Error al descifrar]", archivos: [] }];
            }
        }
        return m;
    });
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

export async function DESCARGAR_ARCHIVO(id, nombre) {
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

    return new Promise((resolve, reject) => {
        downloadStream
            .pipe(writeStream)
            .on("finish", () => resolve(rutaFinal))
            .on("error", reject);
    });
}
