import { saveCacheArchivosDescargadosFile, readFileSession, getAjustesAppFile, saveAjustesAppFile } from '../services/controladorArchivos.js'

export async function getCacheArchivosDescargados() {
    return await readFileSession('cacheArchivosDescargados') || []
}

export async function setCacheArchivosDescargados(cache = "c") {
    if(cache=="c"){
        await saveCacheArchivosDescargadosFile([])
        return true
    }

    if(typeof cache !== "object" || Object.keys(cache).length === 0){
        return false
    }

    const [limite, cache_actual] = await Promise.all([
        obtenerLimiteCacheArchivosDescargados(),
        getCacheArchivosDescargados()
    ]);

    if(cache_actual.length >= limite){
        cache_actual.shift();
    }

    cache_actual.push(cache);
    await saveCacheArchivosDescargadosFile(cache_actual)
    return true
}

export async function setLimiteCacheArchivosDescargados(limite) {
    if(typeof limite !== "number" || limite < 0){
        return false
    }
    await saveAjustesAppFile({ data: { LIMITE_CACHE_ARCHIVOS_DESCARGADOS: limite }, create: false });
    return true
}

export async function clearCacheArchivosDescargados() {
    await saveCacheArchivosDescargadosFile([]);
}

async function obtenerLimiteCacheArchivosDescargados(){
    return await getAjustesAppFile("LIMITE_CACHE_ARCHIVOS_DESCARGADOS")
}