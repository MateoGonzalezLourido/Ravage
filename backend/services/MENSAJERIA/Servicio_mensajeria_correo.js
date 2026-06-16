// Usando fetch nativo de Node.js v18+
import { createLogger } from '../../utils/logger.js';
const log = createLogger('mensajeria');
import { randomInt } from '../../utils/libs.js';
import { getAjustesAppFile } from '../controladorArchivos.js';

async function correoPermitido(clave) {
    const val = await getAjustesAppFile(clave).catch(() => true);
    return val !== false;
}

function generarCodigoVerificacion() {//generar codigo 6 digitos que se utilizara para verificar
    const codigo_verificacion = randomInt(100000, 1000000)
    return codigo_verificacion
}

async function enviarEmail({ correoDestino = null, asunto = "Sin asunto", htmlContenido = "" }) {
    try {
        if (!correoDestino) { throw new Error(`Brevo error: FALTA DESTINATARIO`) }

        const body = {//metadatos del correo
            sender: { email: process.env.BREVO_SENDER_EMAIL, name: "RAVAGE" },
            to: [{ email: correoDestino }],
            subject: asunto,
            htmlContent: htmlContenido
        };

        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "api-key": process.env.BREVO_API_KEY,
                "Content-Type": "application/json",
                accept: "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {//si falla la api
            const errorData = await res.json();
            throw new Error(`Brevo error: ${errorData.message || res.statusText}`);
        }

        log.info("Correo enviado al usuario");
    } catch (e) {
        log.error({ err: e }, "Error al enviar el correo");
        // No relanzamos el error porque el usuario especificó que si falla no afecta al código ni app
    }
}

export { enviarEmail, generarCodigoVerificacion, correoPermitido };