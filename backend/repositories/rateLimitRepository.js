import { RateLimitAudit, AppBlockedDevices } from '../models/Security.js';
import { createLogger } from '../utils/logger.js';
const log = createLogger('rate-limit-repo');

/**
 * Verifica si un dispositivo está bloqueado permanentemente de la aplicación.
 * @param {string} id_dp_hash 
 * @returns {Promise<boolean>}
 */
export async function estaDispositivoBloqueadoApp(id_dp_hash) {
    try {
        const bloqueado = await AppBlockedDevices.findOne({ id_dp_hash }).lean();
        return !!bloqueado;
    } catch (e) {
        log.error({ err: e, id_dp_hash }, "Error al verificar bloqueo persistente de dispositivo");
        return false;
    }
}

/**
 * Registra que un dispositivo ha superado el rate limit de memoria.
 * Si supera 5 infracciones en el mismo día, se bloquea permanentemente.
 * @param {string} id_dp_hash 
 * @returns {Promise<Object>} { totalInfraccionesHoy, bloqueadoAhora: boolean }
 */
export async function registrarInfraccionPersistent(id_dp_hash) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    try {
        // 1. Incrementar contador diario (Upsert)
        const audit = await RateLimitAudit.findOneAndUpdate(
            { id_dp_hash, fecha: hoy },
            { $inc: { intentos: 1 } },
            { upsert: true, new: true }
        );

        log.warn({ id_dp_hash, infracciones: audit.intentos }, "Infracción de RateLimit persistida en DB");

        // 2. Si llega a 5, bloquear de por vida
        if (audit.intentos >= 5) {
            log.fatal({ id_dp_hash }, "DISPOSITIVO BLOQUEADO PERMANENTEMENTE - Exceso de infracciones diarias");
            
            await AppBlockedDevices.findOneAndUpdate(
                { id_dp_hash },
                { 
                    $setOnInsert: { 
                        razon: "Exceso de intentos de seguridad (5 infracciones detectadas en un día)",
                        fecha_bloqueo: new Date()
                    }
                },
                { upsert: true }
            );
            return { totalInfraccionesHoy: audit.intentos, bloqueadoAhora: true };
        }

        return { totalInfraccionesHoy: audit.intentos, bloqueadoAhora: false };
    } catch (e) {
        log.error({ err: e, id_dp_hash }, "Error al procesar registro de infracción de RateLimit");
        return { totalInfraccionesHoy: 0, bloqueadoAhora: false };
    }
}
