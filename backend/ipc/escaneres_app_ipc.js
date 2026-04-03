import { ipcMain } from "../utils/libs.js"
import { detectSteganography, removeSteganography, detectUrl, removeUrl } from "../services/seguridad/escanerMensaje.js"

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
}