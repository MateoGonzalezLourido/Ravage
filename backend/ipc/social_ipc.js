import { ipcMain } from '../utils/libs.js';
import {
    encontrar_usuario,
    obtener_datos_usuario,
    añadirUsuariosBloqueados,
    eliminarUsuariosBloqueados,
    añadirUsuariosSilenciados,
    eliminarUsuariosSilenciados
} from '../db/mongo.js';
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
}
