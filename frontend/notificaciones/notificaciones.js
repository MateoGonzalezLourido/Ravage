/* =========================================================================
   SISTEMA DE NOTIFICACIONES RAVAGE - GESTIÓN SECUENCIAL Y DISEÑO PREMIUM
   ========================================================================= */

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
    info: 'Información',
    success: 'Éxito',
    warning: 'Advertencia',
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
    setTimeout(() => div.remove(), 400) // tiempo de transición de CSS
}

// ── Constructora de elemento notificación ────────────────────────────────────
function crearElementoNoti(texto, tipo, duracion) {
    const tipoValido = ['error', 'info', 'success', 'warning'].includes(tipo) ? tipo : 'default'

    const div = document.createElement('div')
    div.className = `notificacion noti-${tipoValido}`
    div.style.setProperty('--noti-duracion', `${duracion}ms`)

    // Icono
    const iconoWrapper = document.createElement('div')
    iconoWrapper.className = 'noti-icono-wrapper'
    const icono = document.createElement('span')
    icono.className = 'noti-icono'
    icono.textContent = NOTI_ICONOS[tipoValido]
    iconoWrapper.appendChild(icono)

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
    const cerrarBtn = document.createElement('button')
    cerrarBtn.className = 'noti-cerrar'
    cerrarBtn.innerHTML = '&times;'

    div.appendChild(iconoWrapper)
    div.appendChild(cuerpo)
    div.appendChild(cerrarBtn)

    return div
}

// ── Sistema con cola (notificaciones secuenciales - 1 a la vez) ──────────────
let cola_notificaciones = []
let mostrando = false

window.pushNotificacion = function (data) {
    // Añadimos a la cola
    cola_notificaciones.push({
        texto: data.texto || data.text || 'Sin mensaje', // Compatibilidad
        tipo: data.tipo,
        duracion: data.duracion ?? 4000
    });
    
    // Intentamos mostrar si no hay ninguna activa
    mostrarNotificacion();
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
        const duracion = noti.duracion
        const token = { cancelled: false }
        const contenedor = obtenerContenedor()
        
        // Limpiamos el contenedor por si acaso quedara algo "colgado", 
        // asegurando estrictamente 1 notificación.
        contenedor.innerHTML = '';

        const div = crearElementoNoti(noti.texto, noti.tipo, duracion)

        const clickHandler = () => {
            if (token.cancel) token.cancel()
        }
        
        div.querySelector('.noti-cerrar').addEventListener('click', (e) => {
            e.stopPropagation()
            clickHandler()
        })
        
        div.addEventListener('click', (e) => {
            // Permitir cerrar también haciendo clic en la notificación
            if(e.target.className !== 'noti-cerrar') {
                clickHandler()
            }
        }, { once: true })

        contenedor.appendChild(div)

        // Usamos nuestro sleep cancelable para esperar
        sleep(duracion, token, div).then(() => {
            // Una vez terminada, vamos a la siguiente en la cola
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
                setTimeout(resolve, 400) // Esperamos a que termine la animación css
            }
        }, ms)

        token.cancel = () => {
            clearTimeout(timeoutId)
            token.cancelled = true
            cerrarNotificacion(div)
            setTimeout(resolve, 400) // Esperamos a que termine la animación css
        }
    })
}
