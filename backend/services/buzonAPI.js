import { BuzonUsuarios } from '../models/Buzon.js';
import { getIDMongodbUsuario, getListaChats, getUsuariosSilence, getUsuariosBloqueados } from '../STORAGE/Variables_sesion.js';
import { desencriptarDatosSistema } from '../services/cryptoService.js';
import { createLogger } from '../utils/logger.js';
import { procesarNotificacionOSEntrada } from './notificaciones_os.js';
import { getAjustesAppFile } from './controladorArchivos.js';
const log = createLogger('buzon');

let changeStream = null;
let primer_contacto = true
export async function iniciarBuzon(io, mainWindow) {
    if (changeStream) {
        await detenerBuzon();
    }

    const myUserId = getIDMongodbUsuario();
    log.info("Buzón iniciado")
    changeStream = BuzonUsuarios.watch([
        { $match: { 'documentKey._id': myUserId } }
    ], { fullDocument: "updateLookup" });

    const sentIds = new Set();

    changeStream.on("change", (change) => {
        const doc = change.fullDocument;
        if (!doc || !doc.entrada) return;

        // Filtrar solo entradas nuevas que no hayamos procesado en esta sesión del stream
        const nuevasEntradas = doc.entrada.filter(ent => {
            if (!ent._id) return true; // Si no tiene ID (raro), la dejamos pasar
            const idStr = ent._id.toString();
            if (sentIds.has(idStr)) return false;
            sentIds.add(idStr);
            return true;
        });

        if (nuevasEntradas.length === 0) return;

        // Limpiar Set periódicamente para evitar crecimiento infinito (aunque el buzón es pequeño)
        if (sentIds.size > 500) {
            const currentIds = new Set(doc.entrada.map(e => e._id?.toString()).filter(Boolean));
            for (const id of sentIds) {
                if (!currentIds.has(id)) sentIds.delete(id);
            }
        }

        const entradasProcesadas = nuevasEntradas.map(ent => {
            let decryptedData = ent.data;
            if (ent.data && typeof ent.data === 'object' && ent.data.data && ent.data.iv && ent.data.tag) {
                const decrypted = desencriptarDatosSistema(ent.data);
                try {
                    decryptedData = (typeof decrypted === 'string') ? JSON.parse(decrypted) : decrypted;
                } catch (e) {
                    decryptedData = decrypted;
                }
            } else if (ent.data && typeof ent.data === 'string') {
                decryptedData = desencriptarDatosSistema(ent.data);
            }
            return { ...ent, data: decryptedData };
        });

        const docProcesado = { ...doc, entrada: entradasProcesadas };
        
        // El primer contacto puede requerir optimización (ej. agrupar notificaciones antiguas)
        const docFinal = primer_contacto ? optimizar_cola_entradas_buzon(docProcesado) : docProcesado;
        const docFiltrado = filtrar_entradas_ipc(docFinal, primer_contacto);
        
        if (primer_contacto) primer_contacto = false;

        if (docFiltrado && docFiltrado.entrada && docFiltrado.entrada.length > 0) {
            io.to(myUserId.toString()).emit("nueva-notificacion", docFiltrado);
            mainWindow.webContents.send("nueva-notificacion", docFiltrado);

            // Notificaciones nativas del OS — async fire-and-forget (no bloqueamos el stream)
            (async () => {
                try {
                    const ajustesOS = await getAjustesAppFile();
                    const onClickCb = () => {
                        if (!mainWindow.isDestroyed()) {
                            mainWindow.show();
                            mainWindow.focus();
                        }
                    };
                    for (const entrada of docFiltrado.entrada) {
                        procesarNotificacionOSEntrada({ entrada, ajustes: ajustesOS || {}, mainWindow, onClickCb });
                    }
                } catch (err) {
                    log.error({ err }, 'Error al procesar notificaciones OS');
                }
            })();
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
    entradas_optimizadas.push(...Object.values(entradas_usar_sin_optimizar).map(v => v.entrada));
    return { ...doc, entrada: entradas_optimizadas };
}