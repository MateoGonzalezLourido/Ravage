let Correo_Usuario_sesion;
let Apodo_Usuario_sesion;

module.exports = {
    setCorreoSesion: (correo) => Correo_Usuario_sesion = correo,
    getCorreoSesion: () => Correo_Usuario_sesion,
    setApodoSesion: (apodo) => Apodo_Usuario_sesion = apodo,
    getApodoSesion: () => Apodo_Usuario_sesion,
}