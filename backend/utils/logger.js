/**
 * Logger estructurado con Pino.
 * 
 * USO:
 *   import { createLogger } from '../utils/logger.js';
 *   const log = createLogger('nombre-modulo');
 * 
 *   log.info('Mensaje simple');
 *   log.info({ userId: '123', chatId: '456' }, 'Mensaje con contexto');
 *   log.error({ err }, 'Algo falló');
 *   log.warn('Advertencia');
 *   log.debug('Solo visible si LOG_LEVEL=debug');
 * 
 * NIVELES (de menor a mayor):
 *   trace → debug → info → warn → error → fatal
 * 
 * En desarrollo: output bonito con colores (pino-pretty)
 * En producción: JSON puro (parseable por herramientas de monitorización)
 */

import pino from 'pino';

const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

// Logger raíz
const rootLogger = pino({
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    
    // En desarrollo usamos pino-pretty para output legible con colores
    // En producción, JSON puro (mejor rendimiento + compatible con Grafana, Datadog, etc.)
    ...(isDev && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
                messageFormat: '[{module}] {msg}',
            }
        }
    }),
});

/**
 * Crea un logger hijo con un nombre de módulo.
 * Todos los mensajes emitidos llevarán el campo "module" automáticamente.
 * 
 * @param {string} moduleName - Nombre del módulo (ej: 'db', 'crypto', 'session', 'chat')
 * @returns {pino.Logger}
 * 
 * @example
 * const log = createLogger('crypto');
 * log.info('Llaves RSA generadas');
 * // Output: [14:30:05] INFO [crypto] Llaves RSA generadas
 * 
 * log.error({ err, chatId: '123' }, 'Fallo en descifrado');
 * // Output: [14:30:05] ERROR [crypto] Fallo en descifrado
 * //   err: { message: '...', stack: '...' }
 * //   chatId: '123'
 */
export function createLogger(moduleName) {
    return rootLogger.child({ module: moduleName });
}

export default rootLogger;
