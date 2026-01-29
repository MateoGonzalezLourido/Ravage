const { ActualizarUsuarioActivo } = require('../db/mongo.js')
const { getCorreoSesion } = require('../STORAGE/Variables_sesion')

//mantener sesion activa
async function comprobarActividadOnline() {
    setInterval(() => {
        const correo = getCorreoSesion()
        ActualizarUsuarioActivo(correo)

    }, 4 * 60 * 1000)//4minutos, aunque mongo expire cada 5 minutos
}

module.exports = {
    comprobarActividadOnline
}