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
    const htmlContenido = `<span style="text-decoration:underline">Hola, ${apodo}</span>
            <span style="font-size:20px">Codigo de verificacion de cuenta:</br><font style="color:green">${code}</font></span>
            <span>Debes usar este código para poder iniciar sesión.</span>
            <span>Si no has sido tú puedes decírnoslo por este correo.</span>
            <span style="font-style: italic;color=gray">AVISO: Este código caducará en 10minutos, así que te recomendamos que hagas la verificación lo antes posible.</span>
            <span>Mateo's Stage</span>`
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