import { BuzonUsuarios } from '../models/Buzon.js';
import { getIDMongodbUsuario, getListaChats, getUsuariosSilence, getUsuariosBloqueados } from '../STORAGE/Variables_sesion.js';
import { desencriptarDatosSistema } from '../services/cryptoService.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('buzon');

let changeStream = null;
let primer_contacto = true
export async function iniciarBuzon(io, mainWindow) {
    if (changeStream) {
        await detenerBuzon();
    }

    log.info("Buzón iniciado")
    changeStream = BuzonUsuarios.watch([], { fullDocument: "updateLookup" });

    changeStream.on("change", (change) => {
        const userId = change.documentKey._id;
        const myUserId = getIDMongodbUsuario();

        // Evitar enviar entradas del buzón de otros usuarios 
        if (!myUserId || userId.toString() !== myUserId.toString()) return;

        const doc = change.fullDocument;
        if (doc && doc.entrada) {
            doc.entrada = doc.entrada.map(ent => {
                let decryptedData = ent.data;
                // Si es un objeto encriptado (tiene data, iv, tag), lo desencriptamos
                if (ent.data && typeof ent.data === 'object' && ent.data.data && ent.data.iv && ent.data.tag) {
                    const decrypted = desencriptarDatosSistema(ent.data);
                    // Si el resultado es un string (lo usual), intentamos parsearlo por si es un objeto JSON
                    try {
                        decryptedData = (typeof decrypted === 'string') ? JSON.parse(decrypted) : decrypted;
                    } catch (e) {
                        decryptedData = decrypted;
                    }
                } else if (ent.data && typeof ent.data === 'string') {
                    // Fallback para versiones/tipos que guarden el string directamente (aunque no es lo normal)
                    decryptedData = desencriptarDatosSistema(ent.data);
                }
                return { ...ent, data: decryptedData };
            });
        }

        // Filtrar+optimizar datos antes de enviar al frontend (Mejora IPC/BFF)
        const docOptimizado = primer_contacto ? optimizar_cola_entradas_buzon(doc) : null;
        const docFiltrado = filtrar_entradas_ipc(docOptimizado || doc, primer_contacto);
        if (primer_contacto) primer_contacto = false;

        if (docFiltrado && docFiltrado.entrada && docFiltrado.entrada.length > 0) {
            // Enviar al socket (otros clientes si los hubiera), pero en este caso solo tiene un id
            io.to(userId.toString()).emit("nueva-notificacion", docFiltrado);
            // Enviar al renderer
            mainWindow.webContents.send("nueva-notificacion", docFiltrado);
        }

    });
    changeStream.on("error", (err) => {
        // Ignorar el error si el stream se está cerrando deliberadamente
        if (err.name === 'MongoClientClosedError') return;
        log.error({ err }, "Error en Change Stream -BuzonAPI");
    });
}

export async function detenerBuzon() {
    if (changeStream) {
        try {
            await changeStream.close();
            changeStream = null;
            primer_contacto = true
            log.info("Buzón detenido")
        } catch (err) {
            log.error({ err }, "Error al detener el buzón");
        }
    }
}

function filtrar_entradas_ipc(doc, ForceSilenciar = false) {
    if (!doc || !doc.entrada || !Array.isArray(doc.entrada)) return doc;

    // Si viene la bd sin 'entrada' o vacía, la devolvemos tal cual
    if (doc.entrada.length === 0) return doc;

    const chats_usuario = getListaChats() || [];
    let ids_silenciados = [];
    if (!ForceSilenciar) {
        ids_silenciados = (getUsuariosSilence() || []).map(u => u.toString());
    }
    const ids_bloqueados = (getUsuariosBloqueados() || []).map(u => u.toString()); // Por si acaso hay bloqueo a nivel user global

    const entradas_filtradas = [];

    for (const entrada of doc.entrada) {
        const id_chat_entrada = (entrada.data && entrada.data.chat) || entrada.chat;
        const id_emisor_entrada = (entrada.data && entrada.data.emisor) || (entrada.data && entrada.data.creador);

        let esta_silenciado = false;
        let esta_bloqueado = false;

        // Comprobar chat
        if (id_chat_entrada) {
            const chatInfo = chats_usuario.find(c => (c.id || c._id || "").toString() == id_chat_entrada.toString());
            if (chatInfo) {
                if (chatInfo.silenciado || ForceSilenciar) esta_silenciado = true;
                if (chatInfo.bloqueado) esta_bloqueado = true;
            }
        }
        // Comprobar usuario individual
        else if (id_emisor_entrada && !esta_bloqueado) {
            if (!esta_silenciado && (ids_silenciados.includes(id_emisor_entrada.toString()) || ForceSilenciar)) esta_silenciado = true;
            if (ids_bloqueados.includes(id_emisor_entrada.toString())) esta_bloqueado = true;
        }

        // Si el chat/usuario está bloqueado, descartamos la notificación (no entra al frontend)
        if (esta_bloqueado) continue;

        // Si está silenciado, le añadimos el flag para que el frontend no la haga sonar/saltar visualmente
        if (esta_silenciado) entrada.silenciado = true;

        entradas_filtradas.push(entrada);
    }

    // Clonamos para evitar mutar el `doc` original de mongo por si acaso, aunque en este punto da un poco igual
    const docClonado = { ...doc, entrada: entradas_filtradas };
    return docClonado;
}
/*
*reducir entradas del mismo tipo para un inicio ameno para el usuario y silenciarlas 
*ejemplo:mensajes de chat en el mismo chat, solo se muestra uno
*ejemplo:expulsados del mismo chat, solo se muestra uno
*ejemplo:añadidos del mismo chat, solo se muestra uno
*/
function optimizar_cola_entradas_buzon(doc) {
    if (!doc || !doc.entrada || !Array.isArray(doc.entrada)) return doc;
    const entradas_optimizadas = [];
    //primer filtrado (borrar cuales no se usaran)
    const entradas_optimizar = doc.entrada.filter(e => e.tipo !== 2)
    //segundo filtrado (reducir entradas repetitivas)
    let entradas_usar_sin_optimizar = {}
    for (const entrada of entradas_optimizar) {
        if (entrada.tipo === 0 || entrada.tipo === 4 || entrada.tipo === 3) {
            const id_chat_entrada = (entrada.data && entrada.data.chat) || entrada.chat;
            //crear estructura id_chat:{tipo,entrada}
            const key = entradas_usar_sin_optimizar[id_chat_entrada.toString()]
            if (!key || key.tipo !== entrada.tipo) {
                entradas_usar_sin_optimizar[id_chat_entrada.toString()] = { tipo: entrada.tipo, entrada: entrada };
            }
        }
        else {
            entradas_optimizadas.push(entrada);
        }
    }

    //mandar entradas optimizadas
    entradas_optimizadas.push(...Object.values(entradas_usar_sin_optimizar));
    return { ...doc, entrada: entradas_optimizadas };
}