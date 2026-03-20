import { ipcMain, dialog } from '../utils/libs.js';
import {
    getListaChats,
    getIDMongodbUsuario
} from '../STORAGE/Variables_sesion.js';
import { 
    obtener_datos_chats, 
    obtener_datos_chat_unico, 
    CREAR_CHAT_NUEVO,
    expulsar_usuario_chat,
    RESPONDER_SOLICITUD_AÑADIR,
    HACER_ADMIN_CHAT,
    QUITAR_ADMIN_CHAT
} from '../repositories/ChatRepository.js';
import { 
    ENVIAR_MENSAJE, 
    DESCARGAR_ARCHIVO, 
    limpiar_mensajes_chats_antiguos, 
    obtener_datos_mensaje 
} from '../repositories/MessageRepository.js';
import { Revisar_Buzon_Usuario } from '../repositories/BuzonRepository.js';
import { getAjustesAppFile, saveAjustesAppFile } from '../services/controladorArchivos.js';
import { iniciarBuzon } from '../services/buzon.js';
import { comprobar_mensaje, comprobar_nombre_archivo } from '../services/validadores.js';
const authorizedPaths = new Set();

export function registerChatHandlers(mainWindow, socket) {
    ipcMain.handle("obtener-chats-usuario", () => {
        return getListaChats()
    })

    ipcMain.handle("obtener-datos-chats-grupales-usuario", async (_, { data, grupales, mensajes }) => {
        return await obtener_datos_chats({ data, grupales, mensajes })
    })

    ipcMain.handle("obtener-datos-chat-unico-usuario", async (_, id, datos_buscar) => {
        return await obtener_datos_chat_unico(id, datos_buscar)
    })

    ipcMain.on("limpiar-chats-antiguos-mensajes", async (_, chatIds) => {
        await limpiar_mensajes_chats_antiguos(chatIds)
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

    ipcMain.handle("obtener-ajustes-app", async (_, nombre) => {
        return await getAjustesAppFile(nombre)
    })

    ipcMain.handle("guardar-ajustes-app", async (_, data) => {
        return await saveAjustesAppFile({ data })
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
                console.error("Acceso a ruta no autorizada bloqueado:", arc.ruta);
                throw new Error("Unauthorized path access");
            }
        }
        if (asunto && !comprobar_mensaje(asunto).success) {
            throw new Error("Contenido de mensaje no válido");
        }
        return await ENVIAR_MENSAJE({ asunto, archivos, id_chat, id_emisor })
    })

    ipcMain.handle("descargar-archivo", async (_, id, nombre, iv, tag, id_chat) => {
        return await DESCARGAR_ARCHIVO(id, nombre, iv, tag, id_chat)
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
}
