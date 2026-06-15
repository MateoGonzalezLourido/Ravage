import { ipcMain } from '../utils/libs.js';
import {
    encontrar_usuario,
    obtener_datos_usuario,
    obtener_varios_usuarios,
    añadirUsuariosBloqueados,
    eliminarUsuariosBloqueados,
    añadirUsuariosSilenciados,
    eliminarUsuariosSilenciados,
    AÑADIR_CONTACTO,
    ELIMINAR_CONTACTO,
    OBTENER_HIST_CHATS_CONTACTOS,
    VINCULAR_CHAT_CONTACTO,
    toggleInvisibleUsuario,
    toggleMostrarCorreoUsuario,
    GUARDAR_USUARIOS_EN_PERSISTENTE
} from '../repositories/UserRepository.js';

import {
    getListaContactos,
    getUsuariosBloqueados,
    getUsuariosSilence
} from '../STORAGE/Variables_sesion.js';

export function registerSocialHandlers() {
    ipcMain.handle("encontrar-usuario-externo", async (_, texto, correo = false) => {
        return await encontrar_usuario(texto, correo)
    })

    ipcMain.handle("obtener-datos-usuario-externo", async (_, id, datos) => {
        return await obtener_datos_usuario(id, datos)
    })

    ipcMain.handle("obtener-varios-usuarios-externos", async (_, ids, datos) => {
        return await obtener_varios_usuarios(ids, datos)
    })

    ipcMain.handle("obtener-contactos-usuario", () => {
        return getListaContactos()
    })

    ipcMain.handle("obtener-usuarios-bloqueados", () => {
        return getUsuariosBloqueados()
    })

    ipcMain.handle("obtener-usuarios-silenciados", () => {
        return getUsuariosSilence()
    })

    ipcMain.handle("añadir-usuarios-bloqueados", async (_, id, apodo) => {
        return await añadirUsuariosBloqueados(id, apodo)
    })

    ipcMain.handle("eliminar-usuarios-bloqueados", async (_, id) => {
        return await eliminarUsuariosBloqueados(id)
    })

    ipcMain.handle("añadir-usuarios-silenciados", async (_, id, apodo) => {
        return await añadirUsuariosSilenciados(id, apodo)
    })

    ipcMain.handle("eliminar-usuarios-silenciados", async (_, id) => {
        return await eliminarUsuariosSilenciados(id)
    })

    ipcMain.handle("añadir-contacto", async (_, id, nombre) => {
        return await AÑADIR_CONTACTO(id, nombre)
    })

    ipcMain.handle("eliminar-contacto", async (_, id) => {
        return await ELIMINAR_CONTACTO(id)
    })

    ipcMain.handle("obtener-hist-chats-contactos", async () => {
        return await OBTENER_HIST_CHATS_CONTACTOS()
    })

    ipcMain.handle("vincular-chat-contacto", async (_, contacto_id, chat_id) => {
        return await VINCULAR_CHAT_CONTACTO(contacto_id, chat_id)
    })

    ipcMain.handle("toggle-invisible-usuario", async () => {
        return await toggleInvisibleUsuario()
    })

    ipcMain.handle("toggle-mostrar-correo-usuario", async () => {
        return await toggleMostrarCorreoUsuario()
    })

    ipcMain.handle("guardar-varios-usuarios-externos", async (_, usuarios) => {
        return GUARDAR_USUARIOS_EN_PERSISTENTE(usuarios);
    })
}
