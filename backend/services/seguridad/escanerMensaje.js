/*AQUI SE IMPLEMENTAN TODAS LAS PROTECCIONES PARA LOS MENSAJES
Este actua en el frontend revisando los mensajes antes de ser enviados y cuando se renderizan
avisando al usuario de que puede ser inseguro copiar ese mensaje

En el backend lo que hace es bloquear mandar el mensaje si detecta algo peligroso
*/
import { createLogger } from '../../utils/logger.js';
const log = createLogger('escanerMensaje');

import { getAjustesAppFile } from '../controladorArchivos.js';
import { getListaChats } from '../../STORAGE/Variables_sesion.js'
import { obtenerCacheChatActivo, crearCacheChatActivo } from '../../STORAGE/CACHE/_cache_chat_activo.js'
import { obtener_datos_chat_unico } from '../../repositories/ChatRepository.js'
async function escaneres_seguridad_mensaje_activados(id_chat = null) {
    //conseguir ajustes por defecto
    let escaneres_seguridad = await getAjustesAppFile([
        'ESCANER_ESTEGANOGRAFIA', 'ESCANER_URL', 'ESCANER_URL_MALICIOSA', 'ESCANER_XSS',
        'ESCANER_CODIGO', 'ESCANER_ZALGO', 'ESCANER_COMANDOS_TERMINAL', 'ESCANER_CRYPTO_BILLETERAS',
        'ESCANER_DIRECCIONES_IP', 'ESCANER_HOMOGLIFOS'
    ]);
    //obtener ajustes propios del chat globales en db
    let ajustes_chat_globales = obtenerCacheChatActivo("seguridad")

    if (!ajustes_chat_globales && id_chat) {
        // cargar a db y guardar en cache
        const chatDB = await obtener_datos_chat_unico(id_chat, 'escaneres_seguridad');
        if (chatDB && chatDB.escaneres_seguridad) {
            ajustes_chat_globales = chatDB.escaneres_seguridad;
            crearCacheChatActivo(ajustes_chat_globales);
        }
    }
    //obtener datos del chat
    const lista_chats = getListaChats()
    const chat = lista_chats.find(c => c.id === id_chat)
    if (chat && chat.escaneres_seguridad) {
        for (const key in chat.escaneres_seguridad) {
            if (chat.escaneres_seguridad[key] !== null && key in escaneres_seguridad) {
                escaneres_seguridad[key] = chat.escaneres_seguridad[key];
            }
        }
    }

    //pasar ajustes de usaurio y del chat
    return { escaneres_seguridad, ajustes_chat_globales };
}

// --- 1. DETECCION DE ESTEGANOGRAFIA Y CARACTERES INVISIBLES ---
const STEGO_PATTERNS = {
    zwc: /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u{E0000}-\u{E007F}]/u,
    softHyphen: /\u00AD/,
    fullWidth: /[\uFF01-\uFF60]/,   // letras y símbolos full-width
    homoglyph: /[\u0400-\u04FF\u0370-\u03FF]/,  // cirílico y griego mezclados con latín
};

function detectSteganography(text) {
    if (typeof text !== 'string') return false;
    const results = {};
    for (const [name, re] of Object.entries(STEGO_PATTERNS)) {
        results[name] = re.test(text);
    }
    return Object.values(results).some(Boolean);
}
//eliminar caracteres peligrosos
function removeSteganography(text) {
    if (typeof text !== 'string') return { text: '', cambios: false };
    
    // Combinamos todos los patrones de STEGO_PATTERNS en una sola expresión regular global
    const allPatterns = Object.values(STEGO_PATTERNS).map(re => re.source).join('|');
    const stegoRegex = new RegExp(allPatterns, 'gu');
    
    const nuevo = text.replace(stegoRegex, '');
    
    // IMPORTANTE: Devolvemos 'text' (en lugar de 'texto') para que el frontend coincida
    // y no muestre 'undefined' en los mensajes.
    return { text: nuevo, cambios: nuevo.length !== text.length };
}

// --- 2. DETECCION DE ENLACES (URLs) ---
const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
function detectUrl(text) {
    if (!text) return false;
    const regexLocal = new RegExp(urlRegex.source, urlRegex.flags.replace('g', ''));
    return regexLocal.test(text);
}
//eliminar enlaces
function removeUrl(text) {
    return text.replace(urlRegex, '');
}

// Escáner asíncrono con Google Safe Browsing
async function detectarUrlMaliciosa(text) {
    const urls = text.match(urlRegex);
    if (!urls || urls.length === 0) {
        return { esMaliciosa: false, urlsPeligrosas: [] };
    }

    const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
    if (!apiKey) {
        log.error('Sin API Key');
        return { esMaliciosa: false, urlsPeligrosas: [] };
    }

    try {
        const payload = {
            client: {
                clientId: "ravage-app",
                clientVersion: "1.0.0"
            },
            threatInfo: {
                threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                platformTypes: ["ANY_PLATFORM"],
                threatEntryTypes: ["URL"],
                threatEntries: urls.map(url => ({ url }))
            }
        };

        const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            log.error("Error al validar con Safe Browsing API:", response);
            return { esMaliciosa: false, urlsPeligrosas: [] };
        }

        const data = await response.json();
        if (data && data.matches && data.matches.length > 0) {
            const maliciosas = data.matches.map(match => match.threat.url);
            return { esMaliciosa: true, urlsPeligrosas: maliciosas };
        }

        return { esMaliciosa: false, urlsPeligrosas: [] };
    } catch (error) {
        log.error("Error al validar con Safe Browsing API:", error);
        return { esMaliciosa: false, urlsPeligrosas: [] };
    }
}

// --- 3. DETECCION DE CODIGO FUENTE MALICIOSO Y XSS ---
// Detecta etiquetas de script, iframes, handlers de eventos (onload, onclick), esquemas javascript: y data:
const xssRegex = /<\s*(script|iframe|object|embed|applet|form|style|base|meta|link)[^>]*>|javascript:|vbscript:|on\w+\s*=|data:text\/html/i;
function detectarXSS(text) {
    return xssRegex.test(text);
}

// Detecta patrones comunes de lenguajes de programacion (JS, PHP, Python) y SQL/NoSQL Injection basicos
const codeRegex = /(?:function\s+\w*[\(]?|=>\s*{|import\s+.*?\s+from|const\s+.*?=\s*|var\s+.*?=\s*|let\s+.*?=\s*|console\.[a-z]+\(|document\.[a-z]+\(|SELECT\s+.*?\s+FROM|INSERT\s+INTO|UPDATE\s+.*?\s+SET|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE|{\s*\$where\s*:|{\s*\$ne\s*:)/i;
function detectarCodigo(text) {
    return codeRegex.test(text);
}

// --- 4. DETECCION DE TEXTO ZALGO (Sobrecarga de caracteres combinados) ---
// Detecta 3 o mas caracteres combinados diacriticos (suele usarse para romper interfaces o entorpecer los chats)
const zalgoRegex = /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]{3,}/g;
function detectarZalgo(text) {
    if (!text) return false;
    const regexLocal = new RegExp(zalgoRegex.source, zalgoRegex.flags.replace('g', ''));
    return regexLocal.test(text);
}
function removeZalgo(text) {
    const logitudOriginal = text.length;
    const nuevo = text.replace(zalgoRegex, '');
    return { texto: nuevo, cambios: nuevo.length !== logitudOriginal };
}

// --- 5. DETECCION DE COMANDOS DE TERMINAL PELIGROSOS ---
// Prevencion de comandos shell comunes (en caso de que el usuario intente engañar a otro para ejecutarlos)
const terminalCommandRegex = /\b(?:sudo\s|rm\s+-rf|wget\s|curl\s|chmod\s|chown\s|bash\s+-c|sh\s+-c|powershell\s|cmd\.exe|format\s+[a-z]:)/i;
function detectarComandosTerminal(text) {
    return terminalCommandRegex.test(text);
}

// --- 6. DETECCION DE BILLETERAS DE CRIPTOMONEDAS ---
// Detecta BTC (P2PKH, P2SH, Bech32) y ETH (0x...), muy comunes en intentos de scam/phishing
const cryptoRegex = /\b(?:1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{39,59}|0x[a-fA-F0-9]{40})\b/g;
function detectarCryptoBilleteras(text) {
    if (!text) return false;
    const regexLocal = new RegExp(cryptoRegex.source, cryptoRegex.flags.replace('g', ''));
    return regexLocal.test(text);
}

// --- 7. DETECCION DE DIRECCIONES IP (Riesgo de privacidad/Phishing) ---
const ipRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;
function detectarDireccionesIP(text) {
    return ipRegex.test(text);
}

// --- 8. DETECCION DE HOMOGLIFOS (Ataques de suplantacion) ---
// Busca la mezcla de letras latinas con letras cirilicas en la misma palabra
const homoglyphRegex = /\b(?:[a-zA-Z]+[\u0400-\u04FF]+|[\u0400-\u04FF]+[a-zA-Z]+)\b/;
function detectarHomoglifos(text) {
    return homoglyphRegex.test(text);
}

export {
    escaneres_seguridad_mensaje_activados,
    detectSteganography,
    removeSteganography,
    detectUrl,
    removeUrl,
    detectarUrlMaliciosa,
    detectarXSS,
    detectarCodigo,
    detectarZalgo,
    removeZalgo,
    detectarComandosTerminal,
    detectarCryptoBilleteras,
    detectarDireccionesIP,
    detectarHomoglifos
}