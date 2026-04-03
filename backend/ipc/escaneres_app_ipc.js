import { ipcMain } from "../utils/libs.js"
import { detectSteganography, removeSteganography, detectUrl, removeUrl, detectarUrlMaliciosa } from "../services/seguridad/escanerMensaje.js"
import { obtenerPrevisualizacionUrl } from "../services/previsualizacion_url.js"
import { createLogger } from '../utils/logger.js';
const log = createLogger('escanerMensaje');
export function registerEscaneresAppHandlers() {
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
}