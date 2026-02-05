/*ESTE CODIGO PRIMERAMENTE FUE HECHO POR MI, PERO AL QUERER HACER UNA COSA PARA UN SLEEP CANCELABLE ME PUSE CON CHATGPT PARA VER COMO SE HACIA BIEN Y DESPUES DE MANDARLE SUS PROPIOS CODIGOS 10VECES HASTA QUE EL DECIDIERA QUE LOS HIZO BIEN ACABO RESULTANDO EN ESTO. LA COSA ES QUE ESTE CODIGO NO LO VOY A REVISAR QUE ES TARDE YA. SI VEO QUE NO FUNCIONA ENTRARÉ A CAMBIARLO Y QUITARE ESTE TEXTACO.
FECHA:05/02/2026. BY:MATEO WITH CHATGPT *^____^*
*/


let cola_notificaciones = [] // prioridad: menor = más importante
let mostrando = false // controla si hay notificaciones activas
window.pushNotificacion = function (data) {
    const id = `noti-${crypto.randomUUID()}`

    const div = document.createElement("div")
    div.id = id
    div.className = "notificacion"
    div.style.cssText = `
        border: 2px solid black;
        border-radius: 8px;
        background-color: azure;
        max-width: 250px;
        max-height: 150px;
        padding: 4px;
        ${data.tipo === "error" ? "border:2px solid red;" : ""}
        ${data.tipo === "info" ? "border:2px solid blue;" : ""}
        ${data.tipo === "success" ? "border:2px solid green;" : ""}
        opacity:1;
        transition: opacity 0.5s ease;
    `
    const span = document.createElement("span")
    span.textContent = data.texto
    div.appendChild(span)
    document.body.appendChild(div)

    const cerrar = () => {
        div.style.opacity = 0 // dispara transición
        // forzar remove tras duración de la transición
        setTimeout(() => div.remove(), 500)
    }

    div.addEventListener("click", cerrar)
    setTimeout(cerrar, 2500)
}



const bloque_noti_estilos_base = `
  border: 2px solid black;
  border-radius: 8px;
  background-color: azure;
  max-width: 250px;
  max-height: 150px;
  padding: 4px;
`

const estilos_bloque_noti = {
    "error": "border: 2px solid red;",
    "info": "border: 2px solid blue;",
    "success": "border: 2px solid green;"
}

const estilos_contenido_noti = {
    "error": "color:red; padding:1px;",
    "info": "color:blue; padding:1px;",
    "success": "color:green; padding:1px;"
}

function mostrarNotificacion() {
    if (mostrando || cola_notificaciones.length === 0) return
    mostrando = true

    function procesarSiguiente() {
        if (cola_notificaciones.length === 0) {
            mostrando = false
            return
        }

        const noti = cola_notificaciones.shift()
        const id = `noti-${crypto.randomUUID()}`
        const token = { cancelled: false }

        const div = document.createElement("div")
        div.id = id
        div.style.cssText = bloque_noti_estilos_base + estilos_bloque_noti[noti.tipo]
        const span = document.createElement("span")
        span.style.cssText = estilos_contenido_noti[noti.tipo]
        span.textContent = noti.text
        div.appendChild(span)
        document.body.appendChild(div)

        const clickHandler = () => token.cancel && token.cancel()
        div.addEventListener("click", clickHandler, { once: true }) // se elimina al dispararse

        sleep(2500, token, div).then(() => {
            procesarSiguiente()
        })
    }

    procesarSiguiente()
}

function sleep(ms, token, div) {
    return new Promise(resolve => {
        const timeoutId = setTimeout(() => {
            if (!token.cancelled) resolve()
        }, ms)

        token.cancel = () => {
            clearTimeout(timeoutId)
            token.cancelled = true
            div?.remove()
            resolve()
        }
    })
}
