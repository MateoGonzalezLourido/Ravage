import { createLogger } from '../utils/logger.js';
const log = createLogger('chat-ipc');
import { ipcMain, dialog } from '../utils/libs.js';
import {
    setListaChats,
    getIDMongodbUsuario
} from '../STORAGE/Variables_sesion.js';
import {
    obtener_datos_chats,
    obtener_datos_chat_unico,
    CREAR_CHAT_NUEVO,
    expulsar_usuario_chat,
    RESPONDER_SOLICITUD_AÑADIR,
    HACER_ADMIN_CHAT,
    QUITAR_ADMIN_CHAT,
    SILENCIAR_CHAT_USUARIO,
    BLOQUEAR_CHAT_USUARIO
} from '../repositories/ChatRepository.js';
import {
    obtenerChatsUsuarioDB
} from '../repositories/UserRepository.js';
import {
    ENVIAR_MENSAJE,
    DESCARGAR_ARCHIVO,
    limpiar_mensajes_chats_antiguos,
    obtener_datos_mensaje
} from '../repositories/MessageRepository.js';
import { Revisar_Buzon_Usuario } from '../repositories/BuzonRepository.js';
import { crearCacheChatActivo, obtenerCacheChatActivo } from '../STORAGE/CACHE/_cache_chat_activo.js';
import { modelo_datos_necesarios_chat } from '../STORAGE/modelo_datos_necesarios_chat.js';
import { iniciarBuzon } from '../services/buzonAPI.js';
import { comprobar_mensaje, comprobar_nombre_archivo } from '../services/validadores.js';
const authorizedPaths = new Set();

export function registerChatHandlers(mainWindow, socket) {
    ipcMain.handle("obtener-chats-usuario", async () => {
        const chats = await obtenerChatsUsuarioDB();
        setListaChats(chats); // Sincronizar con la sesión en memoria por si se usa en otros sitios
        return chats;
    })

    ipcMain.handle("obtener-datos-chats-grupales-usuario", async (_, { data, grupales, mensajes }) => {
        return await obtener_datos_chats({ data, grupales, mensajes })
    })

    ipcMain.handle("obtener-datos-chat-unico-usuario", async (_, id, datos_buscar) => {
        return await obtener_datos_chat_unico(id, datos_buscar)
    })

    ipcMain.handle("crear-chat-nuevo", async (_, ids, nombre, id_chat, solicitudAceptada) => {
        if (nombre && !comprobar_nombre_archivo(nombre).success) {
            throw new Error("Nombre de chat no válido");
        }
        return await CREAR_CHAT_NUEVO(ids, nombre, id_chat, solicitudAceptada)
    })

    ipcMain.handle("responder-solicitud-añadir", async (_, id_chat, id_mensaje, aceptar) => {
        return await RESPONDER_SOLICITUD_AÑADIR(id_chat, id_mensaje, aceptar)
    })

    ipcMain.handle("seleccionar-archivos", async () => {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ["openFile", "multiSelections"]
        })
        filePaths.forEach(p => authorizedPaths.add(p))
        return filePaths
    })

    ipcMain.handle("enviar-mensaje", async (_, { asunto, archivos, id_chat, id_emisor }) => {
        // Validar que todas las rutas hayan sido autorizadas por el diálogo
        for (const arc of archivos) {
            if (!authorizedPaths.has(arc.ruta)) {
                log.error({ ruta: arc.ruta }, "Acceso a ruta no autorizada bloqueado");
                throw new Error("Unauthorized path access");
            }
        }
        if (asunto && !comprobar_mensaje(asunto).success) {
            throw new Error("Contenido de mensaje no válido");
        }
        return await ENVIAR_MENSAJE({ asunto, archivos, id_chat, id_emisor })
    })

    ipcMain.handle("descargar-archivo", async (_, id, nombre, iv, tag, id_chat, ratchet_info, emisor_id) => {
        const result = await DESCARGAR_ARCHIVO(id, nombre, iv, tag, id_chat, ratchet_info, emisor_id)
        if (result && mainWindow) {
            mainWindow.webContents.send("notificar-render", { texto: `Descarga completa: ${nombre}`, tipo: "success" })
        }
        return result
    })

    ipcMain.handle("revisar-buzon", async () => {
        return await Revisar_Buzon_Usuario()
    })

    ipcMain.on("iniciar-buzon", async () => {
        const userId = getIDMongodbUsuario()
        await Revisar_Buzon_Usuario()
        socket.emit("identificar", userId);
        await iniciarBuzon(socket, mainWindow);
    })

    ipcMain.handle("obtener-datos-mensaje", async (_, id_chat, id_mensaje) => {
        return await obtener_datos_mensaje(id_chat, id_mensaje)
    })

    ipcMain.handle("expulsar-usuario-chat", async (_, id_usuario, id_chat) => {
        return await expulsar_usuario_chat(id_usuario, id_chat)
    })

    ipcMain.handle("hacer-admin-chat", async (_, id_chat, id_usuario) => {
        return await HACER_ADMIN_CHAT(id_chat, id_usuario)
    })

    ipcMain.handle("quitar-admin-chat", async (_, id_chat, id_usuario) => {
        return await QUITAR_ADMIN_CHAT(id_chat, id_usuario)
    })

    ipcMain.handle("silenciar-chat", async (_, id_chat) => {
        return await SILENCIAR_CHAT_USUARIO(id_chat)
    })

    ipcMain.handle("bloquear-chat", async (_, id_chat) => {
        return await BLOQUEAR_CHAT_USUARIO(id_chat)
    })

    ipcMain.handle("guardar-cache-chat-activo", async (_, data) => {
        crearCacheChatActivo(data)
    })

    ipcMain.handle("obtener-cache-chat-activo", async (_, id, bloque) => {
        return obtenerCacheChatActivo(id, bloque)
    })

    ipcMain.handle("obtener-modelo-datos-necesarios-chat", async () => {
        return modelo_datos_necesarios_chat
    })
}
