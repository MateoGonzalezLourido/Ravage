import { BuzonUsuarios } from '../models/Buzon.js';
import { getIDMongodbUsuario, getListaChats, getUsuariosSilence, getUsuariosBloqueados } from '../STORAGE/Variables_sesion.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('buzon');

let changeStream = null;

export async function iniciarBuzon(io, mainWindow) {
    if (changeStream) {
        await detenerBuzon();
    }

    log.info("Buzón iniciado")
    changeStream = BuzonUsuarios.watch([], { fullDocument: "updateLookup" });

    changeStream.on("change", (change) => {
        const userId = change.documentKey._id;
        const myUserId = getIDMongodbUsuario();
        
        // Evita enviar entradas del buzón de otros usuarios a nuestra ventana principal
        if (!myUserId || userId.toString() !== myUserId.toString()) return;

        const doc = change.fullDocument;
        
        // Filtrar datos antes de enviar al frontend (Mejora IPC/BFF)
        const docFiltrado = filtrar_entradas_ipc(doc);
        
        if (docFiltrado && docFiltrado.entrada && docFiltrado.entrada.length > 0) {
            // Enviar al socket (otros clientes si los hubiera), pero en este caso solo tiene un id
            io.to(userId.toString()).emit("nueva-notificacion", docFiltrado);
            // Enviar a tu renderer de la ventana principal
            if (mainWindow) {
                mainWindow.webContents.send("nueva-notificacion", docFiltrado);
            }
        }

    });
    changeStream.on("error", (err) => {
        // Ignore the error if the stream is being closed deliberately
        if (err.name === 'MongoClientClosedError') return;
        log.error({ err }, "Error en Change Stream");
    });
}

export async function detenerBuzon() {
    if (changeStream) {
        try {
            await changeStream.close();
            changeStream = null;
            log.info("Buzón detenido")
        } catch (err) {
            log.error({ err }, "Error al detener el buzón");
        }
    }
}

function filtrar_entradas_ipc(doc){
    if (!doc || !doc.entrada || !Array.isArray(doc.entrada)) return doc;
    
    // Si viene la bd sin 'entrada' o vacía, la devolvemos tal cual
    if (doc.entrada.length === 0) return doc;

    const chats_usuario = getListaChats() || [];
    const ids_silenciados = (getUsuariosSilence() || []).map(u => u.toString());
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
                if (chatInfo.silenciado) esta_silenciado = true;
                if (chatInfo.bloqueado) esta_bloqueado = true;
            }
        } 
        // Comprobar usuario individual
        else if (id_emisor_entrada) {
            if (ids_silenciados.includes(id_emisor_entrada.toString())) esta_silenciado = true;
            if (ids_bloqueados.includes(id_emisor_entrada.toString())) esta_bloqueado = true;
        }

        // Si el chat/usuario está bloqueado, descartamos la notificación (no entra al frontend)
        if (esta_bloqueado) continue;

        // Si está silenciado, le añadimos el flag para que el frontend no la haga sonar/saltar visualmente
        if (esta_silenciado) {
            entrada.silenciado = true;
        }

        entradas_filtradas.push(entrada);
    }

    // Clonamos para evitar mutar el `doc` original de mongo por si acaso, aunque en este punto da un poco igual
    const docClonado = { ...doc, entrada: entradas_filtradas };
    return docClonado;
}