const { ipcRenderer } = require('electron');

module.exports = {
    cache_persistente: {

        getUsuarioCache: (id) => ipcRenderer.invoke("get-usuario-cache", id),
        setConfigCacheUsuarios: (config) => ipcRenderer.invoke("set-config-cache-usuarios", config),
        clearCacheUsuarios: () => ipcRenderer.invoke("clear-cache-usuarios"),
        obtenerHistorialBusquedas: () => ipcRenderer.invoke("obtener-historial-busquedas"),
        anadirHistorialBusquedas: (id, datoUsado) => ipcRenderer.invoke("anadir-historial-busquedas", id, datoUsado),
        borrarHistorialBusquedas: (id_o_dato) => ipcRenderer.invoke("borrar-historial-busquedas", id_o_dato),
        limpiarHistorialCompleto: () => ipcRenderer.invoke("limpiar-historial-completo"),
        limpiarVariableCacheHistorial: () => ipcRenderer.invoke("limpiar-variable-cache-historial"),
        cancelarLimpiezaVariableCacheHistorial: () => ipcRenderer.invoke("cancelar-limpieza-variable-cache-historial")
    },
    cache_archivos_descargados: {
        getCacheArchivosDescargados: () => {
            return ipcRenderer.invoke("get-cache-archivos-descargados")
        },
        setCacheArchivosDescargados: (cache) => {
            return ipcRenderer.invoke("set-cache-archivos-descargados", cache)
        },
        setLimiteCacheArchivosDescargados: (limite) => {
            return ipcRenderer.invoke("set-limite-cache-archivos-descargados", limite)
        },
        clearCacheArchivosDescargados: () => {
            return ipcRenderer.invoke("clear-cache-archivos-descargados")
        }
    }
};
