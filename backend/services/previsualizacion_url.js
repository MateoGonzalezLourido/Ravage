import { createLogger } from '../utils/logger.js';
const log = createLogger('previsualizacionURL');

export async function obtenerPrevisualizacionUrl(targetUrl) {
    if (!targetUrl) return null;

    try {
        // Hacemos fetch a la URL usando AbortController para que no se quede colgado
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 segundos de límite

        // Ponemos un User-Agent de un navegador moderno porque algunos sitios bloquean bots de node
        const response = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;
        
        // Verificamos que sea HTML para no descargar archivos gigantes por error
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("text/html")) {
            return null;
        }

        // Leer el HTML como texto. En casos optimizados podríamos leer solo los primeros KB,
        // pero text() es seguro para uso moderado.
        const html = await response.text();

        // Extraer etiquetas con regex (mucho más rápido y ligero que cheerio/jsdom)
        // 1. Título (Prioriza Open Graph og:title, y si no cae al <title> normal)
        const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["'][^>]*>|<title[^>]*>(.*?)<\/title>/i);
        
        // 2. Descripción (Prioriza og:description, si no la meta description)
        const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["'][^>]*>|<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["'][^>]*>/i);
        
        // 3. Imagen (og:image)
        const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["'](.*?)["'][^>]*>/i);

        let title = '';
        if (titleMatch) title = titleMatch[1] || titleMatch[2] || '';

        let description = '';
        if (descMatch) description = descMatch[1] || descMatch[2] || '';

        let image = '';
        if (imgMatch) {
            image = imgMatch[1] || '';
            // Validamos que sea una URL de imagen válida y la hacemos absoluta si es relativa
            if (image.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                image = `${urlObj.protocol}//${urlObj.host}${image}`;
            }
        }

        // Si la página no tiene un título básico como mínimo, asumimos que no es previsualizable
        if (!title && !image) return null;

        // Limpieza básica de HTML entities (ej. &quot; => ")
        const cleanEntity = (str) => {
            return str
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'");
        };

        return {
            titulo: cleanEntity(title.trim()),
            descripcion: cleanEntity(description.trim()),
            imagen: image,
            urlActiva: targetUrl
        };

    } catch (error) {
        if (error.name !== 'AbortError') {
            log.error(`Previsualización falló en URL ${targetUrl}:`, error.message);
        }
        return null;
    }
}

/**
 * =========================================================
 * EJEMPLO DE USO Y RENDERIZADO EN EL FRONTEND:
 * =========================================================
 * 
 * En el frontend, tras recibir la URL:
 * const p = await window.utilidades_app.obtener_previsualizacion_url("https://github.com");
 * 
 * Si `p` no es nulo, puedes crear y mapear cada dato de la siguiente manera
 * para construir un componente tipo tarjeta (Link Preview):
 * 
 * <!-- Estructura HTML sugerida -->
 * <a href="${p.urlActiva}" class="url-preview-card" target="_blank" rel="noopener noreferrer">
 * 
 *    <!-- PORTADA DE LA PÁGINA (Si existe) -->
 *    ${p.imagen ? `<img src="${p.imagen}" class="url-preview-img" alt="Vista previa">` : ''}
 * 
 *    <div class="url-preview-contenido">
 *       <!-- TÍTULO PRINCIPAL DE LA PÁGINA -->
 *       <strong class="url-preview-titulo">${p.titulo}</strong>
 *       
 *       <!-- DESCRIPCIÓN (Resumen) DE LA PÁGINA -->
 *       <p class="url-preview-desc">${p.descripcion}</p>
 *       
 *       <!-- DOMINIO LIMPIO DE LA URL COMO REFERENCIA (ej. github.com) -->
 *       <small class="url-preview-dominio">${new URL(p.urlActiva).hostname}</small>
 *    </div>
 *    
 * </a>
 * 
 * (También recuerda darles estilos CSS para que luzca como discord/telegram limitando el texto con `text-overflow: ellipsis`)
 */
