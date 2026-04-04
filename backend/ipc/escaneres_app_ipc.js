import { ipcMain } from "../utils/libs.js"
import {escaneres_seguridad_mensaje_activados, detectSteganography, removeSteganography, detectUrl, removeUrl, detectarUrlMaliciosa, detectarXSS, detectarCodigo, detectarZalgo, removeZalgo, detectarComandosTerminal, detectarCryptoBilleteras, detectarDireccionesIP, detectarHomoglifos } from "../services/seguridad/escanerMensaje.js"
import { obtenerPrevisualizacionUrl } from "../services/previsualizacion_url.js"
import { createLogger } from '../utils/logger.js';
const log = createLogger('escanerMensaje');
export function registerEscaneresAppHandlers() {
    ipcMain.handle("escaneres-seguridad-app-mensaje", async (_, id_chat) => {
        return await escaneres_seguridad_mensaje_activados(id_chat)
    })
    ipcMain.handle("escaneres-seguridad-app-detectar-escenografia", (_, text) => {
        return detectSteganography(text)
    })

    ipcMain.handle("escaneres-seguridad-app-eliminar-escenografia", (_, text) => {
        return removeSteganography(text)
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-url", (_, text) => {
        return detectUrl(text)
    })

    ipcMain.handle("escaneres-seguridad-app-eliminar-url", (_, text) => {
        return removeUrl(text)
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-url-maliciosa", async (_, text) => {
        try {
            return await detectarUrlMaliciosa(text);
        } catch (error) {
            log.error("IPC: Error al validar con Safe Browsing API:", error);
            return { esMaliciosa: false, urlsPeligrosas: [] };
        }
    })

    ipcMain.handle("utilidades-app-previsualizar-url", async (_, text) => {
        return await obtenerPrevisualizacionUrl(text);
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-xss", (_, text) => {
        return detectarXSS(text)
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-codigo", (_, text) => {
        return detectarCodigo(text)
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-zalgo", (_, text) => {
        return detectarZalgo(text)
    })

    ipcMain.handle("escaneres-seguridad-app-eliminar-zalgo", (_, text) => {
        return removeZalgo(text)
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-comandos-terminal", (_, text) => {
        return detectarComandosTerminal(text)
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-crypto-billeteras", (_, text) => {
        return detectarCryptoBilleteras(text)
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-direcciones-ip", (_, text) => {
        return detectarDireccionesIP(text)
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-homoglifos", (_, text) => {
        return detectarHomoglifos(text)
    })
}