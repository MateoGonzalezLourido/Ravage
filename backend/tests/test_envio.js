
import 'dotenv/config';
import { enviarEmail } from '../services/MENSAJERIA/Servicio_mensajeria_correo.js';
import * as estructuras from '../services/MENSAJERIA/Estructuras_correos.js';

const DESTINO = [EMAIL_ADDRESS]
const CODIGO = '123456';
const APODO = 'Mateo';

async function testEmails() {
    process.env.BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'no-reply@ravage.app';

    console.log(`🚀 Iniciando envío de correos de prueba a: ${DESTINO}`);

    const tests = [
        { name: 'Verificación de correo', fn: structures => structures.ValidarCorreoEstructura({ apodo: APODO, code: CODIGO }) },
        { name: 'Verificación de cuenta', fn: structures => structures.ValidarCuentaUsuario({ apodo: APODO, code: CODIGO }) },
        { name: 'Alerta de sesión', fn: structures => structures.ConfirmacionInicioSesion() },
        { name: 'Bienvenida', fn: structures => structures.ConfirmacionCuentaCreadaEstructura({ apodo: APODO }) }
    ];

    for (const test of tests) {
        console.log(`--- Enviando: ${test.name} ---`);
        const data = test.fn(estructuras);
        await enviarEmail({
            correoDestino: DESTINO,
            asunto: `[TEST] ${data.asunto}`,
            htmlContenido: data.htmlContenido
        });
    }

    console.log('✅ Pruebas finalizadas. Revisa tu bandeja de entrada.');
}

testEmails().catch(console.error);
