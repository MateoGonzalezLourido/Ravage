/*ESTE CODIGO PRIMERAMENTE FUE HECHO POR MI, PERO AL QUERER HACER UNA COSA PARA UN SLEEP CANCELABLE ME PUSE CON CHATGPT PARA VER COMO SE HACIA BIEN Y DESPUES DE MANDARLE SUS PROPIOS CODIGOS 10VECES HASTA QUE EL DECIDIERA QUE LOS HIZO BIEN ACABO RESULTANDO EN ESTO. LA COSA ES QUE ESTE CODIGO NO LO VOY A REVISAR QUE ES TARDE YA. SI VEO QUE NO FUNCIONA ENTRARÉ A CAMBIARLO Y QUITARE ESTE TEXTACO.
FECHA:05/02/2026. BY:MATEO WITH CHATGPT *^____^*
*/
/*Como generar una notificacion-> 

window.pushNotificacion({
    prioridad: 0, // menor número = más importante
    texto: `Nuevo mensaje de ${nombre}`,
    tipo: "info" // "info", "error", "success"
})
*/
// ── Iconos por tipo ──────────────────────────────────────────────────────────
const NOTI_ICONOS = {
    error: '✕',
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    default: '●'
}

const NOTI_TITULOS = {
    error: 'Error',
    info: 'Info',
    success: 'Listo',
    warning: 'Aviso',
    default: 'Aviso'
}

// ── Contenedor compartido ────────────────────────────────────────────────────
function obtenerContenedor() {
    let contenedor = document.getElementById('notificaciones-contenedor')
    if (!contenedor) {
        contenedor = document.createElement('div')
        contenedor.id = 'notificaciones-contenedor'
        document.body.appendChild(contenedor)
    }
    return contenedor
}

// ── Función de cierre (con animación de salida) ──────────────────────────────
function cerrarNotificacion(div) {
    div.classList.add('noti-salir')
    setTimeout(() => div.remove(), 420)
}

// ── Constructora de elemento notificación ────────────────────────────────────
function crearElementoNoti(texto, tipo, duracion) {
    const tipoValido = ['error', 'info', 'success', 'warning'].includes(tipo) ? tipo : 'default'

    const div = document.createElement('div')
    div.className = `notificacion noti-${tipoValido}`
    div.style.setProperty('--noti-duracion', `${duracion}ms`)

    // Icono
    const icono = document.createElement('span')
    icono.className = 'noti-icono'
    icono.textContent = NOTI_ICONOS[tipoValido]

    // Cuerpo
    const cuerpo = document.createElement('div')
    cuerpo.className = 'noti-cuerpo'

    const titulo = document.createElement('span')
    titulo.className = 'noti-titulo'
    titulo.textContent = NOTI_TITULOS[tipoValido]

    const span = document.createElement('span')
    span.className = 'noti-texto'
    span.textContent = texto

    cuerpo.appendChild(titulo)
    cuerpo.appendChild(span)

    // Botón cerrar
    const cerrarBtn = document.createElement('span')
    cerrarBtn.className = 'noti-cerrar'
    cerrarBtn.textContent = '✕'

    div.appendChild(icono)
    div.appendChild(cuerpo)
    div.appendChild(cerrarBtn)

    return div
}

// ── pushNotificacion ─────────────────────────────────────────────────────────
// Notificaciones independientes (pueden apilarse, no bloquean entre sí)
window.pushNotificacion = function (data) {
    const duracion = data.duracion ?? 5000
    const contenedor = obtenerContenedor()
    const div = crearElementoNoti(data.texto, data.tipo, duracion)

    const cerrar = () => cerrarNotificacion(div)

    div.querySelector('.noti-cerrar').addEventListener('click', (e) => {
        e.stopPropagation()
        cerrar()
    })
    div.addEventListener('click', cerrar)

    contenedor.appendChild(div)
    setTimeout(cerrar, duracion)
}


// ── Sistema con cola (notificaciones secuenciales) ───────────────────────────
let cola_notificaciones = []
let mostrando = false

function mostrarNotificacion() {
    if (mostrando || cola_notificaciones.length === 0) return
    mostrando = true

    function procesarSiguiente() {
        if (cola_notificaciones.length === 0) {
            mostrando = false
            return
        }

        const noti = cola_notificaciones.shift()
        const duracion = noti.duracion ?? 2500
        const token = { cancelled: false }
        const contenedor = obtenerContenedor()
        const div = crearElementoNoti(noti.text, noti.tipo, duracion)

        const clickHandler = () => token.cancel && token.cancel()
        div.querySelector('.noti-cerrar').addEventListener('click', (e) => {
            e.stopPropagation()
            clickHandler()
        })
        div.addEventListener('click', clickHandler, { once: true })

        contenedor.appendChild(div)

        sleep(duracion, token, div).then(() => {
            procesarSiguiente()
        })
    }

    procesarSiguiente()
}

function sleep(ms, token, div) {
    return new Promise(resolve => {
        const timeoutId = setTimeout(() => {
            if (!token.cancelled) {
                cerrarNotificacion(div)
                setTimeout(resolve, 420)
            }
        }, ms)

        token.cancel = () => {
            clearTimeout(timeoutId)
            token.cancelled = true
            cerrarNotificacion(div)
            setTimeout(resolve, 420)
        }
    })
}
