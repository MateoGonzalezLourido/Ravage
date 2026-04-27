import { createLogger } from '../utils/logger.js';
import { ElectronNotification } from '../utils/libs.js';
const log = createLogger('noti-os');

/**
 * Comprueba si las notificaciones nativas están soportadas en este sistema.
 */
function notificacionesSoportadas() {
    try {
        return typeof ElectronNotification?.isSupported === 'function' && ElectronNotification.isSupported();
    } catch {
        return false;
    }
}

/**
 * Envía una notificación nativa del sistema operativo.
 * @param {string} titulo
 * @param {string} cuerpo
 * @param {Function} [onClick]
 */
export function enviarNotificacionOS(titulo, cuerpo, onClick) {
    if (!notificacionesSoportadas()) {
        log.warn('Notificaciones OS no soportadas en este sistema');
        return;
    }
    try {
        const notif = new ElectronNotification({ title: titulo, body: cuerpo, silent: false });
        if (typeof onClick === 'function') {
            notif.on('click', onClick);
        }
        notif.show();
        log.debug({ titulo, cuerpo }, 'Notificación OS enviada');
    } catch (err) {
        log.error({ err }, 'Error al enviar notificación OS');
    }
}

/**
 * Decide si debe mostrarse una notificación OS según:
 *  - tipo de entrada del buzón
 *  - ajustes del usuario
 *  - si la ventana está visible y tiene foco (si la tiene, no hace falta notificar)
 *
 * @param {object} params
 * @param {object} params.entrada       - Entrada del buzón ya procesada y descifrada
 * @param {object} params.ajustes       - Objeto de ajustes de la app (de getAjustesAppFile)
 * @param {object} params.mainWindow    - Instancia BrowserWindow
 * @param {Function} params.onClickCb   - Callback al hacer clic (normalmente restaurar ventana)
 */
export function procesarNotificacionOSEntrada({ entrada, ajustes, mainWindow, onClickCb }) {
    // Solo notificar si la ventana está oculta o sin foco
    try {
        const ventanaFocused = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && mainWindow.isFocused();
        if (ventanaFocused) return;
    } catch {
        return;
    }

    // Si la entrada está silenciada en el buzón, no molestamos al OS tampoco
    if (entrada.silenciado) return;

    const tp = Number(entrada.tipo);
    const data = entrada.data || {};

    // ── TIPO 0: Mensaje de chat ───────────────────────────────────────────────
    if (tp === 0) {
        const esGrupal = data.esGrupal || false;
        const clave = esGrupal ? 'NOTI_OS_MENSAJE_GRUPAL' : 'NOTI_OS_MENSAJE_INDIVIDUAL';
        if (!ajustes[clave]) return;

        const nombreRemitente = data.apodo_emisor || data.emisor || 'Alguien';
        const nombreChat = data.nombre_chat || (esGrupal ? 'Grupo' : null);
        const titulo = nombreChat ? `${nombreRemitente} — ${nombreChat}` : nombreRemitente;
        const cuerpo  = data.preview || data.asunto || 'Nuevo mensaje';
        enviarNotificacionOS(titulo, cuerpo, onClickCb);
        return;
    }

    // ── TIPO 1/3: Unirse / añadido a grupo ───────────────────────────────────
    if (tp === 1 || tp === 3) {
        if (!ajustes.NOTI_OS_MENSAJE_GRUPAL) return;
        const accion = tp === 1 ? 'Te has unido a un grupo' : 'Te han añadido a un grupo';
        const nombreChat = data.nombre_chat || '';
        enviarNotificacionOS('Ravage', nombreChat ? `${accion}: ${nombreChat}` : accion, onClickCb);
        return;
    }

    // ── TIPO 4: Expulsión ─────────────────────────────────────────────────────
    if (tp === 4) {
        if (!ajustes.NOTI_OS_MENSAJE_GRUPAL) return;
        const nombreChat = data.nombre_chat || '';
        enviarNotificacionOS('Ravage', nombreChat ? `Has sido expulsado de: ${nombreChat}` : 'Has sido expulsado de un grupo', onClickCb);
        return;
    }
    // tipo 2 (crear grupo): notificación menor, no se envía al OS
}
