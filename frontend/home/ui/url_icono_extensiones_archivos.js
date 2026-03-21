/*Aqui se guarda la api de las url de los iconos de las extensiones de archivos->

Se guarda en cache para no tener que hacer peticiones cada vez que se quiera usar.

Las imagenes estan en el proyecto (frontend/recursos/extensionesArchivos), es necesario donde se guarden un .json con la extension y la url de la imagen.

La api funciona pasandole la extension del archivo(con . o sin) y esta te devuelve [url donde se guarde el icono y si existe un icono para esa extension]

Si no existe icono para esa extension la url sera la de "cualquiera.svg"(icono por defecto) y identificado sera false.

Esta cache esta optimizada para remplazar las ultimas entradas, es decir, las extensiones mas usadas deberan ir en el .json al principio, lo que aumenta la probabilidad de que no se remplacen.
*/

export async function url_icono_extension_img(extension) {
    //variables principales
    const carpetaPrincipal = new URL('../../recursos/extensionesArchivos', import.meta.url).href;
    const archivoJSON = 'img_extensiones.json';
    const img_defecto = "cualquiera.svg"

    //ocasiones que daria problemas o siempre devolveria el icono por defecto
    if (!extension || extension === "" || typeof extension !== "string") return [`${carpetaPrincipal}/${img_defecto}`, false]

    const _cache_img_extensiones  = await window.cache.getCacheUrlImgExtensiones()
    
    let img_usar;
    if (!_cache_img_extensiones) {
        _cache_img_extensiones=await getDataImgExtensiones()
        img_usar = _cache_img_extensiones[extension_usar?.toLowerCase()] || img_defecto

    }
    else{
        img_usar = _cache_img_extensiones[extension_usar?.toLowerCase()] || img_defecto
    if(img_usar===img_defecto)   {
    _cache_img_extensiones=await getDataImgExtensiones()
    }
    img_usar = _cache_img_extensiones[extension_usar?.toLowerCase()] || img_defecto
if(img_usar!==img_defecto)   {
        window.cache.setCacheUrlImgExtensiones({[extension_usar?.toLowerCase()]:img_usar})
    }
 }

    //eliminar . inicial si existe
    const extension_usar = extension[0] === '.' ? extension.replace(".", "") : extension

    //conseguir icono
    const url_img = `${carpetaPrincipal}/${img_usar}`
    const identificado = img_usar !== img_defecto

    return [url_img, identificado]
}

async function getDataImgExtensiones(){
    let _cache_img_extensiones;
    try {
            const res = await fetch(`${carpetaPrincipal}/${archivoJSON}`)
            _cache_img_extensiones = await res.json()
        } catch (err) {
            console.error("Error al cargar img_extensiones.json:", err)
            _cache_img_extensiones={}
        }
        window.cache.setCacheUrlImgExtensiones(_cache_img_extensiones)
        return _cache_img_extensiones
}