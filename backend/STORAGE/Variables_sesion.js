const { model } = require("mongoose");

let Correo_Usuario_sesion;
let Apodo_Usuario_sesion;
let Id_Sesion_activa;

module.exports = {
    setCorreoSesion: (correo) => Correo_Usuario_sesion = correo,
    getApodoSesion: () => Correo_Usuario_sesion,
    setApodoSesion: (apodo) => Apodo_Usuario_sesion = apodo,
    getApodoSesion: () => Apodo_Usuario_sesion,
    setIdSesion: (id) => Id_Sesion_activa = id,
    getIdSesion: () => Id_Sesion_activa,
}