import { ipcMain } from '../utils/libs.js';
import { 
    comprobaciones_Correo, 
    comprobar_apodo, 
    comprobarContrasenaValidaciones, 
    comprobar_idAmigo, 
    comprobar_codigo_verificacion, 
    comprobar_mensaje, 
    comprobar_nombre_archivo 
} from '../services/validadores.js';

export function registerValidadoresHandlers() {
    ipcMain.handle('validar-correo', (_, correo) => comprobaciones_Correo(correo).success);
    ipcMain.handle('validar-apodo', (_, apodo) => comprobar_apodo(apodo).success);
    ipcMain.handle('validar-contraseña', (_, contraseña) => comprobarContrasenaValidaciones(contraseña).success);
    ipcMain.handle('validar-idamigo', (_, idAmigo) => comprobar_idAmigo(idAmigo).success);
    ipcMain.handle('validar-codigo', (_, codigo) => comprobar_codigo_verificacion(codigo).success);
    ipcMain.handle('validar-mensaje', (_, mensaje) => comprobar_mensaje(mensaje).success);
    ipcMain.handle('validar-nombre-archivo', (_, nombre) => comprobar_nombre_archivo(nombre).success);
}
