const fetch = require('node-fetch');

function generarCodigoVerificacion() {//generar codigo 6 digitos que se utilizara para verificar
    const codigo_verificacion = Math.floor(100000 + Math.random() * 900000)
    return codigo_verificacion
}

async function enviarEmail({ correoDestino = null, asunto = "Sin asunto", htmlContenido = "" }) {
    if (!correoDestino) { throw new Error(`Brevo error: FALTA DESTINATARIO`) }

    const body = {//metadatos del correo
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: "RAVAGE" },
        to: [{ email: correoDestino }],
        subject: asunto,
        htmlContent: htmlContenido
    };
    /*API de Brevo, no puedo usar sin mas un correo gratuito porque se detectaria como spam y los mensjaes no llegarias...
    Para no gastar dinero brevo permite 300 emails al dia y funciona rápido y la dirección de correo que se muestra es una personalizada tuya
    y no la que use la api para mandarlos
    Recuerda: si el usuario recibe muchos correos pueden acabar en spam
    El usuario puede responder al correo sin problemas y te llegan las respuestas a tu correo
    */
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

    console.log("Correo enviado al usuario")
}

module.exports = { enviarEmail, generarCodigoVerificacion }