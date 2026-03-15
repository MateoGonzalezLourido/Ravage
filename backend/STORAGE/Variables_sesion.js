let Correo_Usuario_sesion;
let Apodo_Usuario_sesion = "Usuario";
let FechaCreacionCuenta = "xx/xx/xx"
let FechaBloqueoApodo = ""
let FechaBloqueoCorreo = ""
let FechaBloqueoContraseña = ""
let UsuariosSilenciados = []
let UsuariosBloqueados = []
let IdDispositivo;
let IdMongodbUsuario;
let secretKey;

let ListaChats = []
let ListaContactos = []
let VisibleUsuario = false
let IDamigo

export const setCorreoSesion = (correo) => Correo_Usuario_sesion = correo;
export const getCorreoSesion = () => Correo_Usuario_sesion;
export const setApodoSesion = (apodo) => Apodo_Usuario_sesion = apodo;
export const getApodoSesion = () => Apodo_Usuario_sesion;
export const setFechaCreacionCuenta = (fecha = null) => {
    if (!fecha) FechaCreacionCuenta = "xx/xx/xx";

    const d = new Date(fecha); // fecha = Date de Mongo
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0'); // 0–11
    const año = d.getFullYear();

    const formato = `${dia}/${mes}/${año}`;
    FechaCreacionCuenta = formato;
};
export const getFechaCreacionCuenta = () => FechaCreacionCuenta;
export const setFechaBloqueoApodo = (fecha) => {
    if (!fecha) {
        FechaBloqueoApodo = "";
        return;
    }

    const ahora = new Date();
    const d = new Date(fecha); 

    const msRestantes = d - ahora;
    if (msRestantes <= 0) {
        FechaBloqueoApodo = "";
        return;
    }

    const horas = Math.floor(msRestantes / (1000 * 60 * 60));
    const minutos = Math.floor((msRestantes % (1000 * 60 * 60)) / (1000 * 60));

    if (horas > 0) FechaBloqueoApodo = `${horas}h ${minutos}m`;
    else FechaBloqueoApodo = `${minutos}m`;
};
export const getFechaBloqueoApodo = () => FechaBloqueoApodo;
export const setFechaBloqueoCorreo = (fecha) => {
    if (!fecha) {
        FechaBloqueoCorreo = "";
        return;
    }

    const ahora = new Date();
    const d = new Date(fecha); 

    const msRestantes = d - ahora;
    if (msRestantes <= 0) {
        FechaBloqueoCorreo = "";
        return;
    }

    const horas = Math.floor(msRestantes / (1000 * 60 * 60));
    const minutos = Math.floor((msRestantes % (1000 * 60 * 60)) / (1000 * 60));

    if (horas > 0) FechaBloqueoCorreo = `${horas}h ${minutos}m`;
    else FechaBloqueoCorreo = `${minutos}m`;
};
export const getFechaBloqueoCorreo = () => FechaBloqueoCorreo;
export const setFechaBloqueoContraseña = (fecha) => {
    if (!fecha) {
        FechaBloqueoContraseña = "";
        return;
    }

    const ahora = new Date();
    const d = new Date(fecha); 

    const msRestantes = d - ahora;
    if (msRestantes <= 0) {
        FechaBloqueoContraseña = "";
        return;
    }

    const horas = Math.floor(msRestantes / (1000 * 60 * 60));
    const minutos = Math.floor((msRestantes % (1000 * 60 * 60)) / (1000 * 60));

    if (horas > 0) FechaBloqueoContraseña = `${horas}h ${minutos}m`;
    else FechaBloqueoContraseña = `${minutos}m`;
};
export const getFechaBloqueoContraseña = () => FechaBloqueoContraseña;

export const setUsuariosSilence = (datos) => UsuariosSilenciados = datos;
export const getUsuariosSilence = () => UsuariosSilenciados;

export const setUsuariosBloqueados = (datos) => UsuariosBloqueados = datos;
export const getUsuariosBloqueados = () => UsuariosBloqueados;
export const setIdDispositivo = (id) => IdDispositivo = id;
export const getIdDispositivo = () => IdDispositivo;
export const setSecretKEY = (key) => secretKey = (key != "") ? key : null;
export const getSecretKEY = () => secretKey;

export const setListaChats = (lista) => ListaChats = lista;
export const getListaChats = () => ListaChats;
export const setListaContactos = (lista) => ListaContactos = lista;
export const getListaContactos = () => ListaContactos;
export const setVisibleUsuario = (bool) => VisibleUsuario = bool;
export const getVisibleUsuario = () => VisibleUsuario;
export const setIDMongodbUsuario = (id) => IdMongodbUsuario = id;
export const getIDMongodbUsuario = () => IdMongodbUsuario;
export const setIDAmigo = (id) => IDamigo = id;
export const getIDAmigo = () => IDamigo;
