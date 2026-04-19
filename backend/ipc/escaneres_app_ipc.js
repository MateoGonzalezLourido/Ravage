import { ipcMain } from "../utils/libs.js"
import { escaneres_seguridad_mensaje_activados } from "../services/seguridad/escanerMensaje.js"
import { obtenerPrevisualizacionUrl } from "../services/previsualizacion_url.js"
import { createLogger } from '../utils/logger.js';
import { getEscanerPool } from '../utils/workerPool.js';

const log = createLogger('escanerMensaje');
export function registerEscaneresAppHandlers() {
    ipcMain.handle("escaneres-seguridad-app-mensaje", async (_, id_chat) => {
        return await escaneres_seguridad_mensaje_activados(id_chat)
    })
    ipcMain.handle("escaneres-seguridad-app-detectar-escenografia", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_ESTEGANOGRAFIA_DETECTAR', { texto: text })
    })

    ipcMain.handle("escaneres-seguridad-app-eliminar-escenografia", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_ESTEGANOGRAFIA_ELIMINAR', { texto: text })
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-url", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_URL_DETECTAR', { texto: text })
    })

    ipcMain.handle("escaneres-seguridad-app-eliminar-url", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_URL_ELIMINAR', { texto: text })
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-url-maliciosa", async (_, text) => {
        try {
            return await getEscanerPool().ejecutar('ESCANER_URL_MALICIOSA', { texto: text });
        } catch (error) {
            log.error("IPC: Error al validar con Safe Browsing API:", error);
            return { esMaliciosa: false, urlsPeligrosas: [] };
        }
    })

    ipcMain.handle("utilidades-app-previsualizar-url", async (_, text) => {
        return await obtenerPrevisualizacionUrl(text);
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-xss", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_XSS', { texto: text })
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-codigo", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_CODIGO', { texto: text })
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-zalgo", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_ZALGO_DETECTAR', { texto: text })
    })

    ipcMain.handle("escaneres-seguridad-app-eliminar-zalgo", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_ZALGO_ELIMINAR', { texto: text })
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-comandos-terminal", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_COMANDOS_TERMINAL', { texto: text })
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-crypto-billeteras", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_CRYPTO_BILLETERAS', { texto: text })
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-direcciones-ip", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_DIRECCIONES_IP', { texto: text })
    })

    ipcMain.handle("escaneres-seguridad-app-detectar-homoglifos", (_, text) => {
        return getEscanerPool().ejecutar('ESCANER_HOMOGLIFOS', { texto: text })
    })

    // Handler para procesar lotes de escáneres asíncronos en paralelo
    ipcMain.handle("escaneres-seguridad-app-detectar-lote", async (_, items) => {
    try {
        const resultados = await getEscanerPool().ejecutarBatch('ESCANER_BATCH_MULTI_ASYNC', items);
        return resultados;
    } catch (error) {
        log.error("Error procesando lote de escáneres:", error);
        // Devolver array de nulls del mismo tamaño para que el frontend procese lo que pueda
        return items.map(item => ({ id_mensaje: item.id_mensaje, detecciones: null }));
    }
});
}