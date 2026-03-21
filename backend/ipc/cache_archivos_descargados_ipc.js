import { ipcMain } from "../utils/libs.js"
import { getCacheArchivosDescargados, setCacheArchivosDescargados, clearCacheArchivosDescargados ,setLimiteCacheArchivosDescargados} from "../STORAGE/CACHE/_cache_archivos_descargados.js"

export function registerCacheArchivosDescargadosHandlers() {
    ipcMain.handle("get-cache-archivos-descargados", () => {
        return getCacheArchivosDescargados()
    })
    ipcMain.handle("set-cache-archivos-descargados", (_, cache) => {
        return setCacheArchivosDescargados(cache)
    })
    ipcMain.handle("clear-cache-archivos-descargados", () => {
        return clearCacheArchivosDescargados()
    })
    ipcMain.handle("set-limite-cache-archivos-descargados", (_, limite) => {
        return setLimiteCacheArchivosDescargados(limite)
    })
}