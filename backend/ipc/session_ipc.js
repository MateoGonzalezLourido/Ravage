import { ipcMain, app } from '../utils/libs.js';
import {
    loginUsuario,
    registerUsuario,
    ValidarCodeRegistroUsuario,
    ValidarCodeLogin,
    cerrarSesionUsuario,
    comprobar_contraseña_cuenta
} from '../services/sesionUsuario.js';
import {
    BorrarVC,
    BorrarCuentaVC
} from '../db/mongo.js';
import {
    getCorreoSesion,
    getApodoSesion,
    getFechaCreacionCuenta,
    getFechaBloqueoApodo,
    getFechaBloqueoCorreo,
    getFechaBloqueoContraseña,
    getIDMongodbUsuario,
    getIDAmigo
} from '../STORAGE/Variables_sesion.js';
import {
    permitirCambioContraseñaUsuario,
    ValidarCodeCambioDatosCuenta,
    permitirCambioCorreoUsuario,
    permitirCambioApodoUsuario
} from '../services/Usuario.js';

export function registerSessionHandlers(mainWindow) {
    // NAVEGACIÓN (moved here or kept in main? let's keep separate)
    ipcMain.on("cambiar-pagina-log", () => {
        app.relaunch();
        app.exit(0);
    })

    // SESIÓN
    ipcMain.handle('login-usuario', async (_, username, password, mantener_sesion_iniciada) => {
        return await loginUsuario({ username, contraseña: password, mantener_sesion_iniciada })
    })

    ipcMain.handle('registrar-usuario', async (_, apodo, username, password) => {
        return await registerUsuario({ apodo, correo: username, password })
    })

    ipcMain.handle('validar-code-registrar-usuario', async (_, correo, code) => {
        return await ValidarCodeRegistroUsuario({ correo, code })
    })

    ipcMain.handle('validar-code-login-usuario', async (_, correo, password) => {
        return await ValidarCodeLogin({ correo, code: password })
    })

    ipcMain.handle('borrar-code-registrar-usuario', async (_, correo) => {
        return await BorrarVC(correo)
    })

    ipcMain.handle('borrar-code-login-usuario', async (_, correo) => {
        return await BorrarCuentaVC(correo)
    })

    ipcMain.handle('cerrar-sesion-usuario', async () => {
        const correo = getCorreoSesion()
        await cerrarSesionUsuario(correo)
        app.relaunch();
        app.exit(0);
    })

    // CUENTA
    ipcMain.handle("obtener-apodo-sesion", () => {
        return getApodoSesion()
    })

    ipcMain.handle("obtener-correo-usuario", () => {
        return getCorreoSesion()
    })

    ipcMain.handle("obtener-id-mongodb-usuario", async () => {
        return await getIDMongodbUsuario()
    })

    ipcMain.handle("obtener-idamigo-usuario", () => {
        return getIDAmigo()
    })

    ipcMain.handle("comprobar-contraseña-cuenta", async (_, contraseña) => {
        return await comprobar_contraseña_cuenta(contraseña)
    })

    ipcMain.handle("permitir-cambio-datos-cuenta", async (_, data, tipo) => {
        if (tipo === "contraseña") return await permitirCambioContraseñaUsuario(data)
        if (tipo === "correo") return await permitirCambioCorreoUsuario(data)
        if (tipo === "apodo") return await permitirCambioApodoUsuario(data)
    })

    ipcMain.handle("cambiar-datos-usuario", async (_, data, code, tipo) => {
        return await ValidarCodeCambioDatosCuenta({ data, code, tipo })
    })

    ipcMain.handle("obtener-fecha-creacion-cuenta", () => {
        return getFechaCreacionCuenta()
    })

    ipcMain.handle("obtener-fecha-bloqueo-apodo", () => {
        return getFechaBloqueoApodo()
    })

    ipcMain.handle("obtener-fecha-bloqueo-correo", () => {
        return getFechaBloqueoCorreo()
    })

    ipcMain.handle("obtener-fecha-bloqueo-contraseña", () => {
        return getFechaBloqueoContraseña()
    })
}
