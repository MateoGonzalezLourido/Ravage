import { parentPort } from 'node:worker_threads';
import {
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
} from '../services/seguridad/escanerMensaje.js';

// Mapa unificado de funciones por tipo de tarea
const funciones = {
    'ESCANER_ESTEGANOGRAFIA_DETECTAR': detectSteganography,
    'ESCANER_ESTEGANOGRAFIA_ELIMINAR': removeSteganography,
    'ESCANER_URL_DETECTAR': detectUrl,
    'ESCANER_URL_ELIMINAR': removeUrl,
    'ESCANER_URL_MALICIOSA': detectarUrlMaliciosa,
    'ESCANER_XSS': detectarXSS,
    'ESCANER_CODIGO': detectarCodigo,
    'ESCANER_ZALGO_DETECTAR': detectarZalgo,
    'ESCANER_ZALGO_ELIMINAR': removeZalgo,
    'ESCANER_COMANDOS_TERMINAL': detectarComandosTerminal,
    'ESCANER_CRYPTO_BILLETERAS': detectarCryptoBilleteras,
    'ESCANER_DIRECCIONES_IP': detectarDireccionesIP,
    'ESCANER_HOMOGLIFOS': detectarHomoglifos
};

// Escáneres que aplican sobre texto individual (usados en MULTI y BATCH)
const ESCANERES_ASYNC = [
    'ESCANER_URL_MALICIOSA',
    'ESCANER_XSS',
    'ESCANER_CODIGO',
    'ESCANER_COMANDOS_TERMINAL',
    'ESCANER_CRYPTO_BILLETERAS',
    'ESCANER_DIRECCIONES_IP',
    'ESCANER_HOMOGLIFOS',
];

/**
 * Ejecuta todos los escáneres habilitados sobre un texto.
 * Usa el mapa unificado para evitar duplicar lógica.
 */
async function ejecutar_escaneres(texto, habilitados = {}) {
    const detecciones = {};
    await Promise.all(
        ESCANERES_ASYNC
            .filter(id => habilitados[id] && funciones[id])
            .map(async id => {
                detecciones[id] = await funciones[id](texto);
            })
    );
    return detecciones;
}

parentPort.on('message', async (msg) => {
    const { id, tipo, datos } = msg;

    try {
        if (tipo === 'ESCANER_MULTI_ASYNC') {
            const resultado = await ejecutar_escaneres(
                datos.texto,
                datos.escaneres_habilitados
            );
            parentPort.postMessage({ id, resultado });
            return;
        }

        if (tipo === 'ESCANER_BATCH_MULTI_ASYNC') {
            const { items } = datos;
            const resultado = {
                items: await Promise.all(items.map(async (item) => ({
                    id_mensaje: item.id_mensaje,
                    detecciones: await ejecutar_escaneres(
                        item.texto,
                        item.escaneres_habilitados
                    )
                })))
            };
            parentPort.postMessage({ id, resultado });
            return;
        }

        // Tarea individual
        const func = funciones[tipo];
        if (!func) throw new Error(`Tipo de tarea desconocido: ${tipo}`);

        const resultado = await func(datos.texto);
        parentPort.postMessage({ id, resultado });

    } catch (error) {
        parentPort.postMessage({ id, error: error.message || String(error) });
    }
});