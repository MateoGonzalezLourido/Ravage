
const fetch = require("node-fetch") // o axios
const dotenv = require("dotenv");
dotenv.config()

async function generarCodigo() {//expira en 10min
    const codigo_verificacion = Math.floor(100000 + Math.random() * 900000).toString()
    return codigo_verificacion
}

function validarCodigo(correo, codigoIngresado) {
    const data = codigosTemporales.get(correo);
    if (!data) return false;
    if (data.expira < Date.now()) {
        codigosTemporales.delete(correo);
        return false;
    }
    return data.codigo === codigoIngresado;
}
/*codigo en otros archivos al validar 

    if (!validarCodigo(correo, codigoIngresado)) {
        return { success: false, message: "Código incorrecto o expirado" };
    }
*/

async function enviarEmail({ correoDestino = null, asunto = "Sin asunto", htmlContenido = "" }) {
    if (!correoDestino) throw new Error(`Brevo error: FALTA DESTINATARIO`);
    const API_KEY = process.env.BREVO_API_KEY; // tu key v3

    const body = {
        sender: { email: process.env.BREVO_SENDER_EMAIL, name: "RAVAGE" },
        to: [{ email: correoDestino }],
        subject: asunto,
        htmlContent: htmlContenido
    };

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "api-key": API_KEY,
            "Content-Type": "application/json",
            accept: "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Brevo error: ${errorData.message}`);
    }

    // return await res.json(); // contiene messageId
}

module.exports = { enviarEmail, generarCodigo, validarCodigo }