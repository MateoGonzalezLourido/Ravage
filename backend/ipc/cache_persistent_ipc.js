import { ipcMain } from '../utils/libs.js';
import { getUsuarioDeCache, clearCacheUsuarios } from '../repositories/UserRepository.js';
import { 
    obtener_historial, 
    añadir_historial, 
    borrar_historial_usuario, 
    limpiar_historial_completo,
    limpiar_variable_cache,
    cancelar_limpieza_variable_cache
} from '../STORAGE/CACHE/_cache_historial_busquedas_añadir_usuario.js';

export function registerCachePersistentHandlers() {

    // User Cache
    ipcMain.handle('get-usuario-cache', async (_, id_usuario) => {
        return await getUsuarioDeCache(id_usuario);
    });
    ipcMain.handle('clear-cache-usuarios', async () => {
        await clearCacheUsuarios();
        return true;
    });

    // Historial Busquedas Cache
    ipcMain.handle('obtener-historial-busquedas', async () => {
        return await obtener_historial();
    });
    ipcMain.handle('anadir-historial-busquedas', async (_, id, datoUsado) => {
        await añadir_historial(id, datoUsado);
        return true;
    });
    ipcMain.handle('borrar-historial-busquedas', async (_, id_o_dato) => {
        return await borrar_historial_usuario(id_o_dato);
    });
    ipcMain.handle('limpiar-historial-completo', async () => {
        await limpiar_historial_completo();
        return true;
    });
    ipcMain.handle('limpiar-variable-cache-historial', () => {
        limpiar_variable_cache();
        return true;
    });
    ipcMain.handle('cancelar-limpieza-variable-cache-historial', () => {
        cancelar_limpieza_variable_cache();
        return true;
    });
}
