import { ipcMain, dialog } from '../utils/libs.js';
import {
    getListaChats,
    getIDMongodbUsuario
} from '../STORAGE/Variables_sesion.js';
import {
    obtener_datos_chats,
    limpiar_mensajes_chats_antiguos,
    obtener_datos_chat_unico,
    CREAR_CHAT_NUEVO,
    ENVIAR_MENSAJE,
    DESCARGAR_ARCHIVO,
    Revisar_Buzon_Usuario,
    obtener_datos_mensaje,
    expulsar_usuario_chat
} from '../db/mongo.js';
import { getAjustesAppFile, saveAjustesAppFile } from '../services/controladorArchivos.js';
import { iniciarBuzon } from '../services/buzon.js';

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

    ipcMain.handle("crear-chat-nuevo", async (_, ids, nombre, id_chat) => {
        return await CREAR_CHAT_NUEVO(ids, nombre, id_chat)
    })

    ipcMain.handle("obtener-ajustes-app", (_, nombre) => {
        return getAjustesAppFile(nombre)
    })

    ipcMain.handle("guardar-ajustes-app", async (_, data) => {
        return await saveAjustesAppFile({ data })
    })

    ipcMain.handle("enviar-mensaje", async (_, { asunto, archivos, id_chat, id_emisor }) => {
        return await ENVIAR_MENSAJE({ asunto, archivos, id_chat, id_emisor })
    })

    ipcMain.handle("seleccionar-archivos", async () => {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ["openFile", "multiSelections"]
        })
        return filePaths
    })

    ipcMain.handle("descargar-archivo", async (_, id, nombre) => {
        return await DESCARGAR_ARCHIVO(id, nombre)
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
}
