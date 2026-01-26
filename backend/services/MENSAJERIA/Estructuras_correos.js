const ValidarCorreoEstructura = ({ apodo = "Usuario", code_generado }) => {
    const asunto = "Verificación de correo"
    const htmlContenido = `<span style="text-decoration:underline">Hola, ${apodo}</span>
    <span style="font-size:20px">Codigo de verificacion de correo:</br><font style="color:green">${code_generado}</font></span>
    <span>Si no has sido tú puedes decírnoslo por este correo.</span>
    <span style="font-style: italic;color=gray">AVISO: Este código caducará en 10minutos, así que te recomendamos que hagas la verificación lo antes posible.</span>
    <span>Mateo's Stage</span>`

    return { asunto: asunto, htmlContenido: htmlContenido }
}
const ConfirmacionCuentaCreadaEstructura = (apodo) => {
    const asunto = "Confirmación de cuenta"
    const htmlContenido = `<span>¡Bienvenido a RAVAGE, ${apodo}!</span>
    <span style="text-decoration:underline">Se ha creado correctamente su cuenta</span>
    <span>Si no has sido tú puedes decírnoslo por este correo.</span>`

    return { asunto: asunto, htmlContenido: htmlContenido }
}

const ValidarCuentaUsuario = (apodo, code) => {
    const asunto = "Verificación de cuenta"
    const htmlContenido = `<div style="border-radius: 1.5rem 3.0rem; background-color: #cffff3; padding: 1rem; display: block; height: 90vh;">
<p><span style="font-size: 1.3rem; font-family: Arial; padding: 1rem;"> Hola, ${apodo}, </span></p>
<div style="font-size: 2em; border-radius: 1.5rem 3.0rem; background-color: #e8e8e8; padding: 1em; box-sizing: border-box; display: grid; width: 100%; text-align: center; font-family: Arial;">Tu código de verificación de cuenta es: <br /> <span id="otp_code" style="color: darkblue; border-radius: 1.5rem 3rem; background-color: lightgreen; padding: 1em; box-sizing: border-box; display: block; width: 100%; text-align: center; margin: 0.7em 0px 0em 0px; font-size: 3rem;"> ${code} </span></div>
<div style="background-color: lightblue; margin: 1em 0px 1em 0em; padding: 0.5em; border-radius: 1.5rem 3rem; width: 100%; box-sizing: border-box; justify-content: center; text-align: center;">
<p style="text-align: center;">Debes usar este código para poder iniciar sesión.</p>
<p style="text-align: center;"><em> Este código caducará en 10 minutos. </em></p>
<span style="text-align: center; display: flex; justify-content: center;"> <span id="warning_respond" style="background-color: pink; margin: 0.3rem 0rem 0.3rem 0rem; padding: 0.5rem; border-radius: 1.5rem 3rem; width: 80%; box-sizing: border-box; text-align: center; display: block;"> Si no has sido tú puedes decírnoslo respondiendo a este correo. </span> </span></div>
<div style="background-color: lightblue; margin: 1em 0px; padding: 0.5rem; border-radius: 1.5rem 3rem; width: 100%; box-sizing: border-box; justify-content: center; text-align: center;"><span style="text-align: center;"> Mateo's Stage </span></div>
</div>`
    return { asunto: asunto, htmlContenido: htmlContenido }
}
const ConfirmacionInicioSesion = () => {
    const asunto = "Alerta de sesión"
    const htmlContenido = `<span>Se ha iniciado sesión con tu cuenta</span>
        <span>Si no has sido tú puedes decírnoslo por este correo.</span>`
    return { asunto: asunto, htmlContenido: htmlContenido }
}
module.exports = {
    ValidarCorreoEstructura,
    ConfirmacionCuentaCreadaEstructura,
    ValidarCuentaUsuario,
    ConfirmacionInicioSesion
}
