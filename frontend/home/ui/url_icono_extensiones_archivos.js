/*Aqui se guarda la api de las url de los iconos de las extensiones de archivos->

Se guarda en cache para no tener que hacer peticiones cada vez que se quiera usar.

Las imagenes estan en el proyecto (frontend/recursos/extensionesArchivos), es necesario donde se guarden un .json con la extension y la url de la imagen.

La api funciona pasandole la extension del archivo(con . o sin) y esta te devuelve [url donde se guarde el icono y si existe un icono para esa extension]

Si no existe icono para esa extension la url sera la de "cualquiera.svg"(icono por defecto) y identificado sera false.

Esta cache esta optimizada para remplazar las ultimas entradas, es decir, las extensiones mas usadas deberan ir en el .json al principio, lo que aumenta la probabilidad de que no se remplacen.
*/

// Variables principales compartidas
const carpetaPrincipal = '../recursos/extensionesArchivos';
const archivoJSON = 'img_extensiones.json';
const img_defecto = "cualquiera.svg"

//ajustes cache
const LIMITE_RAM_MB = 256//TODO: obtenerlo de ajustes usuario backend
const TIEMPO_EXPIRACION = 10 * 60 * 1000 // 10 minutos //TODO: obtenerlo de ajustes usuario backend
// Cache local al módulo para evitar IPC/Fetch innecesarios
let _cache_local_iconos = null;
let timer_limpieza = null

/**
 *@description Obtener la url del icono de una extension de archivo
 *@param {string} extension - Extension del archivo
 *@returns {Array<string, boolean>}
 */
export async function url_icono_extension_img(extension) {
    if (!extension || extension === "" || typeof extension !== "string") {
        return [`${carpetaPrincipal}/${img_defecto}`, false];
    }
    const extension_usar = (extension[0] === '.' ? extension.slice(1) : extension).toLowerCase();

    // 1. Intentar usar cache local del módulo (el más rápido)
    if (_cache_local_iconos && _cache_local_iconos[extension_usar]) {
        return [`${carpetaPrincipal}/${_cache_local_iconos[extension_usar]}`, true];
    }


    if (_cache_local_iconos && _cache_local_iconos[extension_usar]) {
        return [`${carpetaPrincipal}/${_cache_local_iconos[extension_usar]}`, true];
    }

    // 3. Si no está en cache, cargar el JSON (vía Fetch)
    const data = await getDataImgExtensiones();

    const img_usar = data[extension_usar] || img_defecto;
    const identificado = img_usar !== img_defecto;

    // Guardar en cache persistente si se encontró algo nuevo
    setCacheUrlImgExtensiones({ [extension_usar]: img_usar });

    return [`${carpetaPrincipal}/${img_usar}`, identificado];
}

/*
*@description Obtener datos del archivo de imagenes mediante fetch y crear cache (solo se ejecuta si no existe cache)
*@returns {Object}
*/
async function getDataImgExtensiones() {
    try {
        const res = await fetch(`${carpetaPrincipal}/${archivoJSON}`);
        if (!res.ok) throw new Error("Status " + res.status);
        const data = await res.json();

        setCacheUrlImgExtensiones(data);
        return data;
    } catch (err) {
        console.error("Error al cargar img_extensiones.json:", err);
        return {};
    }
}

/*
*@description Guardar datos en cache inteligentemente
*@param {Object} cache - Datos a guardar en cache
*@returns {Promise<boolean>}
*/
async function setCacheUrlImgExtensiones(cache = "c") {
    // reseteat cache
    if (cache === "c" || cache == {}) {
        _cache_local_iconos = null;
        return true;
    }

    // validación
    if (!cache || typeof cache !== "object" || Object.keys(cache).length === 0) {
        return false;
    }

    const limite = LIMITE_RAM_MB;

    if (!_cache_local_iconos) _cache_local_iconos = {};

    const actuales = Object.entries(_cache_local_iconos);
    const nuevas = Object.entries(cache);

    const espacioDisponible = limite - actuales.length;

    if (nuevas.length >= limite) {
        _cache_local_iconos = Object.fromEntries(nuevas.slice(-limite));
    } else if (espacioDisponible < nuevas.length) {
        const mantener = actuales.slice(nuevas.length - espacioDisponible);
        _cache_local_iconos = Object.fromEntries([
            ...mantener,
            ...nuevas
        ]);
    } else {
        // si hay espacio → añadir directamente
        Object.assign(_cache_local_iconos, cache);
    }

    // Aplicar límite de RAM de 256MB (igual que historial de archivos descargados)
    while (_estimar_tamano_cache_mb(_cache_local_iconos) > LIMITE_RAM_MB && Object.keys(_cache_local_iconos).length > 0) {
        const keys = Object.keys(_cache_local_iconos)
        delete _cache_local_iconos[keys[0]]
    }

    resetearTimerLimpieza()
    return true
}
/*
*@description Estimar tamaño de cache en mb
*@param {Object} data - Datos a estimar tamaño
*@returns {number}
*/
function _estimar_tamano_cache_mb(data) {
    if (!data) return 0
    try {
        // En Node.js (backend), Buffer.byteLength es más eficiente que TextEncoder
        const bytes = Buffer.byteLength(JSON.stringify(data))
        return bytes / (1024 * 1024)
    } catch (e) {
        return 0
    }
}
/*
*@description Obtener cache de url de imagenes de extensiones
*@returns {Object}
*/
async function getCacheUrlImgExtensiones() {
    resetearTimerLimpieza()
    /*si esta vacio devolver siempre null */
    return _cache_local_iconos
}
/*
*@description Resetear timer de limpieza
*/
function resetearTimerLimpieza() {
    if (timer_limpieza) clearTimeout(timer_limpieza)
    timer_limpieza = setTimeout(() => {
        _cache_local_iconos = null
        timer_limpieza = null
    }, TIEMPO_EXPIRACION)
}

/**
 * Limpia la cache de iconos inmediatamente para liberar RAM.
 */
export function limpiar_cache_iconos() {
    _cache_local_iconos = null;
    if (timer_limpieza) {
        clearTimeout(timer_limpieza);
        timer_limpieza = null;
    }
    console.debug("[Cleanup RAM] Cache de iconos de extensiones liberada.");
}
