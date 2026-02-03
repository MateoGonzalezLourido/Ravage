let Correo_Usuario_sesion;
let Apodo_Usuario_sesion = "Usuario";
let getFechaCreacionCuenta = "xx/xx/xx"
module.exports = {
    setCorreoSesion: (correo) => Correo_Usuario_sesion = correo,
    getCorreoSesion: () => Correo_Usuario_sesion,
    setApodoSesion: (apodo) => Apodo_Usuario_sesion = apodo,
    getApodoSesion: () => Apodo_Usuario_sesion,
    setFechaCreacionCuenta: (fecha = null) => {
        if (!fecha) {
            getFechaCreacionCuenta = "xx/xx/xx"
        }
        const d = new Date(fecha); // fecha = Date de Mongo
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0'); // 0–11
        const año = d.getFullYear();

        const formato = `${dia}/${mes}/${año}`;
        getFechaCreacionCuenta = formato
    },
    getFechaCreacionCuenta: () => getFechaCreacionCuenta,
}