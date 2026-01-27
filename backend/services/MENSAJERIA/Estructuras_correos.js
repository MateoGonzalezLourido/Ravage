const ValidarCorreoEstructura = ({ apodo = "Usuario", code }) => {
    const asunto = "Verificación de correo"
    const htmlContenido = `<!DOCTYPE html>
    <html>
    <style>
    .flowbox {
        border-radius: 1.5rem 3.0rem; 
        padding: 1rem;
        display: block;
    }
    </style>
    <body>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <div class="flowbox" style="background-color: #cffff3; padding: 1rem; display: block; min-height: fit-content;">
        <p>
            <span style="font-size: 1.3rem; font-family: Arial; padding: 0.8rem;"> Hola, ${apodo}. (●'◡'●)</span>
        </p>
        <div class="flowbox" style="font-size: 1.45em; background-color: #e8e8e8; padding: 0.8em 0.4em; box-sizing: border-box; display: block; width: 100%; text-align: center; font-family: Arial; height: fit-content">Tu código de para iniciar sesión es: 
            <br /><div style="display:flex; width:100%; justify-content:center;">
            <span id="otp_code" class="flowbox" style="color: black; background-color: #c890ed; padding: 0.6em; box-sizing: border-box; display: block; width: 100%; text-align: center; margin: 0.55em 0px 0em 0px; font-size: 2.5rem; width:80%; min-width: fit-content;user-select: all;">${code}</span>
        </div></div>
        <div class="flowbox" style="background-color: lightblue; margin: 1em 0px 1em 0em; padding: 0.5em; border-radius: 1.5rem 3rem; width: 100%; box-sizing: border-box; justify-content: center; text-align: center;">
            <p style="text-align: center;">Debes usar este código para poder iniciar sesión.</p>
            <p style="text-align: center;">
                <em>- Este código caducará en 10 minutos -</em>
            </p>
            <span class="flowbox" style="text-align: center; display: flex; justify-content: center;">
                <span id="warning_respond" class="flowbox" style="background-color: pink; margin: 0.rem 0rem 0.3rem 0rem; padding: 0.8rem; width: 82%; box-sizing: border-box; text-align: center; display: block;"> Si no has sido tú puedes decírnoslo respondiendo a este correo. </span>
            </span>
        </div>
        <div class="flowbox" style="background-color: lightblue; margin: 1em 0px; padding: 0.5rem; width: 100%; box-sizing: border-box; justify-content: center; text-align: center;">
            <span style="text-align: center;"> Mateo's Stage</span>
            
        </div>
        <div id="copyright" style="width:100%; justify-content:right; display:flex; ">
        <span style="text-align: right; margin: 0.2rem 1.7rem 0rem 0px; font-size: 0.7rem; color: gray;">Diseño por Alberto</span>
        </div>
    </div>
    </body>
    </html>
    `

    return { asunto: asunto, htmlContenido: htmlContenido }
}
const ConfirmacionCuentaCreadaEstructura = ({ apodo }) => {
    const asunto = "Confirmación de cuenta"
    const htmlContenido = `<span>¡Bienvenido a RAVAGE, ${apodo}!</span>
    <span style="text-decoration:underline">Se ha creado correctamente su cuenta</span>
    <span>Si no has sido tú puedes decírnoslo por este correo.</span>`

    return { asunto: asunto, htmlContenido: htmlContenido }
}

const ValidarCuentaUsuario = ({ apodo, code }) => {
    const asunto = "Verificación de cuenta" // TODO: Mover esto a un archivo ey?
    const htmlContenido = `<meta name="viewport" content="width=device-width, initial-scale=1.0">
<div class="flowbox" style="border-radius: 1.5rem 3.0rem; background-color: #cffff3; padding: 1rem; display: block; min-height: fit-content + 5;">
    <p>
        <span style="font-size: 1.3rem; font-family: Arial; padding: 0.8rem;"> Hola, ${apodo}. (●'◡'●)</span>
    </p>
    <div class="flowbox" style="font-size: 1.45em; border-radius: 1.5rem 3.0rem; background-color: #e8e8e8; padding: 0.8em 0.4em; box-sizing: border-box; display: block; width: 100%; text-align: center; font-family: Arial; height: fit-content">Tu código de verificación de cuenta es: 
        <br /><div style="display:flex; width:100%; justify-content:center;">
        <span id="otp_code" style="color: darkblue; border-radius: 1.5rem 3rem; background-color: lightgreen; padding: 0.6em; box-sizing: border-box; display: block; width: 100%; text-align: center; margin: 0.55em 0px 0em 0px; font-size: 2.5rem; width:80%; min-width: fit-content;user-select: all;">${code}</span>
    </div></div>
    <div class="flowbox" style="background-color: lightblue; margin: 1em 0px 1em 0em; padding: 0.5em; border-radius: 1.5rem 3rem; width: 100%; box-sizing: border-box; justify-content: center; text-align: center;">
        <p style="text-align: center;">Debes usar este código para poder iniciar sesión.</p>
        <p style="text-align: center;">
            <em>- Este código caducará en 10 minutos -</em>
        </p>
        <span class="flowbox" style="text-align: center; display: flex; justify-content: center;">
            <span id="warning_respond" class="flowbox" style="background-color: pink; margin: 0.rem 0rem 0.3rem 0rem; padding: 0.8rem; border-radius: 1.5rem 3rem; width: 82%; box-sizing: border-box; text-align: center; display: block;"> Si no has sido tú puedes decírnoslo respondiendo a este correo. </span>
        </span>
    </div>
    <div class="flowbox" style="background-color: lightblue; margin: 1em 0px; padding: 0.5rem; border-radius: 1.5rem 3rem; width: 100%; box-sizing: border-box; justify-content: center; text-align: center;">
        <span style="text-align: center;"> Mateo's Stage</span>
        
    </div>
    <div id="copyright" style="width:100%; justify-content:right; display:flex; ">
    <span style="text-align: right; margin: 0.2rem 1.7rem 0rem 0px; font-size: 0.7rem; color: gray;">Diseño por Alberto</span>
    </div>
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
