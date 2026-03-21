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
    ipcMain.handle('validar-correo', (event, correo) => comprobaciones_Correo(correo).success);
    ipcMain.handle('validar-apodo', (event, apodo) => comprobar_apodo(apodo).success);
    ipcMain.handle('validar-contraseña', (event, contraseña) => comprobarContrasenaValidaciones(contraseña).success);
    ipcMain.handle('validar-idamigo', (event, idAmigo) => comprobar_idAmigo(idAmigo).success);
    ipcMain.handle('validar-codigo', (event, codigo) => comprobar_codigo_verificacion(codigo).success);
    ipcMain.handle('validar-mensaje', (event, mensaje) => comprobar_mensaje(mensaje).success);
    ipcMain.handle('validar-nombre-archivo', (event, nombre) => comprobar_nombre_archivo(nombre).success);
}
