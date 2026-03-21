import { ipcMain } from "../utils/libs.js"
import { getCacheUrlImgExtensiones, setCacheUrlImgExtensiones, clearCacheUrlImgExtensiones ,setLimiteCacheUrlImgExtensiones} from "../STORAGE/CACHE/_cache_img_extensiones.js"

export function registerCacheImgExtensionesHandlers() {
    ipcMain.handle("get-cache-url-img-extensiones", () => {
        return getCacheUrlImgExtensiones()
    })
    ipcMain.handle("set-cache-url-img-extensiones", (_, cache) => {
        return setCacheUrlImgExtensiones(cache)
    })
    ipcMain.handle("clear-cache-url-img-extensiones", () => {
        return clearCacheUrlImgExtensiones()
    })
    ipcMain.handle("set-limite-cache-url-img-extensiones", (_, limite) => {
        return setLimiteCacheUrlImgExtensiones(limite)
    })
}