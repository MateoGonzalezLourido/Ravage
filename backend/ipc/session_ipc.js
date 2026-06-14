import { ipcMain, app } from '../utils/libs.js';
import { loginUsuario, registerUsuario, ValidarCodeRegistroUsuario, ValidarCodeLogin, cerrarSesionUsuario } from '../services/sesionUsuario.js';
import { comprobaciones_Correo, comprobarContrasenaValidaciones, comprobar_apodo, comprobar_codigo_verificacion, comprobar_contraseña_cuenta } from '../services/validadores.js';
import { BorrarVC, BorrarCuentaVC } from '../repositories/SecurityRepository.js';
import { machineIdSync } from '../utils/libs.js';
import { authRateLimiter } from '../utils/rateLimiter.js';
import { estaDispositivoBloqueadoApp, registrarInfraccionPersistent } from '../repositories/rateLimitRepository.js';
import { hashDatosSistema } from '../services/cryptoService.js';
import {
    getCorreoSesion,
    getApodoSesion,
    getFechaCreacionCuenta,
    getFechaBloqueoApodo,
    getFechaBloqueoCorreo,
    getFechaBloqueoContraseña,
    getIDMongodbUsuario,
    getIDAmigo,
    getInvisibleUsuario,
    getMostrarCorreoUsuario
} from '../STORAGE/Variables_sesion.js';
import {
    permitirCambioContraseñaUsuario,
    ValidarCodeCambioDatosCuenta,
    permitirCambioCorreoUsuario,
    permitirCambioApodoUsuario
} from '../services/Usuario.js';
import { saveSecurityPinFile, readFileSession, clearFileSession } from '../services/controladorArchivos.js';
import { hash, compare } from '../utils/libs.js';

export function registerSessionHandlers(mainWindow) {
    const machineId = machineIdSync();
    const id_dp_hash = hashDatosSistema(machineId);

    /**
     * Verifica bloqueos permanentes y rate-limiting en memoria.
     * Si salta el límite de memoria, registra una infracción en DB.
     * @returns {Promise<{blocked: boolean, message?: string}>}
     */
    async function checkSecurityLimits() {
        // 1. Verificar bloqueo permanente de la App (irreversible)
        if (await estaDispositivoBloqueadoApp(id_dp_hash)) {
            return { blocked: true, message: "Este dispositivo ha sido bloqueado permanentemente por mal uso. Contacta con soporte para más información." };
        }

        // 2. Verificar Rate Limiter en memoria (7 intentos / 15 min)
        const limiter = authRateLimiter.check(id_dp_hash);
        if (limiter.blocked) {
            // Registrar infracción en DB (si llega a 5 en un día, se bloquea permanentemente)
            const audit = await registrarInfraccionPersistent(id_dp_hash);
            
            let msg = `Demasiados intentos. Por favor, espera ${Math.ceil(limiter.resetIn / 60000)} minutos.`;
            if (audit.bloqueadoAhora) {
                msg = "Has excedido el límite de seguridad diario. Este dispositivo ha sido BLOQUEADO permanentemente.";
            }

            return { blocked: true, message: msg };
        }

        return { blocked: false };
    }

    // NAVEGACIÓN (moved here or kept in main? let's keep separate)
    ipcMain.on("cambiar-pagina-log", () => {
        app.relaunch();
        app.exit(0);
    })

    // SESIÓN
    ipcMain.handle('login-usuario', async (_, username, password, mantener_sesion_iniciada) => {
        const security = await checkSecurityLimits();
        if (security.blocked) return { success: false, message: security.message };

        if (!comprobaciones_Correo(username).success || !comprobarContrasenaValidaciones(password).success) {
            authRateLimiter.record(id_dp_hash); // Registrar intento fallido
            return { success: false, message: "Datos de login inválidos" }
        }
        
        const res = await loginUsuario(mainWindow, { username, contraseña: password, mantener_sesion_iniciada });
        if (!res.success) authRateLimiter.record(id_dp_hash);
        else authRateLimiter.reset(id_dp_hash); // Éxito: limpiar limitador

        return res;
    })

    ipcMain.handle('registrar-usuario', async (_, apodo, username, password) => {
        const security = await checkSecurityLimits();
        if (security.blocked) return { success: false, message: security.message };

        if (!comprobaciones_Correo(username).success || !comprobarContrasenaValidaciones(password).success) {
            authRateLimiter.record(id_dp_hash);
            return { success: false, message: "Datos de registro inválidos" }
        }
        if (apodo && !comprobar_apodo(apodo).success) {
            return { success: false, message: "Apodo no válido" }
        }
        
        const res = await registerUsuario(mainWindow, { apodo, correo: username, password });
        if (!res.success) authRateLimiter.record(id_dp_hash);
        return res;
    })

    ipcMain.handle('validar-code-registrar-usuario', async (_, correo, code) => {
        const security = await checkSecurityLimits();
        if (security.blocked) return { success: false, message: security.message };

        if (!comprobar_codigo_verificacion(code).success) {
            authRateLimiter.record(id_dp_hash);
            return { success: false, message: "Código no válido" }
        }
        return await ValidarCodeRegistroUsuario({ correo, code })
    })

    ipcMain.handle('validar-code-login-usuario', async (_, correo, password) => {
        const security = await checkSecurityLimits();
        if (security.blocked) return { success: false, message: security.message };

        if (!comprobar_codigo_verificacion(password).success) {
            authRateLimiter.record(id_dp_hash);
            return { success: false, message: "Código no válido" }
        }
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

    ipcMain.handle("obtener-invisible-usuario", () => {
        return getInvisibleUsuario()
    })

    ipcMain.handle("obtener-mostrar-correo-usuario", () => {
        return getMostrarCorreoUsuario()
    })

    // PIN DE SEGURIDAD
    ipcMain.handle("configurar-pin-seguridad", async (_, oldPin, newPin) => {
        try {
            const correo = getCorreoSesion();
            if (!correo) return { ok: false, error: "No hay sesión iniciada" };

            const data = await readFileSession('securityPin');
            
            // Verificar PIN anterior si existe
            if (data && data.correo === correo) {
                if (!oldPin) return { ok: false, error: "Se requiere el PIN actual" };
                const isMatch = await compare(oldPin, data.pinHash);
                if (!isMatch) return { ok: false, error: "El PIN actual es incorrecto" };
            }

            // Guardar nuevo PIN
            if (newPin) {
                const pinHash = await hash(newPin, 10); // 10 salt rounds es suficiente para un PIN
                await saveSecurityPinFile({ correo, pinHash });
                return { ok: true };
            } else {
                // Si no hay newPin, lo borramos
                await clearFileSession('securityPin');
                return { ok: true };
            }
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("verificar-pin-seguridad", async (_, pinAttempt) => {
        try {
            const correo = getCorreoSesion();
            if (!correo) return { ok: false, error: "No hay sesión iniciada" };

            const data = await readFileSession('securityPin');
            if (!data || data.correo !== correo) {
                return { ok: true, noPin: true }; // Si no hay PIN o el correo no coincide, pasamos
            }

            const isMatch = await compare(pinAttempt, data.pinHash);
            return { ok: isMatch };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.handle("tiene-pin-seguridad", async () => {
        try {
            const correo = getCorreoSesion();
            if (!correo) return false;

            const data = await readFileSession('securityPin');
            if (data && data.correo === correo) {
                return true;
            }
            // Si hay un PIN de otro usuario, se limpia o se ignora
            if (data && data.correo !== correo) {
                await clearFileSession('securityPin');
            }
            return false;
        } catch (err) {
            return false;
        }
    });
}
