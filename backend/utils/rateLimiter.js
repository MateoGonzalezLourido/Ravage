import { createLogger } from './logger.js';
const log = createLogger('rate-limiter-mem');

/**
 * Rate Limiter en memoria para la capa IPC.
 * Controla intentos rápidos en una ventana de tiempo (15 min).
 */
class RequestRateLimiter {
    constructor(limit = 7, windowMs = 15 * 60 * 1000) {
        this.limit = limit;
        this.windowMs = windowMs;
        this.requests = new Map(); // key: machineId_hash -> { count, resetTime }
    }

    /**
     * Comprueba si una petición debe ser bloqueada.
     * @param {string} key Identificador único (id_dp_hash)
     * @returns {Object} { blocked: boolean, remaining: number, resetIn: number }
     */
    check(key) {
        const now = Date.now();
        let record = this.requests.get(key);

        // Si no existe o la ventana expiró, resetear
        if (!record || now > record.resetTime) {
            record = { count: 0, resetTime: now + this.windowMs };
            this.requests.set(key, record);
        }

        const blocked = record.count >= this.limit;
        const resetIn = Math.max(0, record.resetTime - now);

        return {
            blocked,
            count: record.count,
            limit: this.limit,
            resetIn
        };
    }

    /**
     * Registra un intento fallido o una petición procesada.
     * @param {string} key 
     */
    record(key) {
        const record = this.requests.get(key);
        if (record) {
            record.count++;
            log.debug({ key, count: record.count }, "Intento registrado en RateLimiter Memoria");
        }
    }

    /**
     * Resetea los intentos para una llave (ej: tras login exitoso).
     * @param {string} key 
     */
    reset(key) {
        this.requests.delete(key);
    }
}

// Instancia única para Auth (7 intentos / 15 min)
export const authRateLimiter = new RequestRateLimiter(7, 15 * 60 * 1000);
