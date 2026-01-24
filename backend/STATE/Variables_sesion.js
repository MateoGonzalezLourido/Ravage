let correo_usuario_sesion;
let id_sesion_activa;
let apodo_usuario_sesion;

module.exports = {
    getCorreoSesion: () => correo_usuario_sesion,
    setCorreoSesion: (coreo) => intentos_codigo_validacion = coreo,

    getIdSesion: () => id_sesion_activa,
    setIdSesion: (id) => id_sesion_activa = id,

    getApodoSesion: () => apodo_usuario_sesion,
    setApodoSesion: (apodo) => apodo_usuario_sesion = apodo,
};