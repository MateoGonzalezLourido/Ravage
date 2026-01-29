const { ActualizarUsuarioActivo } = require('../db/mongo.js')

//mantener sesion activa
function comprobarActividadOnline() {
    setInterval(() => {
        ActualizarUsuarioActivo()
    }, 4 * 60 * 1000)//4minutos, aunque mongo expire cada 5 minutos
}

module.exports = {
    comprobarActividadOnline
}