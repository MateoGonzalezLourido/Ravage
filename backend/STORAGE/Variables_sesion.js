let Correo_Usuario_sesion;
let Apodo_Usuario_sesion = "Usuario";
let FechaCreacionCuenta = "xx/xx/xx"
let FechaBloqueoApodo = ""
let FechaBloqueoCorreo = ""
let FechaBloqueoContraseña = ""
let UsuariosSilenciados= []
let UsuariosBloqueados = []

module.exports = {
    setCorreoSesion: (correo) => Correo_Usuario_sesion = correo,
    getCorreoSesion: () => Correo_Usuario_sesion,
    setApodoSesion: (apodo) => Apodo_Usuario_sesion = apodo,
    getApodoSesion: () => Apodo_Usuario_sesion,
    setFechaCreacionCuenta: (fecha = null) => {
        if (!fecha) FechaCreacionCuenta = "xx/xx/xx"

        const d = new Date(fecha); // fecha = Date de Mongo
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0'); // 0–11
        const año = d.getFullYear();

        const formato = `${dia}/${mes}/${año}`;
        FechaCreacionCuenta = formato
    },
    getFechaCreacionCuenta: () => FechaCreacionCuenta,
    setFechaBloqueoApodo: (fecha) => {
        if (!fecha) FechaBloqueoApodo = ""

        const ahora = new Date();
        const d = new Date(fecha); // Date de Mongo

        const msRestantes = d - ahora;          // diferencia en ms
        const horasRestantes = Math.max(0, Math.floor(msRestantes / (1000 * 60 * 60)));

        FechaBloqueoApodo = horasRestantes
    },
    getFechaBloqueoApodo: () => FechaBloqueoApodo,
    setFechaBloqueoCorreo: (fecha) => {
        if (!fecha) FechaBloqueoCorreo = ""

        const ahora = new Date();
        const d = new Date(fecha); // Date de Mongo

        const msRestantes = d - ahora;          // diferencia en ms
        const horasRestantes = Math.max(0, Math.floor(msRestantes / (1000 * 60 * 60)));

        FechaBloqueoCorreo = horasRestantes
    },
    getFechaBloqueoCorreo: () => FechaBloqueoCorreo,
    setFechaBloqueoContraseña: (fecha) => {
        if (!fecha) FechaBloqueoContraseña = ""

        const ahora = new Date();
        const d = new Date(fecha); // Date de Mongo

        const msRestantes = d - ahora;          // diferencia en ms
        const horasRestantes = Math.max(0, Math.floor(msRestantes / (1000 * 60 * 60)));

        FechaBloqueoContraseña = horasRestantes
    },
    getFechaBloqueoContraseña: () => FechaBloqueoContraseña,

    setUsuariosSilence: (datos) => UsuariosSilenciados = datos,
    getUsuariosSilence: () => UsuariosSilenciados,

    setUsuariosBloqueados: (datos) => UsuariosBloqueados = datos,
    getUsuariosBloqueados: () => UsuariosBloqueados,
}