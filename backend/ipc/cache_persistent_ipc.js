import { ipcMain } from '../utils/libs.js';
import { getChatDeCache, setConfigCacheChats, clearCacheChats } from '../STORAGE/CACHE/_cache_chats.js';
import { getUsuarioDeCache, setConfigCacheUsuarios, clearCacheUsuarios } from '../STORAGE/CACHE/_cache_usuarios.js';

export function registerCachePersistentHandlers() {
    // Chat Cache
    ipcMain.handle('get-chat-cache', async (event, id_chat) => {
        return await getChatDeCache(id_chat);
    });
    ipcMain.handle('set-config-cache-chats', async (event, config) => {
        return await setConfigCacheChats(config);
    });
    ipcMain.handle('clear-cache-chats', async (event) => {
        await clearCacheChats();
        return true;
    });

    // User Cache
    ipcMain.handle('get-usuario-cache', async (event, id_usuario) => {
        return await getUsuarioDeCache(id_usuario);
    });
    ipcMain.handle('set-config-cache-usuarios', async (event, config) => {
        return await setConfigCacheUsuarios(config);
    });
    ipcMain.handle('clear-cache-usuarios', async (event) => {
        await clearCacheUsuarios();
        return true;
    });
}
