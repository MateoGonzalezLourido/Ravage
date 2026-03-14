import { MessagesRavage } from '../models/Message.js';
import { ChatsRavage } from '../models/Chat.js';
import { User } from '../models/User.js';
import { mongoose, GridFSBucket, ObjectId, fs } from '../utils/libs.js';
import { Añadir_Entrada_Buzon_Usuario } from './BuzonRepository.js';

export async function ENVIAR_MENSAJE({ asunto = "", archivos = [], id_chat, id_emisor }) {
    try {
        const chat = await ChatsRavage.findById(id_chat);
        if (!chat) return false;
        const usuario = await User.findById(id_emisor);
        if (!usuario) return false;

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

        const mensaje = {
            id_chat,
            emisor: id_emisor,
            contenido: [{ asunto, archivos: contenido_archivos }],
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
                    arrayFilters: [{ "chat.id": chat._id?.toHexString() }]
                }
            );
        })();

        Añadir_Entrada_Buzon_Usuario({ 
            ids: chat.usuarios?.filter(id => id !== id_emisor), 
            tipo: 0, 
            data: { id_chat: chat._id?.toHexString(), id_mensaje: nuevoMensaje._id?.toHexString() } 
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
        return mensaje;
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

export async function DESCARGAR_ARCHIVO(id, nombre) {
    const bucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: "ArchivosChats"
    });
    const downloadStream = bucket.openDownloadStream(new ObjectId(id));
    const { getAjustesAppFile } = await import('../services/controladorArchivos.js');
    const ruta_principal = await getAjustesAppFile("URL_DESCARGA");

    if (!fs.existsSync(ruta_principal)) {
        fs.mkdirSync(ruta_principal, { recursive: true });
    }

    const { join, dirname, basename, extname } = await import('path');
    const rutaCompleta = join(ruta_principal, nombre);

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
