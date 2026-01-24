const fetch = require('node-fetch');
const dotenv = require("dotenv");
dotenv.config()

function generarCodigo() {
    const codigo_verificacion = Math.floor(100000 + Math.random() * 900000)
    return codigo_verificacion
}

async function enviarEmail({ correoDestino = null, asunto = "Sin asunto", htmlContenido = "" }) {
    if (!correoDestino) { throw new Error(`Brevo error: FALTA DESTINATARIO`) }

    const body = {
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

    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Brevo error: ${errorData.message || res.statusText}`);
    }

    // return await res.json(); // contiene messageId
}

module.exports = { enviarEmail, generarCodigo }